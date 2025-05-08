import customtkinter as ctk
from src.config.params import GuiParameters
import asyncio
import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

class GuiSideObject:
    def __init__(self, app: ctk.CTk, guiparams: GuiParameters, side_number: int, on_click_callback):
        self.app = app
        self.guiparams = guiparams
        self.side_number = side_number
        self.on_click_callback = on_click_callback
        self.button_font = ctk.CTkFont(family="sans-serif", size=60, weight="bold")
        self.label_font = ctk.CTkFont(family="sans-serif", size=35, weight="bold")
        self.createSideButton()
        self.createPresetLabel()
        self.createDataLabel()

    def createSideButton(self):
        self.button = ctk.CTkButton(
            self.app,
            text=self.guiparams.button_text or "",
            width=self.guiparams.button_width,
            height=self.guiparams.button_height,
            fg_color=self.guiparams.button_color,
            hover=None,
            font=self.button_font,
            corner_radius=self.guiparams.button_corner_radius,
            border_color=self.guiparams.button_border_color,
            border_width=self.guiparams.button_border_width,
            command=lambda: self.on_click_callback(self.side_number)
        )
        self.button.place(relx=self.guiparams.button_relx, rely=self.guiparams.button_rely, anchor="center")

    def createPresetLabel(self):
        self.preset_label = ctk.CTkLabel(
            self.app,
            text="Preset: ",
            font=self.label_font,
            text_color="black"
        )
        offsety = 0.25
        self.preset_label.place(
            relx=self.guiparams.button_relx,
            rely=self.guiparams.button_rely + offsety,
            anchor="center"
        )

    def createLiters(self):
        self.liters_display = ctk.CTkLabel(
            self.app,
            text="0.00",
            font=self.label_font,
            text_color="black"
        )
        offsety = 0.35
        offsetx = 0.04
        self.liters_display.place(
            relx=self.guiparams.button_relx + offsetx,
            rely=self.guiparams.button_rely + offsety,
            anchor="center"
        )

    def createDataLabel(self):
        self.liters_label = ctk.CTkLabel(
            self.app,
            text=self.guiparams.preset_label or "",
            font=self.label_font,
            text_color="black"
        )
        offsety = 0.35
        offsetx = 0.05
        self.liters_label.place(
            relx=self.guiparams.button_relx - offsetx,
            rely=self.guiparams.button_rely + offsety,
            anchor="center"
        )
        self.createLiters()
    
    def updateLiters(self, liters):
        current_liters = self.liters_display.cget("text")
        if current_liters != liters:
            self.liters_display.configure(text=f"{liters:.2f}")

    def updatePreset(self, preset_value):
        self.preset_label.configure(text=f"Preset: {preset_value}L")

    def updateButtonColor(self, color: str, border_color: str):
        current_fg = self.button.cget("fg_color")
        current_border = self.button.cget("border_color")

        if current_fg != color or current_border != border_color:
            self.button.configure(fg_color=color, border_color=border_color)

class PresetKeyboard(ctk.CTkFrame):
    def __init__(self, parent, sendPresetToController_callback):
        super().__init__(parent)
        self.sendPresetToController_callback = sendPresetToController_callback
        self.grid_columnconfigure((0, 1), weight=1)
        self.grid_rowconfigure((0, 1), weight=1)

        self.btn_1 = ctk.CTkButton(self, text="1L", font=("Arial", 50, "bold"), width=200, height=150, hover=None,
                                   command=lambda: self.sendPresetToController(1))
        self.btn_1.grid(row=0, column=0, padx=20, pady=10)

        self.btn_2 = ctk.CTkButton(self, text="5L", font=("Arial", 50, "bold"), width=200, height=150, hover=None,
                                   command=lambda: self.sendPresetToController(5))
        self.btn_2.grid(row=0, column=1, padx=20, pady=10)

        self.btn_3 = ctk.CTkButton(self, text="50L", font=("Arial", 50, "bold"), width=200, height=150, hover=None,
                                    command=lambda: self.sendPresetToController(50))
        self.btn_3.grid(row=0, column=2, padx=20, pady=10)

        self.btn_4 = ctk.CTkButton(self, text="C", font=("Arial", 50, "bold"), width=200, height=150, hover=None,
                                        fg_color="red", text_color="white",
                                        command=self.deletePreset)
        self.btn_4.grid(row=0, column=3, padx=20, pady=10)

    def sendPresetToController(self, value):
        self.sendPresetToController_callback(value)

    def deletePreset(self):
        self.sendPresetToController_callback(None)

class KeypadWindow(ctk.CTkToplevel):
    def __init__(self, parent, title: str, prompt: str, callback):
        super().__init__(parent)
        self.title(title)
        self.geometry(f"{parent.winfo_width()}x{parent.winfo_height()}+{parent.winfo_x()}+{parent.winfo_y()}")
        self.callback = callback
        self.value = ""
        
        self.prompt_font = ctk.CTkFont(family="Arial", size=30, weight="bold")
        self.display_font = ctk.CTkFont(family="Arial", size=40, weight="bold")
        self.button_font = ctk.CTkFont(family="Arial", size=60, weight="bold")
        
        self.container = ctk.CTkFrame(self)
        self.container.pack(expand=True, fill="both", padx=190, pady=5)
        self.container.grid_propagate(False)

        self.prompt_label = ctk.CTkLabel(self.container, text=prompt, font=self.prompt_font)
        self.prompt_label.grid(row=0, column=0, columnspan=3, pady=(20, 10))
        
        self.display = ctk.CTkLabel(self.container, text=self.value, font=self.display_font, width=300)
        self.display.grid(row=1, column=0, columnspan=3)
        
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
                command=lambda t=text: self.onButtonClick(t),
                width=200,
                height=200,
                fg_color=color,
                hover=None
            )
            btn.grid(row=row, column=col, pady=5)
        
        for i in range(2, 6):
            self.container.grid_rowconfigure(i, weight=1)
        for j in range(3):
            self.container.grid_columnconfigure(j, weight=1)
    
    def onButtonClick(self, t):
        if t == "Del":
            self.value = self.value[:-1]
        elif t == "OK":
            self.callback(self.value)
            self.destroy()
            return
        else:
            self.value += t
        
        self.display.configure(text=self.value)

class MainWindow(ctk.CTk):
    def __init__(self, controller):
        super().__init__()
        self.controller = controller

        ctk.set_appearance_mode("light")
        self.geometry('1024x600')
        self.protocol("WM_DELETE_WINDOW", self.closeGui)
        self.font = ctk.CTkFont(family="sans-serif", size=50, weight="bold")

        self.createLabel()

        self.rfid_entry = ctk.CTkEntry(self, font=("Arial", 30))
        self.rfid_entry.place(x=-100, y=-100)
        self.rfid_entry.bind("<Return>", self.rfidListener)
        self.rfid_entry.focus_set()

        self.keyboard = PresetKeyboard(self, self.sendPresetToController)
        self.keyboard.place(relx=0.5, rely=0.83, anchor="center")

    def createLabel(self):
        self.label = ctk.CTkLabel(
            self,
            text=f"EROGATORE IN MANUALE",
            font=("sans-serif", 40, "bold"),
            text_color="black",
            wraplength=400,
            justify="center"
        )

        self.label.place(relx=0.5, rely=0.5, anchor="center")

    def updateLabel(self, text: str):
        current_text = self.label.cget("text")

        if current_text != text:
            self.label.configure(text=text)

    def sendPresetToController(self, value):
        if value is None:
            logging.info(f"[INFO]: Sent preset value: None")
        else:
            logging.info(f"[INFO]: Sent preset value: {value}")
        asyncio.create_task(self.controller.sendPresetToPump(value))

    def rfidListener(self, event):
        card_value = self.rfid_entry.get().strip()
        self.rfid_entry.delete(0, 'end')
        self.controller.rfidResponse(card_value)

    def closeGui(self):
        logging.info("[INFO]: closing window")
        self.destroy()

    async def run(self):
        logging.info(f"[INFO]: GUI event loop running: {asyncio.get_event_loop().is_running()}")
        while True:
            self.update_idletasks()
            self.update()
            await asyncio.sleep(.5)