from dataclasses import dataclass


@dataclass
class FuelParameters:
    side_exists: bool = False
    pulser_pin: int = 18
    nozzle_pin: int = 5
    relay_pin: int = 17
    pulses_per_liter: int = 100
    price: float = 1.000
    product: str = "Gasolio"
    automatic_mode: bool = False
    relay_activation_timer: int = 3
    reverse_nozzle_polarity: bool = True
    timeout_reached_without_dispensing: int = 60
    calibration_factor: float = 0.94
    simulation_pulser: bool = False

@dataclass
class GuiParameters:
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
    button_border_width: int = 15
    button_corner_radius: int = 200
    button_relx: float = None
    button_rely: float = None
    preset_label: str = "L: "

@dataclass
class MainParameters:
    automatic_mode_text: str = "AVVICINARE TESSERA"
    manual_mode_text: str = "EROGATORE IN MANUALE"
    select_side_text: str = "SELEZIONA LATO"
    refused_card_text: str = "TESSERA NON RICONOSCIUTA"
    selection_timeout_text: str = "TEMPO SELEZIONE SCADUTO"
    selection_time: int = 20

@dataclass
class FuelSides:
    side_1: FuelParameters
    side_2: FuelParameters
    side_3: FuelParameters
    side_4: FuelParameters

@dataclass
class GuiSides:
    side_1: GuiParameters
    side_2: GuiParameters
    side_3: GuiParameters
    side_4: GuiParameters
