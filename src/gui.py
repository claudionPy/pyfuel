# gui.py
# Defines the GUI components using CustomTkinter:
#  - GuiSideObject: encapsulates a pump-side button plus preset & liters display
#  - KeypadWindow: modal dialog for numeric entry (PIN, vehicle ID, preset, km)
#  - MainWindow: the main application window, wiring everything together

import customtkinter as ctk       # CustomTkinter for modern-styled Tk widgets
from config.params import GuiParameters
import asyncio                     # For async GUI event loop integration
import logging                     # For diagnostic logging

# Configure logging format and level
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")


class GuiSideObject:
    """
    Represents one side of the fuel dispenser in the GUI:
      - A large button to select/start dispense
      - A label showing 'Preset: X L'
      - A label showing current dispensed liters
    """

    def __init__(self, app: ctk.CTk, guiparams: GuiParameters, side_number: int, on_click_callback):
        # Reference to the main window (for placing widgets)
        self.app = app
        # Styling and layout parameters for this side
        self.guiparams = guiparams
        # Numeric side ID (1 or 2) used in callbacks
        self.side_number = side_number
        # Callback invoked when the side button is clicked
        self.on_click_callback = on_click_callback

        # Fonts for button text and labels
        self.button_font = ctk.CTkFont(family="sans-serif", size=60, weight="bold")
        self.label_font = ctk.CTkFont(family="sans-serif", size=35, weight="bold")

        # Build the UI elements for this side
        self.createSideButton()
        self.createPresetLabel()
        self.createDataLabel()

    def createSideButton(self):
        """Create the main pump-side button and place it in the window."""
        self.button = ctk.CTkButton(
            master=self.app,
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
        self.button.place(
            relx=self.guiparams.button_relx,
            rely=self.guiparams.button_rely,
            anchor="center"
        )

    def createPresetLabel(self):
        """Create the 'Preset: X L' label below the button."""
        self.preset_label = ctk.CTkLabel(
            master=self.app,
            text="Preset: 0 L",
            font=self.label_font,
            text_color="black"
        )
        offset_y = 0.25  # vertical offset from the button
        self.preset_label.place(
            relx=self.guiparams.button_relx,
            rely=self.guiparams.button_rely + offset_y,
            anchor="center"
        )

    def createDataLabel(self):
        """
        Create the static 'Liters' label and dynamic liters display.
        The two labels sit side by side beneath the button.
        """
        # Static label (e.g. "L")
        self.liters_label = ctk.CTkLabel(
            master=self.app,
            text=self.guiparams.preset_label or "L",
            font=self.label_font,
            text_color="black"
        )
        offset_y = 0.35
        offset_x = 0.05
        self.liters_label.place(
            relx=self.guiparams.button_relx - offset_x,
            rely=self.guiparams.button_rely + offset_y,
            anchor="center"
        )

        # Dynamic display initialized to "0.00"
        self.liters_display = ctk.CTkLabel(
            master=self.app,
            text="0.00",
            font=self.label_font,
            text_color="black"
        )
        self.liters_display.place(
            relx=self.guiparams.button_relx + offset_x,
            rely=self.guiparams.button_rely + offset_y,
            anchor="center"
        )

    def updateLiters(self, liters: float):
        """Update the liters display if the value has changed."""
        new_text = f"{liters:.2f}"
        if self.liters_display.cget("text") != new_text:
            self.liters_display.configure(text=new_text)

    def updatePreset(self, preset_value: int):
        """Update the preset label to show the new preset volume."""
        self.preset_label.configure(text=f"Preset: {preset_value} L")

    def updateButtonColor(self, color: str, border_color: str):
        """
        Change button colors to reflect state:
          - available, busy, disabled, automatic mode, etc.
        """
        if (
            self.button.cget("fg_color") != color
            or self.button.cget("border_color") != border_color
        ):
            self.button.configure(fg_color=color, border_color=border_color)


class KeypadWindow(ctk.CTkToplevel):
    """
    Modal pop-up window with a numeric keypad:
      - Used for PIN entry, vehicle ID, odometer, and presets.
      - Calls a provided callback when the user submits or cancels.
    """

    def __init__(self, master, title: str, prompt_text: str, callback):
        super().__init__(master)
        self.callback = callback
        self.title(title)
        self.geometry("400x500")
        self.resizable(False, False)

        # Prompt label at top
        self.label = ctk.CTkLabel(self, text=prompt_text, font=ctk.CTkFont(size=24))
        self.label.pack(pady=20)

        # Entry to display user input
        self.entry = ctk.CTkEntry(self, width=200, font=ctk.CTkFont(size=32))
        self.entry.pack(pady=10)

        # Frame for keypad buttons
        btn_frame = ctk.CTkFrame(self)
        btn_frame.pack(pady=20)

        # Create digit buttons 1–9, 0, Clear, Enter, Cancel
        digits = [
            ('1', (0,0)), ('2', (0,1)), ('3', (0,2)),
            ('4', (1,0)), ('5', (1,1)), ('6', (1,2)),
            ('7', (2,0)), ('8', (2,1)), ('9', (2,2)),
            ('0', (3,1)),
        ]
        for text, (r,c) in digits:
            btn = ctk.CTkButton(
                btn_frame,
                text=text,
                width=60, height=60,
                command=lambda t=text: self._on_digit(t)
            )
            btn.grid(row=r, column=c, padx=5, pady=5)

        # Clear, Enter, Cancel
        ctk.CTkButton(btn_frame, text="Clear", command=self._on_clear).grid(row=3, column=0, padx=5, pady=5)
        ctk.CTkButton(btn_frame, text="Enter", command=self._on_enter).grid(row=3, column=2, padx=5, pady=5)
        ctk.CTkButton(self, text="Cancel", command=self._on_cancel).pack(pady=10)

    def _on_digit(self, digit: str):
        """Append a digit to the entry."""
        current = self.entry.get()
        self.entry.delete(0, 'end')
        self.entry.insert(0, current + digit)

    def _on_clear(self):
        """Clear the entry."""
        self.entry.delete(0, 'end')

    def _on_enter(self):
        """Submit the entry to the callback and close."""
        value = self.entry.get().strip()
        self.callback(value)
        self.destroy()

    def _on_cancel(self):
        """Cancel entry (send None) and close."""
        self.callback(None)
        self.destroy()


class MainWindow(ctk.CTk):
    """
    The main application window:
      - Displays status text (automatic/manual mode, errors, prompts)
      - Contains the RFID entry field
      - Hosts GuiSideObjects for each side
      - Captures preset value entry
      - Forwards user actions to the Controller
    """

    def __init__(self, controller):
        super().__init__()
        self.controller = controller
        self.title("Fuel Station Controller")
        self.geometry("800x480")
        self.protocol("WM_DELETE_WINDOW", self.closeGui)

        # Main status label at top
        self.status_label = ctk.CTkLabel(self, text="", font=ctk.CTkFont(size=24))
        self.status_label.pack(pady=10)

        # Hidden entry to capture RFID scans
        self.rfid_entry = ctk.CTkEntry(self, font=ctk.CTkFont(size=1))
        self.rfid_entry.bind("<Return>", self.rfidListener)
        self.rfid_entry.pack()
        self.rfid_entry.focus_set()

        # Preset input field
        preset_frame = ctk.CTkFrame(self)
        preset_frame.pack(pady=10)
        ctk.CTkLabel(preset_frame, text="Preset (L):").grid(row=0, column=0, padx=5)
        self.preset_input = ctk.CTkEntry(preset_frame, width=100)
        self.preset_input.grid(row=0, column=1, padx=5)
        ctk.CTkButton(
            preset_frame,
            text="Set",
            command=self._on_preset_set
        ).grid(row=0, column=2, padx=5)

        # Container for side objects; Controller.createSides() will add them
        # (they use place(), so no pack/grid here)

    def _on_preset_set(self):
        """Handler when user sets a preset volume."""
        try:
            value = int(self.preset_input.get())
        except ValueError:
            self.updateLabel("Invalid preset")
            return
        # Forward to Controller to distribute to pumps
        asyncio.create_task(self.controller.sendPresetToPump(value))

    def updateLabel(self, text: str):
        """Update the main status label text."""
        self.status_label.configure(text=text)

    def rfidListener(self, event):
        """
        Triggered on RFID entry <Return>:
          - Read card, clear field, and forward to controller.
        """
        card = self.rfid_entry.get().strip()
        self.rfid_entry.delete(0, 'end')
        self.controller.rfidResponse(card)

    def closeGui(self):
        """Clean up and close the application window."""
        logging.info("[INFO] closing window")
        self.destroy()

    async def run(self):
        """
        Custom async-friendly mainloop:
          - Calls Tk update methods regularly
          - Yields control to the asyncio loop between frames
        """
        logging.info(f"[INFO] GUI event loop running: {asyncio.get_event_loop().is_running()}")
        while True:
            self.update_idletasks()
            self.update()
            await asyncio.sleep(0.01)

