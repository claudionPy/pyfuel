# app/schemas/config.py

from typing import Dict, Literal, Optional
from pydantic import BaseModel

class FuelParametersSchema(BaseModel):
    sideExists: bool
    pulserPin: int
    nozzleSwitchPin: int
    relaySwitchPin: int
    pulsesPerLiter: int
    price: float
    product: str
    isAutomatic: bool
    relayActivationDelay: int
    nozzleSwitch_invert_polarity: bool
    max_time_without_fueling: int
    calibration_factor: float
    simulation_pulser: bool

class GuiParametersSchema(BaseModel):
    sideExists: bool
    buttonText: str
    buttonWidth: int
    buttonHeight: int
    buttonColor: str
    buttonBorderColor: str
    aut_buttonColor: str
    aut_buttonBorderColor: str
    inuse_buttonColor: str
    inuse_buttonBorderColor: str
    available_buttonColor: str
    available_buttonBorderColor: str
    buttonBorderWidth: int
    buttonCornerRadius: int
    button_relx: Optional[float] = None
    button_rely: Optional[float] = None
    labelText: str

class MainParametersSchema(BaseModel):
    aut_MainLabel: str
    man_MainLabel: str
    sel_MainLabel: str
    ref_MainLabel: str
    exp_MainLabel: str
    max_selection_time: int

class FullConfigSchema(BaseModel):
    fuel_sides: Dict[Literal['side_1','side_2','side_3','side_4'], FuelParametersSchema]
    gui_sides:  Dict[Literal['side_1','side_2','side_3','side_4'], GuiParametersSchema]
    main_parameters: MainParametersSchema
