import asyncio
import logging
import psutil
from hardware.hardware import PumpObject
from hardware.gui import MainWindow, GuiSideObject, KeypadWindow
from hardware.params import GuiParameters, FuelParameters, GuiSides, FuelSides, MainParameters
from app.database import async_session
from app.crud import drivers as autisti_crud

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

class Controller:
    def __init__(self):
        self.fuel_sides = FuelSides(
            side_1=FuelParameters(sideExists=True, pulserPin=18, nozzleSwitchPin=5, relaySwitchPin=17, pulsesPerLiter=100, price=1.000, isAutomatic=True, relayActivationDelay=3, simulation_pulser=True),
            side_2=FuelParameters(sideExists=True, pulserPin=13, nozzleSwitchPin=24, relaySwitchPin=27, pulsesPerLiter=100, price=1.000, isAutomatic=False, relayActivationDelay=3, simulation_pulser=True),
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

        # Non usiamo più una lista statica di tessere
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
        tasks = [task for task in asyncio.all_tasks() if task is not asyncio.current_task()]
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    async def monitor_resources(self):
        while True:
            memory_usage = psutil.Process().memory_info().rss / 1024 / 1024
            task_count = len(asyncio.all_tasks())
            logging.info(f"[RESOURCES]: Utilizzo memoria: {memory_usage:.2f} MB, Task attivi: {task_count}")
            await asyncio.sleep(60)

    def listen_rfid(self, card_id):
        """
        Gestisce l'input RFID: avvia un task asincrono per validare la tessera nel database.
        """
        if not any(side.isAutomatic for side in vars(self.fuel_sides).values()):
            logging.info("[INFO]: Tutti i lati in modalità manuale; validazione RFID disattivata.")
            return

        if all(pump_obj.authorized or pump_obj.nozzle_status or not pump_obj.params.isAutomatic for _, pump_obj in self.sides.values()):
            logging.info("[INFO]: Tutti i lati occupati; validazione tessera saltata.")
            self.view.update_main_label("TUTTI I LATI SELEZIONATI, ATTENDI")
            self.view.after(3000, self.view.update_main_label, self.params.aut_MainLabel)
            return

        # Avvia il task per validare la tessera dal DB
        asyncio.create_task(self.valida_tessera(card_id))

    async def valida_tessera(self, card_id: str):
        async with async_session() as session:
            autista = await autisti_crud.get_autista(session, card_id)
            if autista:
                logging.info(f"[INFO]: Tessera valida trovata nel DB: {card_id}")
                # Controlla se è richiesto il PIN
                if autista.richiedi_pin:
                    await self.prompt_for_pin(autista)
                # Se non richiede PIN ma richiede ID veicolo, passa alla fase del veicolo
                elif autista.richiedi_id_veicolo:
                    await self.prompt_for_vehicle(autista)
                else:
                    self.handle_rfid_validation(autista.tessera)
            else:
                logging.info(f"[INFO]: Tessera non trovata nel DB: {card_id}")
                self.view.update_main_label(self.params.ref_MainLabel)
                self.view.after(3000, self.view.update_main_label, self.params.aut_MainLabel)

    async def prompt_for_pin(self, autista):
        """Mostra un tastierino per inserire il PIN e attende il risultato."""
        future = asyncio.get_event_loop().create_future()

        def pin_callback(value):
            future.set_result(value)
        # Mostra il tastierino per il PIN
        keypad_window = KeypadWindow(self.view, "Inserisci PIN", "Inserisci il PIN:", pin_callback)
    
        try:
            # Attende al massimo 30 secondi l'input dell'utente
            pin_input = await asyncio.wait_for(future, timeout=20)

        except asyncio.TimeoutError:
            keypad_window.destroy()
            self.view.update_main_label("TEMPO SCADUTO")
            await asyncio.sleep(3)
            self.view.update_main_label(self.params.aut_MainLabel)
            return
        
        if pin_input == autista.pin:
            logging.info("[INFO]: PIN corretto.")
            # Se richiede anche l'ID veicolo, passa a quella fase
            if autista.richiedi_id_veicolo:
                await self.prompt_for_vehicle(autista)
            else:
                self.handle_rfid_validation(autista.tessera)
        else:
            logging.info("[INFO]: PIN errato.")
            self.view.update_main_label("PIN ERRATO")
            await asyncio.sleep(3)
            self.view.update_main_label(self.params.aut_MainLabel)

    async def prompt_for_vehicle(self, autista):
        """Mostra un tastierino per inserire l'ID del veicolo e, se richiesto, i KM."""
        future = asyncio.get_event_loop().create_future()

        def vehicle_callback(value):
            future.set_result(value)
            
        keypad_window = KeypadWindow(self.view, "Inserisci ID Veicolo", "Inserisci l'ID del veicolo:", vehicle_callback)

        try:
            vehicle_id_str = await asyncio.wait_for(future, timeout=20)
            try:
                vehicle_id = int(vehicle_id_str)

            except ValueError:
                self.view.update_main_label("ID VEICOLO NON VALIDO")
                return
            
        except asyncio.TimeoutError:
            keypad_window.destroy()
            self.view.update_main_label("TEMPO SCADUTO")
            await asyncio.sleep(3)
            self.view.update_main_label(self.params.aut_MainLabel)
            return



        # Verifica l'esistenza del veicolo tramite il modulo CRUD (import dinamico per evitare circolarità)
        from app.crud.veichles import get_veicolo_by_id
        async with async_session() as session:
            veicolo = await get_veicolo_by_id(session, vehicle_id)

            if not veicolo:
                self.view.update_main_label("VEICOLO NON TROVATO")
                await asyncio.sleep(3)
                self.view.update_main_label(self.params.aut_MainLabel)
                return
            # Se il veicolo richiede l'inserimento dei KM
            if getattr(veicolo, "richiedi_km_veicolo", False):
                future_km = asyncio.get_event_loop().create_future()

                def km_callback(value):
                    future_km.set_result(value)

                keypad_window = KeypadWindow(self.view, "Inserisci KM", "Inserisci i KM attuali:", km_callback)

                try:
                    km_str = await asyncio.wait_for(future_km, timeout=20)

                    try:
                        km_value = float(km_str)
                    except ValueError:
                        self.view.update_main_label("KM NON VALIDI")
                        await asyncio.sleep(3)
                        self.view.update_main_label(self.params.aut_MainLabel)
                        return
                    
                    if km_value <= veicolo.km_totali_veicolo:
                        self.view.update_main_label("KM INSERITI TROPPO BASSI")
                        await asyncio.sleep(3)
                        self.view.update_main_label(self.params.aut_MainLabel)
                        return
                    
                except asyncio.TimeoutError:
                    keypad_window.destroy()
                    self.view.update_main_label("TEMPO SCADUTO")
                    await asyncio.sleep(3)
                    self.view.update_main_label(self.params.aut_MainLabel)
                    return
            # Se tutto è valido, prosegui
            self.handle_rfid_validation(autista.tessera)

    def handle_rfid_validation(self, card_id):
        if self.card_validated:
            logging.info("[INFO]: Tessera già validata; seleziona un lato.")
            return
        
        self.card_validated = True
        self.view.update_main_label(self.params.sel_MainLabel)
        for side, (gui_obj, pump_obj) in self.sides.items():
            if pump_obj.params.isAutomatic and not pump_obj.authorized and not pump_obj.nozzle_status:
                gui_obj.update_button(gui_obj.guiparams.available_buttonColor, gui_obj.guiparams.available_buttonBorderColor)
                gui_obj.button.configure(state="normal")
        self.selection_timer_task = asyncio.create_task(self.selection_timeout())

    def reset_card_validation(self):
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
        await asyncio.sleep(self.params.max_selection_time)
        logging.info("[INFO]: Timeout selezione lato; reset della validazione.")
        self.reset_card_validation()

    def side_clicked(self, side_number):
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
        for _, (gui_obj, pump_obj) in self.sides.items():
            if pump_obj.params.sideExists and not pump_obj.nozzle_status:
                if value is None:
                    logging.info("[INFO]: Annullamento preset.")
                    pump_obj.preset_value = 0
                    await pump_obj.cancel_preset_task()
                else:
                    logging.info(f"[INFO]: Impostazione preset: {value}L")
                    pump_obj.set_preset(value)
                gui_obj.update_preset_label(pump_obj.preset_value)

    async def reset_preset_on_inactive_sides(self, active_side):
        for side, (gui_obj, pump_obj) in self.sides.items():
            if pump_obj.params.sideExists and side != f"side_{active_side}" and not pump_obj.nozzle_status:
                pump_obj.preset_value = 0
                await pump_obj.cancel_preset_task()
                logging.info("[INFO]: Preset resettato su lato inattivo.")
                gui_obj.update_preset_label(pump_obj.preset_value)

    async def process_updates(self):
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