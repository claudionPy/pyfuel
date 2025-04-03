import customtkinter as ctk
from hardware.params import GuiParameters
import asyncio
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

class GuiSideObject:
    def __init__(self, app: ctk.CTk, guiparams: GuiParameters, side_number: int, on_click_callback):
        self.app = app
        self.guiparams = guiparams
        self.side_number = side_number
        self.on_click_callback = on_click_callback
        self.buttonFont = ctk.CTkFont(family="sans-serif", size=60, weight="bold")
        self.labelFont = ctk.CTkFont(family="sans-serif", size=35, weight="bold")
        self.side_button()
        self.create_preset_label()
        self.create_liters_label()

    def side_button(self):
        """Crea un lato GUI in riferimento a lato 'Hardware'."""
        self.button = ctk.CTkButton(
            self.app,
            text=self.guiparams.buttonText or "",
            width=self.guiparams.buttonWidth,
            height=self.guiparams.buttonHeight,
            fg_color=self.guiparams.buttonColor,
            hover=None,
            font=self.buttonFont,
            corner_radius=self.guiparams.buttonCornerRadius,
            border_color=self.guiparams.buttonBorderColor,
            border_width=self.guiparams.buttonBorderWidth,
            command=lambda: self.on_click_callback(self.side_number)
        )
        self.button.place(relx=self.guiparams.button_relx, rely=self.guiparams.button_rely, anchor="center")

    def create_preset_label(self):
        """Crea il label per visualizzare il preset corrente."""
        self.preset_label = ctk.CTkLabel(
            self.app,
            text="Preset: ",
            font=self.labelFont,
            text_color="black"
        )
        offsety = 0.25
        self.preset_label.place(
            relx=self.guiparams.button_relx,
            rely=self.guiparams.button_rely + offsety,
            anchor="center"
        )

    def create_liters_display(self):
        """Crea l'indicatore corrente per la quantità erogata."""
        self.liters_display = ctk.CTkLabel(
            self.app,
            text="0.00",
            font=self.labelFont,
            text_color="black"
        )
        offsety = 0.35
        offsetx = 0.04
        self.liters_display.place(
            relx=self.guiparams.button_relx + offsetx,
            rely=self.guiparams.button_rely + offsety,
            anchor="center"
        )

    def create_liters_label(self):
        """Crea la label indicante l'unità di misura usata per conteggiare: es. L."""
        self.liters_label = ctk.CTkLabel(
            self.app,
            text=self.guiparams.labelText or "",
            font=self.labelFont,
            text_color="black"
        )
        offsety = 0.35
        offsetx = 0.05
        self.liters_label.place(
            relx=self.guiparams.button_relx - offsetx,
            rely=self.guiparams.button_rely + offsety,
            anchor="center"
        )
        """Chiama la funzione per creare l'indicatore di quantità erogata."""
        self.create_liters_display()
    
    def update_liters_display(self, liters):
        current_liters = self.liters_display.cget("text")
        if current_liters != liters:
            self.liters_display.configure(text=f"{liters:.2f}")

    def update_preset_label(self, preset_value):
        """Aggiorna il testo del label per mostrare il preset corrente."""
        self.preset_label.configure(text=f"Preset: {preset_value}L")

    def update_button(self, color: str, border_color: str):
        """Aggiorna colore pulsante e il rispettivo bordo se vi è un cambiamento dal precedente."""
        current_fg = self.button.cget("fg_color")
        current_border = self.button.cget("border_color")

        if current_fg != color or current_border != border_color:
            self.button.configure(fg_color=color, border_color=border_color)
            logging.info(f"Button updated: color={color}, border_color={border_color}")

class PresetKeyboard(ctk.CTkFrame):
    def __init__(self, parent, send_preset_callback):
        """Tastiera di predeterminazione con 4 pulsanti."""
        super().__init__(parent)
        self.send_preset_callback = send_preset_callback
        self.grid_columnconfigure((0, 1), weight=1)
        self.grid_rowconfigure((0, 1), weight=1)

        self.btn_1 = ctk.CTkButton(self, text="1L", font=("Arial", 50, "bold"), width=200, height=150, hover=None,
                                   command=lambda: self.send_preset(1))
        self.btn_1.grid(row=0, column=0, padx=20, pady=10)

        self.btn_2 = ctk.CTkButton(self, text="5L", font=("Arial", 50, "bold"), width=200, height=150, hover=None,
                                   command=lambda: self.send_preset(5))
        self.btn_2.grid(row=0, column=1, padx=20, pady=10)

        self.btn_3 = ctk.CTkButton(self, text="50L", font=("Arial", 50, "bold"), width=200, height=150, hover=None,
                                    command=lambda: self.send_preset(50))
        self.btn_3.grid(row=0, column=2, padx=20, pady=10)

        self.btn_4 = ctk.CTkButton(self, text="C", font=("Arial", 50, "bold"), width=200, height=150, hover=None,
                                        fg_color="red", text_color="white",
                                        command=self.cancel_preset)
        self.btn_4.grid(row=0, column=3, padx=20, pady=10)

    def send_preset(self, value):
        """Invia il valore di predeterminazione alla logica."""
        self.send_preset_callback(value)

    def cancel_preset(self):
        """Cancella il valore di predeterminazione."""
        self.send_preset_callback(None)

class KeypadWindow(ctk.CTkToplevel):
    def __init__(self, parent, title: str, prompt: str, callback):
        super().__init__(parent)
        self.title(title)
        self.geometry(f"{parent.winfo_width()}x{parent.winfo_height()}+{parent.winfo_x()}+{parent.winfo_y()}")
        self.callback = callback
        self.value = ""
        
        # Definisci font e dimensioni maggiori per un'interfaccia più accessibile.
        self.prompt_font = ctk.CTkFont(family="Arial", size=30, weight="bold")
        self.display_font = ctk.CTkFont(family="Arial", size=40, weight="bold")
        self.button_font = ctk.CTkFont(family="Arial", size=60, weight="bold")
        
        # Usa un frame che occupa l'intera finestra con padding per creare un overlay
        self.container = ctk.CTkFrame(self)
        self.container.pack(expand=True, fill="both", padx=190, pady=5)
        self.container.grid_propagate(False)

        
        # Label del prompt
        self.prompt_label = ctk.CTkLabel(self.container, text=prompt, font=self.prompt_font)
        self.prompt_label.grid(row=0, column=0, columnspan=3, pady=(20, 10))
        
        # Label per mostrare il valore corrente
        self.display = ctk.CTkLabel(self.container, text=self.value, font=self.display_font, width=300)
        self.display.grid(row=1, column=0, columnspan=3)
        
        # Definisci i pulsanti in una griglia (i pulsanti saranno più grandi)
        buttons = [
            ("1", 2, 0, "blue"), ("2", 2, 1, "blue"), ("3", 2, 2, "blue"),
            ("4", 3, 0, "blue"), ("5", 3, 1, "blue"), ("6", 3, 2, "blue"),
            ("7", 4, 0, "blue"), ("8", 4, 1, "blue"), ("9", 4, 2, "blue"),
            ("Del", 5, 0, "red"), ("0", 5, 1, "blue"), ("OK", 5, 2, "green")
        ]

        for (text, row, col, color) in buttons:
            btn = ctk.CTkButton(
                self.container,
                text=text,
                font=self.button_font,
                command=lambda t=text: self.on_button_click(t),
                width=200,      # Dimensioni maggiori per facilitare il click
                height=200,
                fg_color=color,
                hover=None
            )
            btn.grid(row=row, column=col, pady=5)
        
        # Configura le righe e colonne della griglia in modo che si espandano
        for i in range(2, 6):
            self.container.grid_rowconfigure(i, weight=1)
        for j in range(3):
            self.container.grid_columnconfigure(j, weight=1)
    
    def on_button_click(self, t):
        if t == "Del":
            self.value = self.value[:-1]
        elif t == "OK":
            self.callback(self.value)
            self.destroy()
            return
        else:
            self.value += t
        
        # Aggiorna il display per mostrare il valore corrente
        self.display.configure(text=self.value)

class MainWindow(ctk.CTk):
    def __init__(self, controller):
        super().__init__()
        self.controller = controller

        ctk.set_appearance_mode("light")
        self.geometry('1024x600')
        self.protocol("WM_DELETE_WINDOW", self.close_gui)
        self.font = ctk.CTkFont(family="sans-serif", size=50, weight="bold")

        self.create_main_label()

        self.rfid_entry = ctk.CTkEntry(self, font=("Arial", 30))
        self.rfid_entry.place(x=-100, y=-100)
        self.rfid_entry.bind("<Return>", self.handle_rfid_scan)
        self.rfid_entry.focus_set()

        self.keyboard = PresetKeyboard(self, self.send_preset)
        self.keyboard.place(relx=0.5, rely=0.83, anchor="center")

    def create_main_label(self):
        """Crea la labl principale responsabile dei messaggi di stato principali."""
        self.label = ctk.CTkLabel(
            self,
            text=f"EROGATORE IN MANUALE",
            font=("sans-serif", 40, "bold"),
            text_color="black",
            wraplength=400,
            justify="center"
        )

        self.label.place(relx=0.5, rely=0.5, anchor="center")

    def update_main_label(self, text: str):
        """Aggiorna la label principale con testo inviato dal controller."""
        current_text = self.label.cget("text")

        if current_text != text:
            self.label.configure(text=text)
            logging.info(f"Main label updated: text={text}")

    def send_preset(self, value):
        """Invia preset al controller."""
        if value is None:
            logging.info(f"[INFO]: Sent preset value: None")
        else:
            logging.info(f"[INFO]: Sent preset value: {value}")
        asyncio.create_task(self.controller.send_preset_to_pump(value))

    def handle_rfid_scan(self, event):
        """Oggetto Entry che permette l'ascolto delle tessere."""
        card_value = self.rfid_entry.get().strip()
        self.rfid_entry.delete(0, 'end')
        self.controller.listen_rfid(card_value)

    def close_gui(self):
        """Chiude la GUI."""
        logging.info("[INFO]: Closing gui window")
        self.destroy()

    async def run(self):
        """Mantiene loop asincrono attivo e chiama metodo update ogni secondo per non bloccare la GUI."""
        logging.info(f"[INFO]: GUI event loop running: {asyncio.get_event_loop().is_running()}")
        while True:
            self.update_idletasks()
            self.update()
            await asyncio.sleep(.5)