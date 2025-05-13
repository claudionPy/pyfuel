from typing import Dict, Literal, Optional
from pydantic import BaseModel

class FuelParametersSchema(BaseModel):
    side_exists: bool
    pulser_pin: int
    nozzle_pin: int
    relay_pin: int
    pulses_per_liter: int
    price: float
    product: str
    automatic_mode: bool
    relay_activation_timer: int
    reverse_nozzle_polarity: bool
    timeout_reached_without_dispensing: int
    calibration_factor: float
    simulation_pulser: bool

class GuiParametersSchema(BaseModel):
    side_exists: bool
    button_text: str
    button_width: int
    button_height: int
    button_color: str
    button_border_color: str
    automatic_button_color: str
    automatic_button_border_color: str
    busy_button_color: str
    busy_button_border_color: str
    available_button_color: str
    available_button_border_color: str
    button_border_width: int
    button_corner_radius: int
    button_relx: Optional[float] = None
    button_rely: Optional[float] = None
    preset_label: str

class MainParametersSchema(BaseModel):
    automatic_mode_text: str
    manual_mode_text: str
    select_side_text: str
    refused_card_text: str
    selection_timeout_text: str
    selection_time: int

class FullConfigSchema(BaseModel):
    fuel_sides: Dict[Literal['side_1','side_2'], FuelParametersSchema]
    gui_sides:  Dict[Literal['side_1','side_2'], GuiParametersSchema]
    main_parameters: MainParametersSchema
