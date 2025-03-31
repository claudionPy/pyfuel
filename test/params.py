from dataclasses import dataclass


@dataclass
class FuelParameters:
    sideExists: bool = False
    pulserPin: int = 18
    nozzleSwitchPin: int = 5
    relaySwitchPin: int = 17
    pulsesPerLiter: int = 100
    price: float = 1.000
    isAutomatic: bool = False
    relayActivationDelay: int = 3
    nozzleSwitch_invert_polarity: bool = True
    max_time_without_fueling: int = 60
    calibration_factor: float = 0.95
    simulation_pulser: bool = False

@dataclass
class GuiParameters:
    sideExists: bool = False
    buttonText: str = "Default"
    buttonWidth: int = 500
    buttonHeight: int = 200
    buttonColor: str = "#808080"
    buttonBorderColor: str = "#C0C0C0"
    aut_buttonColor: str = "#008000"
    aut_buttonBorderColor: str = "#556B2F"
    inuse_buttonColor: str = "#B00000"
    inuse_buttonBorderColor: str = "#8D0000"
    available_buttonColor: str = "#FF8C00"
    available_buttonBorderColor: str = "#DAA520"
    buttonBorderWidth: int = 15
    buttonCornerRadius: int = 200
    button_relx: float = None  # Aggiunto per posizionamento relativo
    button_rely: float = None  # Aggiunto per posizionamento relativo
    labelText: str = "L: "

@dataclass
class MainParameters:
    aut_MainLabel: str = "AVVICINARE TESSERA"
    man_MainLabel: str = "EROGATORE IN MANUALE"
    sel_MainLabel: str = "SELEZIONA LATO"
    ref_MainLabel: str = "TESSERA NON RICONOSCIUTA"
    exp_MainLabel: str = "TEMPO SELEZIONE SCADUTO"
    max_selection_time: int = 20

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
