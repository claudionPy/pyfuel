# controller.py
# Main controller for the fueling station application.
# Coordinates between GUI, hardware pumps, and database operations.

import asyncio                      # For async event loop and tasks
import logging                      # For logging informational and error messages
import psutil                       # For system resource monitoring
from decimal import Decimal, ROUND_HALF_UP  # For precise fuel quantity calculations
from datetime import datetime, timezone    # For timestamping transactions

from config.loader import ConfigManager
from config.params import GuiSides, FuelSides
from src.hardware import PumpObject
from src.gui import MainWindow, GuiSideObject, KeypadWindow
from app.database import async_session
from app.crud import drivers as autisti_crud
from app.crud.erogations import createErogation
from app.crud.totals import recordTotals
from app.schemas.erogations import ErogationCreate

# Configure the root logger: INFO level, timestamped messages
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

class Controller:
    """
    The central application controller:
      - Loads configuration for GUI and pumps
      - Sets up GUI and hardware objects for each fuel side
      - Handles RFID authentication flow (card → PIN → vehicle)
      - Manages dispensing sessions and database recording
      - Runs background tasks for hardware updates and resource logging
    """

    def __init__(self):
        # Load configuration manager and parameters
        self.config_manager = ConfigManager()
        _ = self.config_manager.load_config()  # potentially used internally by loader

        # Fuel hardware parameters (side 1 & side 2)
        self.fuel_sides = FuelSides(
            side_1=self.config_manager.get_fuel_parameters(1),
            side_2=self.config_manager.get_fuel_parameters(2),
        )
        # GUI layout and color parameters for each side
        self.gui_sides = GuiSides(
            side_1=self.config_manager.get_gui_parameters(1),
            side_2=self.config_manager.get_gui_parameters(2),
        )
        # Main parameters: display texts, timeouts, etc.
        self.params = self.config_manager.get_main_parameters()

        # Async queue for inter-task communication (hardware → GUI)
        self.q = asyncio.Queue(maxsize=100)

        # Runtime state containers:
        self.sides = {}                  # Maps "side_1"/"side_2" to (GuiSideObject, PumpObject)
        self.validated_drivers = {}      # Records driver per side after RFID workflow
        self.validated_vehicles = {}     # Records vehicle per side
        self.card_validated = False      # Flag indicating an active RFID session
        self._temp_validated_driver = None
        self._temp_validated_vehicle = None
        self.side_selected = None
        self.selection_timeout_task = None
        self.active_tasks = set()        # Track spawned asyncio tasks if needed

        # Initialize the main application window
        self.view = MainWindow(self)

        # Set up each fuel side’s GUI button and pump object
        self.createSides()

    def createSides(self):
        """
        Instantiate PumpObject and GuiSideObject for each configured side:
          - If side exists in both hardware and GUI configs:
              * Create PumpObject (hardware abstraction)
              * Create GuiSideObject (button/labels)
              * Disable button until authentication
              * If pump is in automatic mode, apply special colors and show text
        """
        for i in (1, 2):
            fuel_cfg = getattr(self.fuel_sides, f"side_{i}")
            gui_cfg = getattr(self.gui_sides, f"side_{i}")

            if fuel_cfg.side_exists and gui_cfg.side_exists:
                pump_obj = PumpObject(fuel_cfg, i, self.q)
                gui_obj = GuiSideObject(self.view, gui_cfg, i, self.sideClicked)
                self.sides[f"side_{i}"] = (gui_obj, pump_obj)

                # Automatic mode: color the button accordingly and update label
                if pump_obj.params.automatic_mode:
                    gui_obj.guiparams.button_color = gui_obj.guiparams.automatic_button_color
                    gui_obj.guiparams.button_border_color = gui_obj.guiparams.automatic_button_border_color
                    gui_obj.updateButtonColor(
                        gui_obj.guiparams.button_color,
                        gui_obj.guiparams.button_border_color
                    )
                    # Show "automatic mode" message without blocking
                    self.view.after(0, self.view.updateLabel, self.params.automatic_mode_text)

                # Disable selection until user authenticates with RFID
                gui_obj.button.configure(state="disabled")

    async def cancelTasks(self):
        """
        Cancel all running asyncio tasks except the current one,
        ensuring a clean shutdown without dangling tasks.
        """
        tasks = [
            task for task in asyncio.all_tasks()
            if task is not asyncio.current_task()
        ]
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    async def monitorResources(self):
        """
        Periodically log memory usage and active asyncio task count.
        Interval: every 60 seconds.
        """
        while True:
            proc = psutil.Process()
            mem_mb = proc.memory_info().rss / 1024 / 1024
            task_count = len(asyncio.all_tasks())
            logging.info(f"[RESOURCES] Memory: {mem_mb:.2f} MB, Tasks: {task_count}")
            await asyncio.sleep(60)

    def rfidResponse(self, card_id: str):
        """
        Handler for RFID card scans:
          - If already in an authenticated session, ignore
          - If all sides manual mode, skip validation
          - If no automatic side available, show busy message
          - Otherwise, kick off asynchronous card validation
        """
        if self.card_validated:
            logging.info("[INFO] Card already validated; ignoring new scan.")
            return

        # Skip auth if no pump is in automatic mode
        if not any(side.automatic_mode for side in vars(self.fuel_sides).values()):
            logging.info("[INFO] All pumps manual; no card validation needed.")
            return

        # If every automatic pump is busy or already authorized, notify user
        if all(
            pump.authorized or pump.nozzle_status or not pump.params.automatic_mode
            for (_, pump) in self.sides.values()
        ):
            logging.info("[INFO] All automatic sides occupied.")
            self.view.updateLabel(self.params.all_sides_selected_text)
            self.view.after(3000, self.view.updateLabel, self.params.automatic_mode_text)
            return

        # Proceed to validate the scanned card in background
        asyncio.create_task(self.validateCard(card_id))

    async def validateCard(self, card_id: str):
        """
        Asynchronously look up the driver by card ID.
        Workflow:
          - If driver exists:
              * Optionally prompt for PIN
              * Optionally prompt for vehicle
              * Otherwise, complete authentication
          - If driver not found: show refusal then reset to auto text
        """
        async with async_session() as session:
            driver = await autisti_crud.getDriverByCard(session, card_id)
            if driver:
                logging.info(f"[INFO] Card {card_id} found in DB.")
                self._temp_validated_driver = driver
                if driver.request_pin:
                    await self.promptForPin(driver)
                elif driver.request_vehicle_id:
                    await self.promptForVehicle()
                else:
                    self.handleRfidValidation()
            else:
                logging.info(f"[INFO] Card {card_id} NOT found.")
                self.view.updateLabel(self.params.refused_card_text)
                self.view.after(3000, self.view.updateLabel, self.params.automatic_mode_text)

    async def promptForPin(self, driver):
        """
        Display a keypad for PIN entry (20s timeout).
        On correct PIN: proceed to vehicle prompt or finalize auth.
        On timeout or wrong PIN: show error and reset.
        """
        loop = asyncio.get_event_loop()
        future = loop.create_future()

        def pinCallback(value):
            future.set_result(value)

        keypad = KeypadWindow(self.view, "PIN", self.params.pin_keyboard_text, pinCallback)
        try:
            pin_input = await asyncio.wait_for(future, timeout=20)
        except asyncio.TimeoutError:
            keypad.destroy()
            self.view.updateLabel(self.params.selection_timeout_text)
            await asyncio.sleep(3)
            self.view.updateLabel(self.params.automatic_mode_text)
            return

        if pin_input == driver.pin:
            logging.info(f"[INFO] Correct PIN entered for card {driver.card}.")
            if driver.request_vehicle_id:
                await self.promptForVehicle()
            else:
                self.handleRfidValidation()
        else:
            logging.info(f"[INFO] Incorrect PIN for card {driver.card}.")
            self.view.updateLabel(self.params.pin_error_text)
            await asyncio.sleep(3)
            self.view.updateLabel(self.params.automatic_mode_text)

    async def promptForVehicle(self):
        """
        Prompt for vehicle ID and optional odometer:
          - Vehicle ID entry (20s timeout)
          - Lookup in DB; if not found, error/reset
          - If odometer required: prompt, validate > previous, commit
          - On success: finalize authentication
        """
        loop = asyncio.get_event_loop()
        future = loop.create_future()

        def vehicleCallback(value):
            future.set_result(value)

        keypad = KeypadWindow(self.view, "VEHICLE ID", self.params.vehicle_id_text, vehicleCallback)
        try:
            vehicle_id = await asyncio.wait_for(future, timeout=20)
        except asyncio.TimeoutError:
            keypad.destroy()
            self.view.updateLabel(self.params.selection_timeout_text)
            await asyncio.sleep(3)
            self.view.updateLabel(self.params.automatic_mode_text)
            return

        from app.crud.vehicles import getVehicleById
        async with async_session() as session:
            vehicle = await getVehicleById(session, vehicle_id)
            if not vehicle:
                self.view.updateLabel(self.params.vehicle_not_found_text)
                await asyncio.sleep(3)
                self.view.updateLabel(self.params.automatic_mode_text)
                return

            self._temp_validated_vehicle = vehicle

            # If km entry required, repeat keypad flow
            if getattr(vehicle, "request_vehicle_km", False):
                km_future = loop.create_future()

                def kmCallback(value):
                    km_future.set_result(value)

                keypad_km = KeypadWindow(self.view, "KILOMETERS", self.params.km_prompt_text, kmCallback)
                try:
                    km_str = await asyncio.wait_for(km_future, timeout=20)
                except asyncio.TimeoutError:
                    keypad_km.destroy()
                    self.view.updateLabel(self.params.selection_timeout_text)
                    await asyncio.sleep(3)
                    self.view.updateLabel(self.params.automatic_mode_text)
                    return

                # Validate numeric and increasing odometer
                try:
                    km_value = int(km_str)
                except ValueError:
                    self.view.updateLabel(self.params.km_error_text)
                    await asyncio.sleep(3)
                    self.view.updateLabel(self.params.automatic_mode_text)
                    return

                if km_value <= int(vehicle.vehicle_total_km):
                    self.view.updateLabel(self.params.km_error_text_2)
                    await asyncio.sleep(3)
                    self.view.updateLabel(self.params.automatic_mode_text)
                    return

                vehicle.vehicle_total_km = str(km_value)
                await session.commit()
                logging.info(f"[INFO] Updated vehicle {vehicle_id} km to {km_value}.")

        # Finalize and allow side selection
        self.handleRfidValidation()

    async def registerErogationRecord(self, side_number: int):
        """
        After dispensing completes on side X:
          - Calculate dispensed liters (using pulser counts & calibration)
          - Round to 0.01 L
          - Gather driver/vehicle info from validated state
          - Compute total price
          - Insert totals and erogation record into DB
        Returns the created Erogation record or None on failure.
        """
        gui_obj, pump_obj = self.sides[f"side_{side_number}"]

        # Convert pulser counts to liters, apply calibration, round half-up
        raw_liters = Decimal(pump_obj.pulser_counter) / Decimal(pump_obj.params.pulses_per_liter)
        liters = (raw_liters / Decimal(pump_obj.params.calibration_factor)) \
                    .quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        # Determine if this was an automatic session
        if side_number in self.validated_drivers:
            driver = self.validated_drivers[side_number]
            mode = "automatica"
            card = driver.card
            company = driver.company
            name = driver.driver_full_name
        else:
            mode = "manuale"
            card = company = name = None

        # Vehicle info if provided
        if side_number in self.validated_vehicles:
            veh = self.validated_vehicles[side_number]
            vehicle_id = veh.vehicle_id
            company_vehicle = veh.company_vehicle
            vehicle_km = veh.vehicle_total_km
        else:
            vehicle_id = company_vehicle = vehicle_km = None

        total_price = float(liters) * pump_obj.params.price

        # Build schema object for insertion
        data = ErogationCreate(
            card=card,
            company=company,
            driver_full_name=name,
            vehicle_id=vehicle_id,
            company_vehicle=company_vehicle,
            vehicle_total_km=vehicle_km,
            erogation_side=side_number,
            dispensed_liters=liters,
            dispensed_product=pump_obj.params.product,
            erogation_timestamp=datetime.now(timezone.utc),
            mode=mode,
            total_erogation_price=f"{total_price:.2f}"
        )

        async with async_session() as session:
            try:
                # Update cumulative totals
                await recordTotals(session, dispenser_id=1, side=side_number, liters=liters)
                # Insert the new dispense record
                new_rec = await createErogation(session, data)
                await session.commit()
                logging.info(f"[INFO] Recorded dispense: side {side_number}, {liters} L.")
                return new_rec
            except Exception as e:
                logging.error(f"[ERROR] registerErogationRecord failed: {e}")
                return None

    def handleRfidValidation(self):
        """
        Post-authentication: enable and highlight available automatic-mode sides,
        prompt user to select a side, and start a timeout for their choice.
        """
        self.card_validated = True
        self.view.updateLabel(self.params.select_side_text)
        for side_key, (gui_obj, pump_obj) in self.sides.items():
            if pump_obj.params.automatic_mode and not pump_obj.authorized and not pump_obj.nozzle_status:
                gui_obj.updateButtonColor(
                    gui_obj.guiparams.available_button_color,
                    gui_obj.guiparams.available_button_border_color
                )
                gui_obj.button.configure(state="normal")

        # Start a countdown: user must pick a side before timeout
        self.selection_timeout_task = asyncio.create_task(self.selectionTimeout())

    def resetCardValidation(self):
        """
        Clears all authentication state:
          - Disables side buttons
          - Resets button colors
          - Shows timeout or automatic-mode message
        """
        self.card_validated = False
        self.side_selected = None
        self.view.updateLabel(self.params.selection_timeout_text)
        self.view.after(3000, self.view.updateLabel, self.params.automatic_mode_text)

        for side_key, (gui_obj, pump_obj) in self.sides.items():
            if pump_obj.params.automatic_mode and not pump_obj.pump_is_busy:
                pump_obj.authorized = False
                gui_obj.updateButtonColor(
                    gui_obj.guiparams.button_color,
                    gui_obj.guiparams.button_border_color
                )
                gui_obj.button.configure(state="disabled")

        if self.selection_timeout_task:
            self.selection_timeout_task.cancel()

    async def selectionTimeout(self):
        """
        Waits for the configured selection_time, then resets validation
        if no side was chosen.
        """
        await asyncio.sleep(self.params.selection_time)
        logging.info("[INFO] Selection timeout reached; resetting auth.")
        self.resetCardValidation()

    def sideClicked(self, side_number: int):
        """
        Callback when a side button is clicked:
          - Confirms that a card/session is active
          - Stores validated driver/vehicle for this side
          - Authorizes the pump and disables other buttons
          - Resets label and RFID focus
        """
        if not self.card_validated or self._temp_validated_driver is None:
            logging.warning("[WARNING] sideClicked called without valid session.")
            return

        # Assign confirmed driver/vehicle to this side
        self.validated_drivers[side_number] = self._temp_validated_driver
        self.validated_vehicles[side_number] = self._temp_validated_vehicle
        self._temp_validated_driver = None
        self._temp_validated_vehicle = None

        logging.info(f"[INFO] Side {side_number} selected.")
        self.side_selected = side_number

        # Enable only the chosen pump
        for key, (gui_obj, pump_obj) in self.sides.items():
            num = int(key.split("_")[1])
            if num == side_number and pump_obj.params.automatic_mode:
                pump_obj.authorized = True
            else:
                gui_obj.updateButtonColor(
                    gui_obj.guiparams.button_color,
                    gui_obj.guiparams.button_border_color
                )
            gui_obj.button.configure(state="disabled")

        # Reset authentication flag and show main automatic text
        self.card_validated = False
        self.view.updateLabel(self.params.automatic_mode_text)
        self.view.rfid_entry.focus_set()

    async def sendPresetToPump(self, value: int):
        """
        When user inputs a preset volume:
          - Send that preset to all inactive pumps
          - Update each GUI preset label
        """
        for gui_obj, pump_obj in self.sides.values():
            if pump_obj.params.side_exists and not pump_obj.nozzle_status:
                if value is None:
                    logging.info("[INFO] Clearing presets.")
                    pump_obj.preset_value = 0
                else:
                    logging.info(f"[INFO] Setting preset: {value} L.")
                    pump_obj.setPreset(value)
                gui_obj.updatePreset(pump_obj.preset_value)

    async def resetPresetOnInactiveSides(self, active_side: int):
        """
        Clear preset values on all sides except the one currently dispensing.
        """
        for key, (gui_obj, pump_obj) in self.sides.items():
            num = int(key.split("_")[1])
            if pump_obj.params.side_exists and num != active_side and not pump_obj.nozzle_status:
                pump_obj.preset_value = 0
                await pump_obj.cancelPresetTasks()
                logging.info("[INFO] Preset reset on inactive side.")
                gui_obj.updatePreset(pump_obj.preset_value)

    async def processQupdates(self):
        """
        Continuously consume hardware events from self.q:
          - endErogation → record to DB
          - resetPreset → clear presets on other sides
          - updateLiters → refresh GUI display
          - updateButtonColor / resetButtonColor → reflect nozzle state
          - cancelTimeout → stop selection timer when dispensing begins
        """
        while True:
            update = await self.q.get()
            action, *args = update

            if action == "endErogation":
                await self.registerErogationRecord(args[0])
            elif action == "resetPreset":
                await self.resetPresetOnInactiveSides(args[0])
            elif action == "updateLiters":
                side_num, liters = args
                gui_obj, _ = self.sides[f"side_{side_num}"]
                self.view.after(0, gui_obj.updateLiters, liters)
            elif action == "updateButtonColor":
                side_num = args[0]
                gui_obj, _ = self.sides[f"side_{side_num}"]
                self.view.after(
                    0,
                    gui_obj.updateButtonColor,
                    gui_obj.guiparams.busy_button_color,
                    gui_obj.guiparams.busy_button_border_color
                )
            elif action == "resetButtonColor":
                side_num = args[0]
                gui_obj, _ = self.sides[f"side_{side_num}"]
                self.view.after(
                    0,
                    gui_obj.updateButtonColor,
                    gui_obj.guiparams.button_color,
                    gui_obj.guiparams.button_border_color
                )
            elif action == "cancelTimeout":
                if self.selection_timeout_task:
                    self.selection_timeout_task.cancel()

    async def run(self):
        """
        Entry point to start the main event loop:
          - GUI mainloop
          - Hardware queue processing
          - Resource monitoring
        Cleans up on exception or shutdown.
        """
        logging.info(f"[INFO] Starting main loop. Async running: {asyncio.get_event_loop().is_running()}")
        try:
            await asyncio.gather(
                self.view.run(),
                self.processQupdates(),
                self.monitorResources()
            )
        except Exception as e:
            logging.error(f"[ERROR] Exception in run(): {e}")
        finally:
            await self.cleanup()

    async def cleanup(self):
        """
        Gracefully release resources on shutdown:
          - Close each PumpObject (GPIO cleanup)
          - Cancel any outstanding asyncio tasks
        """
        logging.info("[INFO] Cleaning up resources.")
        for _, pump in self.sides.values():
            pump.close()
        await self.cancelTasks()

if __name__ == "__main__":
    controller = Controller()
    loop = asyncio.get_event_loop()
    try:
        # Run the controller until completion or KeyboardInterrupt
        loop.run_until_complete(controller.run())
    except KeyboardInterrupt:
        logging.info("[INFO] Shutdown requested via KeyboardInterrupt.")
    finally:
        # Ensure cleanup and loop closure
        loop.run_until_complete(controller.cleanup())
        loop.close()
        logging.info("[INFO] Event loop closed.")

