import asyncio
import logging
import psutil
from decimal import Decimal, ROUND_HALF_UP
from src.config.loader import ConfigManager
from src.hardware import PumpObject
from src.gui import MainWindow, GuiSideObject, KeypadWindow
from src.config.params import GuiSides, FuelSides
from app.database import async_session
from app.crud import drivers as autisti_crud
from app.crud.erogations import createErogation
from app.crud.totals import recordTotals
from app.schemas.erogations import ErogationCreate
from datetime import datetime, timezone
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

class Controller:
    def __init__(self):
        self.config_manager = ConfigManager()
        config = self.config_manager.load_config()
        
        self.fuel_sides = FuelSides(
            side_1=self.config_manager.get_fuel_parameters(1),
            side_2=self.config_manager.get_fuel_parameters(2)
        )

        self.gui_sides = GuiSides(
            side_1=self.config_manager.get_gui_parameters(1),
            side_2=self.config_manager.get_gui_parameters(2)
        )

        self.params = self.config_manager.get_main_parameters()
        self.q = asyncio.Queue(maxsize=100)
        self.sides = {}
        self.validated_drivers = {}
        self.validated_vehicles = {}
        self.view = MainWindow(self)
        self.card_validated = False
        self._temp_validated_driver = None
        self._temp_validated_vehicle = None
        self.side_selected = None
        self.selection_timeout_task = None
        self.active_tasks = set()

        self.createSides()

    def createSides(self):
        for i in range(1, 3):
            fuel_side = getattr(self.fuel_sides, f"side_{i}")
            gui_side = getattr(self.gui_sides, f"side_{i}")

            if fuel_side.side_exists and gui_side.side_exists:
                pump_obj = PumpObject(fuel_side, i, self.q)
                gui_obj = GuiSideObject(self.view, gui_side, i, self.sideClicked)
                self.sides[f"side_{i}"] = (gui_obj, pump_obj)

                if pump_obj.params.automatic_mode:
                    gui_obj.guiparams.button_color = gui_obj.guiparams.automatic_button_color
                    gui_obj.guiparams.button_border_color = gui_obj.guiparams.automatic_button_border_color
                    gui_obj.updateButtonColor(gui_obj.guiparams.button_color, gui_obj.guiparams.button_border_color)
                    self.view.after(0, self.view.updateLabel, self.params.automatic_mode_text)
 
                gui_obj.button.configure(state="disabled")

    async def cancelTasks(self):
        tasks = [task for task in asyncio.all_tasks() if task is not asyncio.current_task()]
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    async def monitorResources(self):
        while True:
            memory_usage = psutil.Process().memory_info().rss / 1024 / 1024
            task_count = len(asyncio.all_tasks())
            logging.info(f"[RESOURCES]: Memory usage: {memory_usage:.2f} MB, active tasks: {task_count}") 
            await asyncio.sleep(60)

    def rfidResponse(self, card_id):
        if self.card_validated:
            logging.info("[INFO]: Card already validated, skipping validation.")
            return
        
        if not any(side.automatic_mode for side in vars(self.fuel_sides).values()):
            logging.info("[INFO]: All sides in manual mode, skipping card validation.")
            return

        if all(pump_obj.authorized or pump_obj.nozzle_status or not pump_obj.params.automatic_mode for _, pump_obj in self.sides.values()):
            logging.info("[INFO]: All sides occupied, skipping card validation.")
            self.view.updateLabel("TUTTI I LATI SELEZIONATI, ATTENDI")
            self.view.after(3000, self.view.updateLabel, self.params.automatic_mode_text)
            return

        asyncio.create_task(self.validateCard(card_id))

    async def validateCard(self, card_id: str):
        async with async_session() as session:
            driver = await autisti_crud.getDriverByCard(session, card_id)
            if driver:
                logging.info(f"[INFO]: Card found in the DB: {card_id}")
                self._temp_validated_driver = driver
                if driver.request_pin:
                    await self.promptForPin(driver)
                elif driver.request_vehicle_id:
                    await self.promptForVehicle(driver)
                else:
                    self.handleRfidValidation()
            else:
                logging.info(f"[INFO]: Card not found in the DB: {card_id}")
                self.view.updateLabel(self.params.refused_card_text)
                self.view.after(3000, self.view.updateLabel, self.params.automatic_mode_text)

    async def promptForPin(self, driver):
        future = asyncio.get_event_loop().create_future()

        def pinCallback(value):
            future.set_result(value)
        
        keypad_window = KeypadWindow(self.view, "Inserisci PIN", "Inserisci il PIN:", pinCallback)
    
        try:
            pin_input = await asyncio.wait_for(future, timeout=20)
        except asyncio.TimeoutError:
            keypad_window.destroy()
            self.view.updateLabel("TEMPO SCADUTO")
            await asyncio.sleep(3)
            self.view.updateLabel(self.params.automatic_mode_text)
            return
        
        if pin_input == driver.pin:
            logging.info(f"[INFO]: Pin correct: {pin_input} for driver: {driver.card_number}.")
            if driver.request_vehicle_id:
                await self.promptForVehicle()
            else:
                self.handleRfidValidation()
        else:
            logging.info(f"[INFO]: Wrong Pin: {pin_input} for driver {driver.card_number}.")
            self.view.updateLabel("PIN ERRATO")
            await asyncio.sleep(3)
            self.view.updateLabel(self.params.automatic_mode_text)

    async def promptForVehicle(self):
        future = asyncio.get_event_loop().create_future()

        def vehicleCallback(value):
            future.set_result(value)
            
        keypad_window = KeypadWindow(self.view, "Inserisci ID vehicle", "Inserisci l'ID del vehicle:", vehicleCallback)

        try:
            vehicle_id = await asyncio.wait_for(future, timeout=20)
        except asyncio.TimeoutError:
            keypad_window.destroy()
            self.view.updateLabel("TEMPO SCADUTO")
            await asyncio.sleep(3)
            self.view.updateLabel(self.params.automatic_mode_text)
            return

        from app.crud.veichles import getVehicleById

        async with async_session() as session:
            vehicle = await getVehicleById(session, vehicle_id) 

            if not vehicle:
                self.view.updateLabel("vehicle NON TROVATO")
                await asyncio.sleep(3)
                self.view.updateLabel(self.params.automatic_mode_text)
                return
            
            self._temp_validated_vehicle = vehicle

            if getattr(vehicle, "request_vehicle_km", False):
                future_km = asyncio.get_event_loop().create_future()

                def kmCallback(value):
                    future_km.set_result(value)

                keypad_window = KeypadWindow(self.view, "Inserisci KM", "Inserisci i KM attuali:", kmCallback)

                try:
                    km_str = await asyncio.wait_for(future_km, timeout=20)

                    try:
                        km_value = int(km_str)
                    except ValueError:
                        self.view.updateLabel("KM NON VALIDI")
                        await asyncio.sleep(3)
                        self.view.updateLabel(self.params.automatic_mode_text)
                        return
                    
                    if km_value <= int(vehicle.vehicle_total_km):
                        self.view.updateLabel("KM INSERITI TROPPO BASSI")
                        await asyncio.sleep(3)
                        self.view.updateLabel(self.params.automatic_mode_text)
                        return
                    
                    vehicle.vehicle_total_km = str(km_value)
                    await session.commit()
                    logging.info(f"[INFO]: vehicle updated with new km: {km_value}") 
                    
                except asyncio.TimeoutError:
                    keypad_window.destroy()
                    self.view.updateLabel("TEMPO SCADUTO")
                    await asyncio.sleep(3)
                    self.view.updateLabel(self.params.automatic_mode_text)
                    return
                
            self.handleRfidValidation()

    async def registerErogationRecord(self, side_number: int):
        _, pump_obj = self.sides.get(f"side_{side_number}")
        
        liters = Decimal(pump_obj.pulser_counter) / Decimal(pump_obj.params.pulses_per_liter)
        liters = (liters / Decimal(pump_obj.params.calibration_factor)) \
                    .quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        driver = self.validated_drivers.get(side_number)
        if driver:
            driver = self.validated_drivers[side_number]
            mode = "automatica"
            card = driver.card
            company = driver.company
            driver_full_name = driver.driver_full_name
        else:
            mode = "manuale"
            card = None
            company = None
            driver_full_name = None

        vehicle = self.validated_vehicles.get(side_number)
        if vehicle:
            vehicle_id       = vehicle.vehicle_id
            company_vehicle  = vehicle.company_vehicle
            vehicle_total_km = vehicle.vehicle_total_km
        else:
            vehicle_id = company_vehicle = vehicle_total_km = None

        total_price = float(liters) * pump_obj.params.price

        erogation_data = ErogationCreate(
            card = card,
            company = company,
            driver_full_name = driver_full_name,
            vehicle_id = vehicle_id,
            company_vehicle = company_vehicle,
            vehicle_total_km = vehicle_total_km,
            erogation_side = side_number,
            dispensed_liters = liters,
            dispensed_product = pump_obj.params.product,
            erogation_timestamp = datetime.now(timezone.utc),
            mode = mode,
            total_erogation_price = f"{total_price:.2f}"
        )

        async with async_session() as session:
            try:
                await recordTotals(
                    session,
                    dispenser_id=1,
                    side=side_number,
                    liters=liters
                )

                new_record = await createErogation(session, erogation_data)

                await session.commit()

                logging.info(
                    f"[INFO]: New dispense record and totalizer updated for side: {side_number}: "
                    f"{liters}L"
                )
                return new_record

            except Exception as e:
                logging.error(f"[ERROR]: Error occoured, exception catched in registerErogationRecord: {e}")
                return None

    def handleRfidValidation(self):   
        self.card_validated = True
        self.view.updateLabel(self.params.select_side_text)
        for side, (gui_obj, pump_obj) in self.sides.items():
            if pump_obj.params.automatic_mode and not pump_obj.authorized and not pump_obj.nozzle_status:
                gui_obj.updateButtonColor(gui_obj.guiparams.available_button_color, gui_obj.guiparams.available_button_border_color)
                gui_obj.button.configure(state="normal")
        self.selection_timeout_task = asyncio.create_task(self.selectionTimeout())

    def resetCardValidation(self):
        self.card_validated = False
        self.side_selected = None
        self.view.updateLabel(self.params.selection_timeout_text)
        self.view.after(3000, self.view.updateLabel, self.params.automatic_mode_text)
        for side, (gui_obj, pump_obj) in self.sides.items():
            if pump_obj.params.automatic_mode and not pump_obj.pump_is_busy:
                pump_obj.authorized = False
                gui_obj.updateButtonColor(gui_obj.guiparams.button_color, gui_obj.guiparams.button_border_color)
                gui_obj.button.configure(state="disabled")
        if self.selection_timeout_task:
            self.selection_timeout_task.cancel()

    async def selectionTimeout(self):
        await asyncio.sleep(self.params.selection_time)
        logging.info("[INFO]: Timeout reached, resetting card validation.") 
        self.resetCardValidation()

    def sideClicked(self, side_number):
        if not self.card_validated:
            logging.warning("[WARNING]: Button side clicked without card validation.")
            return
        
        if self._temp_validated_driver is None:
            logging.warning("[WARNING]: No driver found in temporary variable.")
            return

        self.validated_drivers[side_number] = self._temp_validated_driver
        self.validated_vehicles[side_number] = self._temp_validated_vehicle

        self._temp_validated_driver = None
        self._temp_validated_vehicle = None

        logging.info(f"[INFO]: Side selected: {side_number}")
        self.side_selected = side_number

        for side, (gui_obj, pump_obj) in self.sides.items():
            current_side = int(side.split("_")[1])
            if current_side == side_number and pump_obj.params.automatic_mode:
                pump_obj.authorized = True
            elif current_side != side_number and not pump_obj.authorized and not pump_obj.nozzle_status:
                gui_obj.updateButtonColor(gui_obj.guiparams.button_color, gui_obj.guiparams.button_border_color)
            gui_obj.button.configure(state="disabled")
        
        self.card_validated = False
        self.view.updateLabel(self.params.automatic_mode_text)
        self.view.rfid_entry.focus_set()

    async def sendPresetToPump(self, value):
        for _, (gui_obj, pump_obj) in self.sides.items():
            if pump_obj.params.side_exists and not pump_obj.nozzle_status:
                if value is None:
                    logging.info("[INFO]: Preset deleted.")
                    pump_obj.preset_value = 0
                else:
                    logging.info(f"[INFO]: Setting preset to value: {value}L")
                    pump_obj.setPreset(value)
                gui_obj.updatePreset(pump_obj.preset_value)

    async def resetPresetOnInactiveSides(self, active_side): 
        for side, (gui_obj, pump_obj) in self.sides.items():
            if pump_obj.params.side_exists and side != f"side_{active_side}" and not pump_obj.nozzle_status:
                pump_obj.preset_value = 0
                await pump_obj.cancelPresetTasks()
                logging.info("[INFO]: Preset reset on inactive sides.")
                gui_obj.updatePreset(pump_obj.preset_value)

    async def processQupdates(self):
        updates = []
        while True:
            update = await self.q.get()
            updates.append(update)
            await asyncio.sleep(0.5)
            while not self.q.empty():
                updates.append(await self.q.get())
            for action, *args in updates:
                if action == "endErogation":
                    if f"side_{args[0]}" in self.sides:
                        side_number = args[0]
                        await self.registerErogationRecord(side_number)
                elif action == "resetPreset":
                    active_side = args[0]
                    await self.resetPresetOnInactiveSides(active_side)
                elif action == "updateLiters":
                    if f"side_{args[0]}" in self.sides:
                        gui_obj, _ = self.sides[f"side_{args[0]}"]
                        self.view.after(0, gui_obj.updateLiters, args[1])
                elif action == "updateButtonColor":
                    if f"side_{args[0]}" in self.sides:
                        gui_obj, _ = self.sides[f"side_{args[0]}"]
                        self.view.after(0, gui_obj.updateButtonColor, gui_obj.guiparams.busy_button_color, gui_obj.guiparams.busy_button_border_color)
                elif action == "resetButtonColor":
                    if f"side_{args[0]}" in self.sides:
                        gui_obj, _ = self.sides[f"side_{args[0]}"]
                        self.view.after(0, gui_obj.updateButtonColor, gui_obj.guiparams.button_color, gui_obj.guiparams.button_border_color)
                elif action == "cancelTimeout":
                    if self.selection_timeout_task:
                        self.selection_timeout_task.cancel()
                        self.selection_timeout_task = None
            updates.clear()

    async def run(self):
        logging.info(f"[INFO]: Main loop started: {asyncio.get_event_loop().is_running()}")
        try:
            await asyncio.gather(
                self.view.run(),
                self.processQupdates(),
                self.monitorResources()
            )
        except Exception as e:
            logging.error(f"[ERROR]: Exception in main loop: {e}")
        finally:
            await self.cleanup()

    async def cleanup(self):
        logging.info("[INFO]: Cleaning resources.")
        for _, pump in self.sides.values():
            pump.close()
        await self.cancelTasks()


if __name__ == "__main__":
    controller = Controller()
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(controller.run())
    except KeyboardInterrupt:
        logging.info("[INFO]: Controller stopped by keyboard interrupt.")
    finally:
        logging.info("[INFO]: Cleaning all tasks.")
        loop.run_until_complete(controller.cleanup())
        loop.close()
        logging.info("[INFO]: Loop closed correctly.")