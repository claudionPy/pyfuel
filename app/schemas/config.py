# config.py
# Defines Pydantic schemas for loading and validating station configuration.

from typing import Dict, Literal, Optional
from pydantic import BaseModel

class FuelParametersSchema(BaseModel):
    """
    Configuration for a single fuel pump side.
    
    Attributes:
      - side_exists: whether this side is physically present
      - pulser_pin: GPIO pin number for flow sensor pulses
      - nozzle_pin: GPIO pin number for nozzle up/down switch
      - relay_pin: GPIO pin number to control pump relay
      - pulses_per_liter: number of pulses per liter of fuel
      - price: price per liter in currency units
      - product: descriptive name of the fuel/product
      - automatic_mode: True if this side uses RFID-based auth
      - relay_activation_timer: safety timer before relay activation
      - reverse_nozzle_polarity: invert logic if hardware switch reversed
      - timeout_reached_without_dispensing: seconds to wait for flow before auto‐stop
      - calibration_factor: adjustment multiplier for flow calibration
      - simulation_pulser: True to generate fake pulses (test mode)
    """
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
    """
    Appearance and layout settings for one GUI pump‐side button.
    
    Attributes:
      - side_exists: whether this side’s GUI should be rendered
      - button_text: label text on the button (e.g. “1” or “A”)
      - button_width/height: pixel dimensions of the button
      - button_color/border_color: default colors
      - automatic_button_color/border_color: colors in automatic mode
      - busy_button_color/border_color: colors when dispensing
      - available_button_color/border_color: colors when ready
      - button_border_width: thickness of button outline
      - button_corner_radius: roundness of button corners
      - button_relx/button_rely: optional placement coordinates (relative)
      - preset_label: text label for the liters display (“L” or custom)
    """
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
    """
    Application‐wide display texts and timeouts.
    
    Attributes:
      - automatic_mode_text: shown when waiting for RFID in auto mode
      - manual_mode_text: shown when in manual dispensing mode
      - select_side_text: prompt after successful card validation
      - refused_card_text: shown on scanning unknown card
      - selection_timeout_text: shown if user takes too long to pick side
      - all_sides_selected_text: shown if no pump is available
      - pin_error_text: shown on wrong PIN entry
      - vehicle_not_found_text: shown if entered vehicle ID is invalid
      - km_error_text / km_error_text_2: shown on odometer entry errors
      - pin_keyboard_text: prompt label for PIN keypad
      - vehicle_id_text: prompt label for vehicle‐ID keypad
      - km_prompt_text: prompt label for odometer‐entry keypad
      - selection_time: seconds before side‐selection times out
    """
    automatic_mode_text: str
    manual_mode_text: str
    select_side_text: str
    refused_card_text: str
    selection_timeout_text: str
    all_sides_selected_text: str
    pin_error_text: str
    vehicle_not_found_text: str
    km_error_text: str
    km_error_text_2: str
    pin_keyboard_text: str
    vehicle_id_text: str
    km_prompt_text: str
    selection_time: int

class FullConfigSchema(BaseModel):
    """
    Top‐level structure representing the entire station configuration.
    
    Attributes:
      - fuel_sides: mapping 'side_1'/'side_2' → FuelParametersSchema
      - gui_sides: mapping 'side_1'/'side_2' → GuiParametersSchema
      - main_parameters: texts and timeouts in MainParametersSchema
    """
    fuel_sides: Dict[Literal['side_1','side_2'], FuelParametersSchema]
    gui_sides: Dict[Literal['side_1','side_2'], GuiParametersSchema]
    main_parameters: MainParametersSchema

