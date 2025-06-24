# hardware.py
# Manages low-level control of a fuel pump side via pigpio,
# including flow measurement, nozzle detection, preset monitoring,
# and dispense control/preset cancellation.

import asyncio              # Async tasks and event loop
import pigpio               # GPIO control library for Raspberry Pi
import logging              # Logging for diagnostics

# Configure logging: INFO level with timestamp and severity
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

class PumpObject:
    """
    Abstraction for a single pump side:
      - Configures GPIO pins (flow pulser, nozzle switch, relay)
      - Tracks pulses to measure flow
      - Detects nozzle up/down events
      - Handles preset volume logic
      - Manages dispense start/stop and communicates with Controller via queue
    """
    def __init__(self, params, side_number, q):
        """
        Initialize hardware interface and state:
          - params: pump configuration (pin numbers, calibration, mode, etc.)
          - side_number: identifier for logging and queue events
          - q: asyncio.Queue for sending events back to Controller
        """
        self.params = params
        self.side_number = side_number
        self.q = q
        self.loop = asyncio.get_event_loop()

        # Attempt to connect to the pigpio daemon
        try:
            self.pi = pigpio.pi()
        except Exception as e:
            logging.error(f"[ERROR]: exception raised while initializing gpio pins for side {self.side_number}: {e}")
            self.pi = None

        # If connected, set up GPIO; otherwise disable hardware interactions
        if self.pi and self.pi.connected:
            logging.info(f"[INFO]: gpio initialized successfully for side {self.side_number}.")
            try:
                self.setupGpio()
            except Exception as e:
                logging.error(f"[ERROR]: gpio configuration failed for side {self.side_number}: {e}")
        else:
            logging.warning(f"[WARNING]: PIGPIO not working for side {self.side_number}")
            self.pi = None

        # Runtime state variables
        self.nozzle_status = False       # True when nozzle is lifted
        self.pump_is_busy = False        # True when dispensing is active
        self.pulser_counter = 0          # Counts pulses from the flow sensor
        self.task = None                 # Reference to the main dispense task
        self.preset_task = None          # Task monitoring when preset volume reached
        self.sim_counter_task = None     # Task generating simulated pulses (if enabled)
        self.data_rendering_task = None  # Task sending updated liters to GUI
        self.preset_value = 0            # User-defined preset volume (in liters)
        self.authorized = False          # Flag set by Controller for automatic mode
        self.erogation_strted = False    # True if a dispense session has started

        # Determine correct logic level for nozzle sensor
        self.checkNozzlePolarity()

    def setupGpio(self):
        """
        Configure GPIO pins:
          - pulser_pin: input with callback on falling edge
          - nozzle_pin: input with callback on either edge, with debounce
          - relay_pin: output to control pump relay (initially off)
        """
        if self.pi:
            # Flow sensor input pin
            self.pi.set_mode(self.params.pulser_pin, pigpio.INPUT)
            self.pi.set_pull_up_down(self.params.pulser_pin, pigpio.PUD_UP)
            self.pi.callback(self.params.pulser_pin, pigpio.FALLING_EDGE, self.updateCounter)

            # Nozzle switch input pin
            self.pi.set_mode(self.params.nozzle_pin, pigpio.INPUT)
            self.pi.set_pull_up_down(self.params.nozzle_pin, pigpio.PUD_UP)
            self.pi.callback(self.params.nozzle_pin, pigpio.EITHER_EDGE, self.handleNozzles)
            # Debounce on nozzle switch
            self.pi.set_glitch_filter(self.params.nozzle_pin, self.params.nozzle_debounce_us)

            # Relay control output pin
            self.pi.set_mode(self.params.relay_pin, pigpio.OUTPUT)
            self.pi.write(self.params.relay_pin, 0)
            logging.info(f"[DEBUG]: correct PIGPIO configuration for side {self.side_number}")

    def checkNozzlePolarity(self):
        """
        Set expected signal levels for nozzle 'up' vs 'down'.
        Some hardware may invert the switch polarity.
        """
        if self.params.reverse_nozzle_polarity:
            self.high = pigpio.LOW
            self.low = pigpio.HIGH
        else:
            self.high = pigpio.HIGH
            self.low = pigpio.LOW

    def updateCounter(self, gpio, level, tick):
        """
        Callback for pulser_pin pulses. Each falling-edge increments the counter.
        """
        self.pulser_counter += 1

    def handleNozzles(self, gpio, level, tick):
        """
        Callback for nozzle switch changes:
          - If level==high: nozzle lifted → start dispensing
          - If level==low: nozzle placed back → stop dispensing
        """
        if level == self.high:
            self.loop.create_task(self.nozzleUp())
        elif level == self.low:
            self.loop.create_task(self.nozzleDown())

    def setPreset(self, liters):
        """
        Store a user-specified preset volume and begin monitoring.
        Cancels any previous preset task.
        """
        self.preset_value = liters
        if self.preset_task and not self.preset_task.done():
            self.preset_task.cancel()
        self.preset_task = asyncio.create_task(self.monitorPreset())

    async def simCounter(self):
        """
        Simulate pulser pulses in test mode:
        Generates fake pulses and GUI updates at configured frequency.
        """
        try:
            while self.pump_is_busy:
                await asyncio.sleep(1 / self.params.simulation_frequency)
                self.pulser_counter += 1
                liters = self.pulser_counter / (self.params.pulses_per_liter * self.params.calibration_factor)
                await self.q.put(("updateLiters", self.side_number, liters))
        except asyncio.CancelledError:
            logging.info(f"[INFO]: simulation counter task cancelled for side {self.side_number}")

    async def cancelDispensingTasks(self):
        """
        Cancel ongoing dispensing subtasks if active.
        """
        if self.task and not self.task.done():
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                logging.info(f"[INFO]: dispensing task cancelled for side {self.side_number}")

    async def cancelPresetTasks(self):
        """
        Cancel the preset monitoring task, if running.
        """
        if self.preset_task and not self.preset_task.done():
            self.preset_task.cancel()
            try:
                await self.preset_task
            except asyncio.CancelledError:
                logging.info(f"[INFO]: preset task cancelled for side {self.side_number}")

    async def cancelSimCounterTasks(self):
        """
        Cancel the simulated counter task, if running.
        """
        if self.sim_counter_task and not self.sim_counter_task.done():
            self.sim_counter_task.cancel()
            try:
                await self.sim_counter_task
            except asyncio.CancelledError:
                logging.info(f"[INFO]: sim counter task cancelled for side {self.side_number}")

    async def cancelDataRenderingTasks(self):
        """
        Cancel the GUI-update task, if running.
        """
        if self.data_rendering_task and not self.data_rendering_task.done():
            self.data_rendering_task.cancel()
            try:
                await self.data_rendering_task
            except asyncio.CancelledError:
                logging.info(f"[INFO]: data rendering task cancelled for side {self.side_number}")

    async def monitorPreset(self):
        """
        While dispensing, watch for pulser_counter ≥ preset threshold.
        If reached, automatically stop dispensing.
        """
        try:
            threshold = self.preset_value * self.params.pulses_per_liter * self.params.calibration_factor
            while self.preset_value and self.pump_is_busy:
                if self.pulser_counter >= threshold:
                    logging.info(f"[INFO]: preset reached on side {self.side_number}")
                    await self.cancelDispensingTasks()
                    self.task = asyncio.create_task(self.stopErogation())
                    break
                await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            logging.info(f"[INFO]: preset monitoring task cancelled for side {self.side_number}")

    async def nozzleUp(self):
        """
        Handle nozzle lifted event:
          - Mark status, reset other presets, update GUI
          - In automatic mode, only proceed if authorized
          - Start the dispensing sequence
        """
        logging.info(f"[INFO]: nozzle raised for side {self.side_number}")
        self.nozzle_status = True
        await self.q.put(("resetPreset", self.side_number))
        await self.q.put(("updateButtonColor", self.side_number))
        if self.params.automatic_mode and not self.authorized:
            logging.info(f"[INFO]: unauthorized dispense attempt on side {self.side_number}")
            return
        await self.cancelDispensingTasks()
        self.task = asyncio.create_task(self.startErogation())

    async def nozzleDown(self):
        """
        Handle nozzle placed back event:
          - Clear status
          - If pump was busy, end dispensing
        """
        logging.info(f"[INFO]: nozzle lowered for side {self.side_number}")
        self.nozzle_status = False
        if self.pump_is_busy:
            await self.cancelDispensingTasks()
            self.task = asyncio.create_task(self.stopErogation())

    async def monitorCounter(self):
        """
        Periodically send updated liters to the Controller for UI.
        """
        try:
            while self.pump_is_busy:
                liters = self.pulser_counter / (self.params.pulses_per_liter * self.params.calibration_factor)
                await self.q.put(("updateLiters", self.side_number, liters))
                await asyncio.sleep(self.params.ui_update_interval)
        except asyncio.CancelledError:
            logging.info(f"[INFO]: counter monitor task cancelled for side {self.side_number}")

    async def startErogation(self):
        """
        Main dispensing logic:
          - Activate relay to start pump motor
          - Set busy flag and record start
          - Cancel any Controller selection timeout
          - Launch GUI update and simulation tasks
          - Enforce safety timeout if no flow detected
        """
        # Reset counters and flags
        self.pulser_counter = 0
        self.pump_is_busy = True
        logging.info(f"[INFO]: dispensing started for side {self.side_number}")
        if self.pi:
            self.pi.write(self.params.relay_pin, 1)
        self.erogation_strted = True

        # Notify Controller to cancel its session timeout
        await self.q.put(("cancelTimeout", self.side_number))

        # Start GUI update and simulation if enabled
        self.data_rendering_task = asyncio.create_task(self.monitorCounter())
        if self.params.simulation_pulser:
            self.sim_counter_task = asyncio.create_task(self.simCounter())
            logging.info(f"[INFO]: simulation counter started for side {self.side_number}")

        # Safety: stop if no pulses within configured time
        await self.checkMaxTiming()

    async def stopErogation(self):
        """
        Stop dispensing cleanly:
          - Deactivate relay
          - Reset preset and internal tasks
          - Notify Controller to record the transaction
        """
        self.pump_is_busy = False
        await self.q.put(("resetPreset", None))
        logging.info(f"[INFO]: dispensing finished for side {self.side_number}")
        if self.pi:
            self.pi.write(self.params.relay_pin, 0)

        # Clear preset and cancel related tasks
        self.preset_value = 0
        await self.cancelPresetTasks()
        await self.cancelSimCounterTasks()

        # Give time for any final pulses
        await asyncio.sleep(1)
        await self.cancelDataRenderingTasks()

        # Inform Controller to register end of erogation
        if self.erogation_strted:
            await self.q.put(("endErogation", self.side_number))
        self.erogation_strted = False

    async def checkMaxTiming(self):
        """
        Safety feature: if no pulses detected within a timeout,
        automatically stop dispensing to prevent pump damage.
        """
        await asyncio.sleep(self.params.timeout_reached_without_dispensing)
        if self.pulser_counter == 0:
            await self.stopErogation()

    def close(self):
        """
        Clean up hardware resources on shutdown:
          - Turn off relay
          - Stop pigpio connection
        """
        if self.pi:
            self.pi.write(self.params.relay_pin, 0)
            self.pi.stop()
            logging.info(f"[INFO]: gpio resources released for side {self.side_number}.")

