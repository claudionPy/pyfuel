import asyncio
import pigpio
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

class PumpObject:
    def __init__(self, params, side_number, q):
        self.params = params 
        self.side_number = side_number 
        self.q = q 
        self.loop = asyncio.get_event_loop() 

        try:
            self.pi = pigpio.pi()
        except Exception as e:
            logging.error(f"[ERROR]: exception raised while initializing gpio pins for side {self.side_number}: {e}")
            self.pi = None

        if self.pi and self.pi.connected:
            logging.info(f"[INFO]: gpio initialized successfully for side {self.side_number}.")
            try:
                self.setupGpio() 
            except Exception as e:
                logging.error(f"[ERROR]: gpio configuration failed for side {self.side_number}: {e}")
        else:
            logging.warning(f"[WARNING]: PIGPIO not working for side {self.side_number}")
            self.pi = None 

        self.nozzle_status = False 
        self.pump_is_busy = False 
        self.pulser_counter = 0 
        self.task = None 
        self.preset_task = None 
        self.sim_counter_task = None 
        self.data_rendering_task = None 
        self.preset_value = 0 
        self.authorized = False 
        self.erogation_strted = False  
        
        self.checkNozzlePolarity() 

    def setupGpio(self):
        if self.pi: 
            self.pi.set_mode(self.params.pulser_pin, pigpio.INPUT) 
            self.pi.set_pull_up_down(self.params.pulser_pin, pigpio.PUD_UP) 
            self.pi.callback(self.params.pulser_pin, pigpio.FALLING_EDGE, self.updateCounter) 

            self.pi.set_mode(self.params.nozzle_pin, pigpio.INPUT) 
            self.pi.set_pull_up_down(self.params.nozzle_pin, pigpio.PUD_UP) 
            self.pi.callback(self.params.nozzle_pin, pigpio.EITHER_EDGE, self.handleNozzles) 
            self.pi.set_glitch_filter(self.params.nozzle_pin, 100000) 

            self.pi.set_mode(self.params.relay_pin, pigpio.OUTPUT) 
            self.pi.write(self.params.relay_pin, 0) 
            logging.info(f"[DEBUG]: correct PIGPIO configuration for the side {self.side_number}")

    def checkNozzlePolarity(self):
        if self.params.reverse_nozzle_polarity: 
            self.high = pigpio.LOW 
            self.low = pigpio.HIGH 
        else:
            self.high = pigpio.HIGH 
            self.low = pigpio.LOW 

    def updateCounter(self, gpio, level, tick):
        if self.pump_is_busy: 
            self.pulser_counter += 1 
            logging.info(f"[INFO]: counter: {self.pulser_counter:.2f}") 

    async def simCounter(self):
        await asyncio.sleep(10) 
        logging.info("[INFO]: no physical impulse detected, start simulation") 
        if self.pulser_counter == 0: 
            while True:
                self.pulser_counter += 1 
                logging.info(f"[INFO]: sim counter: {self.pulser_counter:.2f}")
                await asyncio.sleep(0.1) 

    def handleNozzles(self, gpio, level, tick):
        if not self.loop or not self.loop.is_running(): 
            logging.error(f"[ERROR]: loop not active for side {self.side_number}.")
            return 
        
        if level == self.high: 
            self.loop.create_task(self.nozzleUp()) 
        elif level == self.low: 
            self.loop.create_task(self.nozzleDown()) 

    def setPreset(self, liters):
        self.preset_value += liters 
        logging.info(f"[INFO]: preset set to: {self.preset_value} L, for side {self.side_number}")
    
    async def cancelDispensingTasks(self):
        if self.task and not self.task.done(): 
            self.task.cancel() 
            try:
                await self.task
            except asyncio.CancelledError: 
                logging.info(f"[INFO]: Dispensing task cancelled for side {self.side_number}.")

    async def cancelPresetTasks(self):
        if self.preset_task and not self.preset_task.done(): 
            self.preset_task.cancel() 
            try:
                await self.preset_task
            except asyncio.CancelledError: 
                logging.info(f"[INFO]: preset task cancelled for side {self.side_number}")
        logging.info(f"[INFO]: preset set to 0 for side {self.side_number}")

    async def cancelSimCounterTasks(self):
        if self.sim_counter_task and not self.sim_counter_task.done(): 
            self.sim_counter_task.cancel() 
            try:
                await self.sim_counter_task
            except asyncio.CancelledError: 
                logging.info(f"[INFO]: sim counter task cancelled for side {self.side_number}")

    async def cancelDataRenderingTasks(self):
        if self.data_rendering_task and not self.data_rendering_task.done(): 
            self.data_rendering_task.cancel() 
            try:
                await self.data_rendering_task
            except asyncio.CancelledError: 
                logging.info(f"[INFO]: rendering task data cancelled for side {self.side_number}")

    async def monitorPreset(self):
        try:
            while self.preset_value and self.pump_is_busy: 
                await asyncio.sleep(0.1) 
                preset = self.preset_value * self.params.pulses_per_liter * self.params.calibration_factor 
                if self.pulser_counter >= preset: 
                    logging.info(f"[INFO]: preset reached, stop dispensing for the side {self.side_number}")
                    await self.cancelDispensingTasks() 
                    self.task = asyncio.create_task(self.stopErogation()) 
                    break 
        except asyncio.CancelledError: 
            logging.info(f"[INFO]: preset monitoring task cancelled for side {self.side_number}.")

    async def nozzleUp(self):
        logging.info(f"[INFO]: nozzle raised for side {self.side_number}")
        self.nozzle_status = True 
        await self.q.put(("resetPreset", self.side_number)) 
        await self.q.put(("updateButtonColor", self.side_number)) 
        if self.params.automatic_mode and not self.authorized: 
            logging.info(f"[INFO]: attempted delivery in automatic mode, unauthorized {self.side_number}")
            return 
        await self.cancelDispensingTasks() 
        self.task = asyncio.create_task(self.startErogation()) 


    async def nozzleDown(self):
        logging.info(f"[INFO]: nozzle released for side {self.side_number}") 
        self.nozzle_status = False 
        self.authorized = False 
        await self.q.put(("resetButtonColor", self.side_number)) 
        await self.cancelDispensingTasks() 
        self.task = asyncio.create_task(self.stopErogation()) 
        await asyncio.sleep(3) 
    
    async def monitorCounter(self):
        while True:
            liters = self.pulser_counter / self.params.pulses_per_liter 
            calibrated_liters = liters / self.params.calibration_factor 
            await self.q.put(("updateLiters", self.side_number, calibrated_liters)) 
            await asyncio.sleep(1) 

    async def startErogation(self):
        try:
            if self.params.automatic_mode: 
                await self.q.put(("cancelTimeout", self.side_number)) 
            
            self.pulser_counter = 0 
            await asyncio.sleep(self.params.relay_activation_timer) 
            self.pump_is_busy = True 
            logging.info(f"[INFO]: dispensing started for side {self.side_number}") 
            if self.pi: 
                self.pi.write(self.params.relay_pin, 1) 
            else:
                logging.info(f"[INFO]: PIGPIO failed, exception occoured on relay activation {self.side_number}")

            self.erogation_strted = True 

            if self.preset_value > 0: 
                if self.preset_task: 
                    self.cancelPresetTasks() 
                self.preset_task = asyncio.create_task(self.monitorPreset()) 
            self.data_rendering_task = asyncio.create_task(self.monitorCounter()) 
            if self.params.simulation_pulser: 
                self.sim_counter_task = asyncio.create_task(self.simCounter()) 
                logging.info(f"[INFO]: simulation counter started for side {self.side_number}")
            await self.checkMaxTiming() 
        except Exception as e: 
            logging.error(f"[ERROR]:exception catched in startErogation method for side {self.side_number}: {e}")

    async def stopErogation(self):
        self.pump_is_busy = False 
        await self.q.put(("resetPreset", None)) 
        logging.info(f"[INFO]: dispensing finished for side {self.side_number}") 
        if self.pi: 
            self.pi.write(self.params.relay_pin, 0) 
        self.preset_value = 0 
        await self.cancelPresetTasks() 
        await self.cancelSimCounterTasks() 
        await asyncio.sleep(1) 
        await self.cancelDataRenderingTasks() 
        if self.erogation_strted == True: 
            await self.q.put(("endErogation", self.side_number)) 
        self.erogation_strted = False 
    
    async def checkMaxTiming(self):
        await asyncio.sleep(self.params.timeout_reached_without_dispensing) 
        if self.pulser_counter == 0: 
            await self.stopErogation() 

    def close(self):
        if self.pi: 
            self.pi.write(self.params.relay_pin, 0) 
            self.pi.stop() 
            logging.info(f"[INFO]: gpio resources released for side {self.side_number}.")