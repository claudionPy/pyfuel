import asyncio
import logging
import psutil
from hardware import PumpObject
from gui import MainWindow, GuiSideObject
from params import GuiParameters, FuelParameters, GuiSides, FuelSides, MainParameters

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

class Controller:
    def __init__(self):
        self.fuel_sides = FuelSides(
            side_1=FuelParameters(sideExists=True, pulserPin=18, nozzleSwitchPin=5, relaySwitchPin=17, pulsesPerLiter=100, price=1.000, isAutomatic=True, relayActivationDelay=3),
            side_2=FuelParameters(sideExists=True, pulserPin=13, nozzleSwitchPin=24, relaySwitchPin=27, pulsesPerLiter=100, price=1.000, isAutomatic=False, relayActivationDelay=3),
            side_3=FuelParameters(),
            side_4=FuelParameters()
        )

        self.gui_sides = GuiSides(
            side_1=GuiParameters(sideExists=True, buttonText="Lato 1", buttonWidth=500, buttonHeight=170, buttonBorderWidth=10, buttonCornerRadius=100, button_relx=0.13, button_rely=0.2),
            side_2=GuiParameters(sideExists=True, buttonText="Lato 2", buttonWidth=500, buttonHeight=170, buttonBorderWidth=10, buttonCornerRadius=100, button_relx=0.87, button_rely=0.2),
            side_3=GuiParameters(),
            side_4=GuiParameters()
        )

        self.params = MainParameters()
        self.q = asyncio.Queue(maxsize=100)
        self.sides = {}
        self.view = MainWindow(self)

        self.valid_cards = ["3063367470", "13"]
        self.card_validated = False
        self.side_selected = None
        self.selection_timer_task = None
        self.active_tasks = set()

        self.create_sides()

    def create_sides(self):
        for i in range(1, 5):
            fuel_side = getattr(self.fuel_sides, f"side_{i}")
            gui_side = getattr(self.gui_sides, f"side_{i}")

            if fuel_side.sideExists and gui_side.sideExists:
                pump_obj = PumpObject(fuel_side, i, self.q)
                gui_obj = GuiSideObject(self.view, gui_side, i, self.side_clicked)
                self.sides[f"side_{i}"] = (gui_obj, pump_obj)

                if pump_obj.params.isAutomatic:
                    gui_obj.guiparams.buttonColor = gui_obj.guiparams.aut_buttonColor
                    gui_obj.guiparams.buttonBorderColor = gui_obj.guiparams.aut_buttonBorderColor
                    gui_obj.update_button(gui_obj.guiparams.buttonColor, gui_obj.guiparams.buttonBorderColor)
                    self.view.after(0, self.view.update_main_label, self.params.aut_MainLabel)

                gui_obj.button.configure(state="disabled")


    async def cancel_all_tasks(self):
        """
        Annulla tutti i task asyncio attivi.
        """
        tasks = [task for task in asyncio.all_tasks() if task is not asyncio.current_task()]
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    async def monitor_resources(self):
        """
        Monitora periodicamente le risorse di sistema e logga l'utilizzo della memoria e il numero di task.
        """
        while True:
            memory_usage = psutil.Process().memory_info().rss / 1024 / 1024
            task_count = len(asyncio.all_tasks())
            logging.info(f"[RESOURCES]: Utilizzo memoria: {memory_usage:.2f} MB, Task attivi: {task_count}")
            await asyncio.sleep(60)

    def listen_rfid(self, card_id):
        """
        Gestisce l'input RFID: se la tessera è valida, procede con la validazione.
        """
        if not any(side.isAutomatic for side in vars(self.fuel_sides).values()):
            logging.info("[INFO]: Tutti i lati in modalità manuale; validazione RFID disattivata.")
            return

        if all(pump_obj.authorized or pump_obj.nozzle_status or not pump_obj.params.isAutomatic for _, pump_obj in self.sides.values()):
            logging.info("[INFO]: Tutti i lati occupati; validazione tessera saltata.")
            self.view.update_main_label("TUTTI I LATI SELEZIONATI, ATTENDI")
            self.view.after(3000, self.view.update_main_label, self.params.aut_MainLabel)
            return

        if card_id in self.valid_cards:
            logging.info(f"[INFO]: Tessera valida letta: {card_id}")
            self.handle_rfid_validation(card_id)
        else:
            if not self.card_validated:
                logging.info(f"[INFO]: Tessera non riconosciuta: {card_id}")
                self.view.update_main_label(self.params.ref_MainLabel)
                self.view.after(3000, self.view.update_main_label, self.params.aut_MainLabel)

    def handle_rfid_validation(self, card_id):
        """
        Gestisce la logica a seguito della validazione della tessera RFID.
        """
        if self.card_validated:
            logging.info("[INFO]: Tessera già validata; seleziona un lato.")
            return
        
        self.card_validated = True
        self.view.update_main_label(self.params.sel_MainLabel)
        for key, (gui_obj, pump_obj) in self.sides.items():
            if pump_obj.params.isAutomatic and not pump_obj.authorized and not pump_obj.nozzle_status:
                gui_obj.update_button(gui_obj.guiparams.available_buttonColor, gui_obj.guiparams.available_buttonBorderColor)
                gui_obj.button.configure(state="normal")
        self.selection_timer_task = asyncio.create_task(self.selection_timeout())

    def reset_card_validation(self):
        """
        Resetta la validazione della tessera, aggiornando la GUI e ripristinando lo stato delle pompe.
        """
        self.card_validated = False
        self.side_selected = None
        self.view.update_main_label(self.params.exp_MainLabel)
        self.view.after(3000, self.view.update_main_label, self.params.aut_MainLabel)
        for side, (gui_obj, pump_obj) in self.sides.items():
            if pump_obj.params.isAutomatic and not pump_obj.pump_is_busy:
                pump_obj.authorized = False
                gui_obj.update_button(gui_obj.guiparams.buttonColor, gui_obj.guiparams.buttonBorderColor)
                gui_obj.button.configure(state="disabled")
        if self.selection_timer_task:
            self.selection_timer_task.cancel()

    async def selection_timeout(self):
        """
        Timeout per la selezione del lato: se non viene scelto alcun lato, viene resettata la validazione.
        """
        await asyncio.sleep(self.params.max_selection_time)
        logging.info("[INFO]: Timeout selezione lato; reset della validazione.")
        self.reset_card_validation()

    def side_clicked(self, side_number):
        """
        Gestisce l'evento di selezione lato in seguito al click sul pulsante.
        """
        if not self.card_validated:
            logging.warning("[WARNING]: Lato cliccato senza previa validazione della tessera.")
            return

        logging.info(f"[INFO]: Lato selezionato: {side_number}")
        self.side_selected = side_number

        for side, (gui_obj, pump_obj) in self.sides.items():
            current_side = int(side.split("_")[1])
            if current_side == side_number and pump_obj.params.isAutomatic:
                pump_obj.authorized = True
            elif current_side != side_number and not pump_obj.authorized and not pump_obj.nozzle_status:
                gui_obj.update_button(gui_obj.guiparams.buttonColor, gui_obj.guiparams.buttonBorderColor)
            gui_obj.button.configure(state="disabled")
        
        self.card_validated = False
        self.view.update_main_label(self.params.aut_MainLabel)
        self.view.rfid_entry.focus_set()

    async def send_preset_to_pump(self, value):
        """
        Invia il valore di preset alla pompa corrispondente e aggiorna la GUI.
        """
        for _, (gui_obj, pump_obj) in self.sides.items():
            if pump_obj.params.sideExists and not pump_obj.nozzle_status:
                if value is None:
                    logging.info("[INFO]: Annullamento preset.")
                    await pump_obj.cancel_preset()
                else:
                    logging.info(f"[INFO]: Impostazione preset: {value}L")
                    pump_obj.set_preset(value)
                gui_obj.update_preset_label(pump_obj.preset_value)

    async def reset_preset_on_inactive_sides(self, active_side):
        """
        Resetta il preset su tutti i lati tranne quello attivo.
        """
        for side, (gui_obj, pump_obj) in self.sides.items():
            if pump_obj.params.sideExists and side != f"side_{active_side}" and not pump_obj.nozzle_status:
                await pump_obj.cancel_preset()
                logging.info("[INFO]: Preset resettato su lato inattivo.")
                gui_obj.update_preset_label(pump_obj.preset_value)

    async def process_updates(self):
        """
        Elabora gli aggiornamenti provenienti dagli eventi hardware e aggiorna la GUI di conseguenza.
        """
        updates = []
        while True:
            update = await self.q.get()
            updates.append(update)
            await asyncio.sleep(0.5)
            while not self.q.empty():
                updates.append(await self.q.get())
            for action, *args in updates:
                if action == "reset_preset":
                    active_side = args[0]
                    await self.reset_preset_on_inactive_sides(active_side)
                elif action == "update_liters":
                    if f"side_{args[0]}" in self.sides:
                        gui_obj, _ = self.sides[f"side_{args[0]}"]
                        self.view.after(0, gui_obj.update_liters_display, args[1])
                elif action == "update_button":
                    if f"side_{args[0]}" in self.sides:
                        gui_obj, _ = self.sides[f"side_{args[0]}"]
                        self.view.after(0, gui_obj.update_button, gui_obj.guiparams.inuse_buttonColor, gui_obj.guiparams.inuse_buttonBorderColor)
                elif action == "reset_button_color":
                    if f"side_{args[0]}" in self.sides:
                        gui_obj, _ = self.sides[f"side_{args[0]}"]
                        self.view.after(0, gui_obj.update_button, gui_obj.guiparams.buttonColor, gui_obj.guiparams.buttonBorderColor)
                elif action == "cancel_timer":
                    if self.selection_timer_task:
                        self.selection_timer_task.cancel()
                        self.selection_timer_task = None
            updates.clear()

    async def run(self):
        """
        Avvia il loop principale dell'applicazione, raggruppando il loop della GUI,
        il processo degli aggiornamenti e il monitoraggio delle risorse.
        """
        logging.info(f"[INFO]: Loop principale avviato: {asyncio.get_event_loop().is_running()}")
        try:
            await asyncio.gather(
                self.view.run(),
                self.process_updates(),
                self.monitor_resources()
            )
        except Exception as e:
            logging.error(f"[ERROR]: Eccezione nel loop principale: {e}")
        finally:
            await self.cleanup()

    async def cleanup(self):
        """
        Pulisce le risorse e annulla tutti i task prima dell'uscita.
        """
        logging.info("[INFO]: Pulizia delle risorse in corso.")
        for _, pump in self.sides.values():
            pump.close()
        await self.cancel_all_tasks()

if __name__ == "__main__":
    controller = Controller()
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(controller.run())
    except KeyboardInterrupt:
        logging.info("[INFO]: Programma terminato dall'utente.")
    finally:
        logging.info("[INFO]: Pulizia finale dei task e chiusura del loop.")
        loop.run_until_complete(controller.cleanup())
        loop.close()
        logging.info("[INFO]: Loop chiuso con successo.")
