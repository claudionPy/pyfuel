import asyncio
import pigpio
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

class PumpObject:
    def __init__(self, params, side_number, q):
        """
        Inizializza l'oggetto pompa con i parametri hardware.
        Tenta di connettersi a pigpio e configura i GPIO se la connessione ha successo.
        """
        self.params = params
        self.side_number = side_number
        self.q = q
        self.loop = asyncio.get_event_loop()
        try:
            self.pi = pigpio.pi()
        except Exception as e:
            logging.error(f"[ERROR]: Eccezione durante l'inizializzazione di pigpio per il lato {self.side_number}: {e}")
            self.pi = None
 
        if self.pi and self.pi.connected:
            logging.info(f"[INFO]: pigpio operativo per il lato {self.side_number}.")
            try:
                self._setup_gpio()
            except Exception as e:
                logging.error(f"[ERROR]: Fallita la configurazione GPIO per il lato {self.side_number}: {e}")
        else:
            logging.warning(f"[WARNING]: pigpio non funzionante per il lato {self.side_number}, attivata modalità simulazione.")
            self.pi = None

        self.nozzle_status = False
        self.pump_is_busy = False
        self.pulserCounter = 0
        self.task = None
        self.preset_task = None
        self.sim_counter_task = None
        self.update_liters_task = None
        self.preset_value = 0
        self.authorized = False

        self.check_nozzleSwitch_polarity()

    def _setup_gpio(self):
        """
        Configura i pin GPIO usando la libreria pigpio.
        """
        if self.pi:
            self.pi.set_mode(self.params.pulserPin, pigpio.INPUT)
            self.pi.set_pull_up_down(self.params.pulserPin, pigpio.PUD_UP)
            self.pi.callback(self.params.pulserPin, pigpio.FALLING_EDGE, self.updateCounter)

            self.pi.set_mode(self.params.nozzleSwitchPin, pigpio.INPUT)
            self.pi.set_pull_up_down(self.params.nozzleSwitchPin, pigpio.PUD_UP)
            self.pi.callback(self.params.nozzleSwitchPin, pigpio.EITHER_EDGE, self.handle_nozzle_switch)
            self.pi.set_glitch_filter(self.params.nozzleSwitchPin, 100000)

            self.pi.set_mode(self.params.relaySwitchPin, pigpio.OUTPUT)
            self.pi.write(self.params.relaySwitchPin, 0)
            logging.info(f"[DEBUG]: GPIO configurati correttamente per il lato {self.side_number}")

    def check_nozzleSwitch_polarity(self):
        """
        Imposta la polarità corretta per il sensore del beccuccio.
        """
        if self.params.nozzleSwitch_invert_polarity:
            self.high = pigpio.LOW
            self.low = pigpio.HIGH
        else:
            self.high = pigpio.HIGH
            self.low = pigpio.LOW

    def updateCounter(self, gpio, level, tick):
        """
        Callback per aggiornare il contatore dei impulsi.
        """
        if self.pump_is_busy:
            self.pulserCounter += 1
            logging.info(f"[INFO]: CONTATORE: {self.pulserCounter:.2f}")

    async def sim_counter(self):
        """
        Simula impulsi se non vengono rilevati impulsi fisici.
        """
        await asyncio.sleep(10)
        logging.info("[INFO]: Nessun impulso fisico rilevato, avvio simulazione.")
        if self.pulserCounter == 0:
            while True:
                self.pulserCounter += 1
                logging.info(f"[INFO]: CONTATORE SIMULATO: {self.pulserCounter:.2f}")
                await asyncio.sleep(0.1)

    def handle_nozzle_switch(self, gpio, level, tick):
        """
        Gestisce in maniera asincrona i cambiamenti dello stato del beccuccio.
        """
        if not self.loop or not self.loop.is_running():
            logging.error(f"[ERROR]: Loop non attivo per il lato {self.side_number}.")
            return
        
        if level == self.high:
            self.loop.create_task(self.nozzleUp())
        elif level == self.low:
            self.loop.create_task(self.nozzleDown())

    def set_preset(self, liters):
        """
        Imposta il valore di predeterminazione aggiungendo i litri indicati.
        """
        self.preset_value += liters
        logging.info(f"[INFO]: Preset impostato a: {self.preset_value} litri per il lato {self.side_number}")
    
    async def cancel_task(self):
        """
        Annulla il task principale di erogazione se attivo.
        """
        if self.task and not self.task.done():
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                logging.info(f"[INFO]: Task principale annullato per il lato {self.side_number}.")

    async def cancel_preset_task(self):
        """
        Annulla il task del preset e resetta il valore di preset.
        """
        #self.preset_value = 0
        if self.preset_task and not self.preset_task.done():
            self.preset_task.cancel()
            try:
                await self.preset_task
            except asyncio.CancelledError:
                logging.info(f"[INFO]: Task preset annullato per il lato {self.side_number}")
        logging.info(f"[INFO]: Preset resettato a 0 per il lato {self.side_number}")

    async def cancel_simulation_counter_task(self):
        """
        Annulla il task di simulazione del contatore se attivo.
        """
        if self.sim_counter_task and not self.sim_counter_task.done():
            self.sim_counter_task.cancel()
            try:
                await self.sim_counter_task
            except asyncio.CancelledError:
                logging.info(f"[INFO]: Task simulazione contatore annullato per il lato {self.side_number}")

    async def cancel_update_liters_task(self):
        """
        Annulla il task che aggiorna la visualizzazione dei litri.
        """
        if self.update_liters_task and not self.update_liters_task.done():
            self.update_liters_task.cancel()
            try:
                await self.update_liters_task
            except asyncio.CancelledError:
                logging.info(f"[INFO]: Task aggiornamento litri annullato per il lato {self.side_number}")

    async def monitor_preset(self):
        """
        Monitora il preset e interrompe l'erogazione quando viene raggiunto.
        """
        try:
            while self.preset_value and self.pump_is_busy:
                await asyncio.sleep(0.1)
                preset = self.preset_value * self.params.pulsesPerLiter * self.params.calibration_factor
                if self.pulserCounter >= preset:
                    logging.info(f"[INFO]: Preset raggiunto, arresto erogazione per il lato {self.side_number}")
                    await self.cancel_task()
                    self.task = asyncio.create_task(self.stopErogation())
                    break
        except asyncio.CancelledError:
            logging.info(f"[INFO]: Task monitor preset annullato per il lato {self.side_number}.")

    async def nozzleUp(self):
        """
        Gestisce l'evento del sollevamento del beccuccio.
        """
        logging.info(f"[INFO]: BECCUCCIO SOLLEVATO - LATO {self.side_number}")
        self.nozzle_status = True
        await self.q.put(("reset_preset", self.side_number))
        await self.q.put(("update_button", self.side_number))
        if self.params.isAutomatic and not self.authorized:
            logging.info(f"[INFO]: Erogazione automatica negata per il lato {self.side_number}")
            return
        await self.cancel_task()
        self.task = asyncio.create_task(self.startErogation())

    async def nozzleDown(self):
        """
        Gestisce l'evento del riposizionamento del beccuccio.
        """
        logging.info(f"[INFO]: BECCUCCIO RILASCIATO - LATO {self.side_number}")
        self.nozzle_status = False
        self.authorized = False
        await self.q.put(("reset_button_color", self.side_number))
        await self.cancel_task()
        self.task = asyncio.create_task(self.stopErogation())
        await asyncio.sleep(3)
        logging.info(f"[INFO]: Stato dei task: {self.task}, {self.preset_task}, {self.sim_counter_task}, {self.update_liters_task}")
    
    async def monitorCounter(self):
        """
        Aggiorna periodicamente la visualizzazione dei litri.
        """
        while True:
            liters = self.pulserCounter / self.params.pulsesPerLiter
            calibrated_liters = liters / self.params.calibration_factor
            await self.q.put(("update_liters", self.side_number, calibrated_liters))
            await asyncio.sleep(1)

    async def startErogation(self):
        """
        Avvia il processo di erogazione con controlli di sicurezza e gestione dei task.
        """
        try:
            if self.params.isAutomatic:
                await self.q.put(("cancel_timer", self.side_number))
            
            self.pulserCounter = 0
            await asyncio.sleep(self.params.relayActivationDelay)
            self.pump_is_busy = True
            logging.info(f"[INFO]: ERROGAZIONE INIZIATA - LATO {self.side_number}")
            if self.pi:
                self.pi.write(self.params.relaySwitchPin, 1)
            else:
                logging.info(f"[INFO]: Attivazione relè simulata per il lato {self.side_number}")

            if self.preset_value > 0:
                if self.preset_task:
                    self.cancel_preset_task()
                self.preset_task = asyncio.create_task(self.monitor_preset())
            self.update_liters_task = asyncio.create_task(self.monitorCounter())
            if self.params.simulation_pulser:
                self.sim_counter_task = asyncio.create_task(self.sim_counter())
                logging.info(f"[INFO]: Simulazione GPIO avviata, parametro: True - LATO {self.side_number}")
            await self.checkMaxTiming()
        except Exception as e:
            logging.error(f"[ERROR]: Eccezione in startErogation per il lato {self.side_number}: {e}")

    async def stopErogation(self):
        """
        Ferma il processo di erogazione e resetta lo stato hardware.
        """
        self.pump_is_busy = False
        await self.q.put(("reset_preset", None))
        logging.info(f"[INFO]: ERROGAZIONE ARRESTATA - LATO {self.side_number}")
        if self.pi:
            self.pi.write(self.params.relaySwitchPin, 0)
        self.preset_value = 0
        await self.cancel_preset_task()
        await self.cancel_simulation_counter_task()
        await asyncio.sleep(1)
        await self.cancel_update_liters_task()
        await self.q.put(("complete_erogation", self.side_number))

    async def checkMaxTiming(self):
        """
        Arresta l'erogazione se non vengono rilevati impulsi entro il tempo massimo consentito.
        """
        await asyncio.sleep(self.params.max_time_without_fueling)
        if self.pulserCounter == 0:
            await self.stopErogation()

    def close(self):
        """
        Pulisce le risorse GPIO al termine dell'esecuzione.
        """
        if self.pi:
            self.pi.write(self.params.relaySwitchPin, 0)
            self.pi.stop()
            logging.info(f"[INFO]: Risorse GPIO rilasciate per il lato {self.side_number}.")
