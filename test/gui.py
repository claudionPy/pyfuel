import customtkinter as ctk
from params import GuiParameters
import asyncio
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

class GuiSideObject:
    def __init__(self, app: ctk.CTk, guiparams: GuiParameters, side_number: int, on_click_callback):
        self.app = app
        self.guiparams = guiparams
        self.side_number = side_number
        self.on_click_callback = on_click_callback
        self.buttonFont = ctk.CTkFont(family="sans-serif", size=60, weight="bold")
        # Riduco leggermente la dimensione del font per il label
        self.labelFont = ctk.CTkFont(family="sans-serif", size=35, weight="bold")
        self.side_button()
        self.create_preset_label()
        self.create_liters_label()

    def side_button(self):
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
        self.create_liters_display()
    
    def update_liters_display(self, liters):
        current_liters = self.liters_display.cget("text")
        if current_liters != liters:
            self.liters_display.configure(text=f"{liters:.2f}")

    def update_preset_label(self, preset_value):
        self.preset_label.configure(text=f"Preset: {preset_value}L")

    def update_button(self, color: str, border_color: str):
        current_fg = self.button.cget("fg_color")
        current_border = self.button.cget("border_color")

        if current_fg != color or current_border != border_color:
            self.button.configure(fg_color=color, border_color=border_color)
            logging.info(f"Button updated: color={color}, border_color={border_color}")

class PresetKeyboard(ctk.CTkFrame):
    def __init__(self, parent, send_preset_callback):
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
        self.send_preset_callback(value)

    def cancel_preset(self):
        self.send_preset_callback(None)  # Invia None per annullare

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
        current_text = self.label.cget("text")

        if current_text != text:
            self.label.configure(text=text)
            logging.info(f"Main label updated: text={text}")

    def send_preset(self, value):
        if value is None:
            logging.info(f"[INFO]: Sent preset value: None")
        else:
            logging.info(f"[INFO]: Sent preset value: {value}")
        asyncio.create_task(self.controller.send_preset_to_pump(value))

    def handle_rfid_scan(self, event):
        card_value = self.rfid_entry.get().strip()
        self.rfid_entry.delete(0, 'end')
        self.controller.listen_rfid(card_value)

    def close_gui(self):
        logging.info("[INFO]: Closing gui window")
        self.destroy()

    async def run(self):
        logging.info(f"[INFO]: GUI event loop running: {asyncio.get_event_loop().is_running()}")
        while True:
            self.update_idletasks()
            self.update()
            await asyncio.sleep(1)  # Reduce CPU usage
