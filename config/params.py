# params.py
# Defines dataclasses for raw config values, and grouped side containers.

from dataclasses import dataclass

@dataclass
class FuelParameters:
    """
    Raw configuration for one pump side:
      side_exists: whether the hardware is present
      pulser_pin: GPIO pin for the flow sensor
      nozzle_pin: GPIO pin for the nozzle switch
      relay_pin: GPIO pin for pump control
      pulses_per_liter: calibration pulses-to-volume ratio
      price: cost per liter
      product: fuel/product name
      automatic_mode: True to require RFID auth
      relay_activation_timer: delay before enabling relay
      reverse_nozzle_polarity: invert input logic if needed
      timeout_reached_without_dispensing: safety stop time
      calibration_factor: multiplier to adjust flow reading
      simulation_pulser: True to generate fake pulses for testing
    """
    side_exists: bool = False
    pulser_pin: int = 18
    nozzle_pin: int = 5
    relay_pin: int = 17
    pulses_per_liter: int = 100
    price: float = 0.001
    product: str = "Default"
    automatic_mode: bool = False
    relay_activation_timer: int = 3
    reverse_nozzle_polarity: bool = True
    timeout_reached_without_dispensing: int = 60
    calibration_factor: float = 1
    simulation_pulser: bool = False

@dataclass
class GuiParameters:
    """
    Raw GUI layout and color settings for a pump side button:
      side_exists: whether to render this side
      button_text: label on the button
      button_width/height: pixel dimensions
      button_color/border_color: default styling
      automatic_button_color/border_color: colors in auto mode
      busy_button_color/border_color: colors while dispensing
      available_button_color/border_color: highlight when ready
      button_border_width: outline thickness
      button_corner_radius: rounding of corners
      button_relx/button_rely: relative placement coordinates
      preset_label: label for the liters display (e.g. "L: ")
    """
    side_exists: bool = False
    button_text: str = "Default"
    button_width: int = 500
    button_height: int = 200
    button_color: str = "#808080"
    button_border_color: str = "#C0C0C0"
    automatic_button_color: str = "#008000"
    automatic_button_border_color: str = "#556B2F"
    busy_button_color: str = "#B00000"
    busy_button_border_color: str = "#8D0000"
    available_button_color: str = "#FF8C00"
    available_button_border_color: str = "#DAA520"
    button_border_width: int = 10
    button_corner_radius: int = 100
    button_relx: float = 0.13
    button_rely: float = 0.2
    preset_label: str = "L: "

@dataclass
class MainParameters:
    """
    Application-wide prompts and timeouts:
      automatic_mode_text: shown awaiting RFID scan
      manual_mode_text: displayed in manual dispensing
      select_side_text: prompt after card validation
      refused_card_text: shown for unrecognized card
      selection_timeout_text: if user delays side selection
      all_sides_selected_text: if no pump is free
      pin_error_text: on wrong PIN entry
      vehicle_not_found_text: on invalid vehicle ID
      km_error_text: on non-numeric odometer
      km_error_text_2: on odometer too low
      pin_keyboard_text: prompt label on PIN dialog
      vehicle_id_text: prompt label on vehicle dialog
      km_prompt_text: prompt label on km dialog
      selection_time: seconds before selection times out
    """
    automatic_mode_text: str = "AVVICINARE TESSERA"
    manual_mode_text: str = "EROGATORE IN MANUALE"
    select_side_text: str = "SELEZIONA LATO"
    refused_card_text: str = "TESSERA NON RICONOSCIUTA"
    selection_timeout_text: str = "TEMPO SCADUTO"
    all_sides_selected_text: str = "TUTTI I LATI SELEZIONATI, ATTENDI"
    pin_error_text: str = "PIN ERRATO"
    vehicle_not_found_text: str = "VEICOLO NON TROVATO"
    km_error_text: str = "KM NON VALIDI"
    km_error_text_2: str = "KM INSERITI TROPPO BASSI"
    pin_keyboard_text: str = "INSERIRE PIN:"
    vehicle_id_text: str = "INSERIRE ID VEICOLO:"
    km_prompt_text: str = "INSERIRE KM:"
    selection_time: int = 20

@dataclass
class FuelSides:
    """
    Container grouping two FuelParameters instances
    for side_1 and side_2.
    """
    side_1: FuelParameters
    side_2: FuelParameters

@dataclass
class GuiSides:
    """
    Container grouping two GuiParameters instances
    for side_1 and side_2.
    """
    side_1: GuiParameters
    side_2: GuiParameters

