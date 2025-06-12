import json
import logging
from copy import deepcopy
from pathlib import Path
from typing import Dict, Any
from dataclasses import asdict
from config.params import FuelParameters, GuiParameters, MainParameters

class ConfigManager:
    def __init__(self, config_path: str = "config/config.json"):
        self.config_path = Path(config_path)
        self.default_config = self._create_default_config()
        self.current_config = None
        
    def _create_default_config(self) -> Dict[str, Any]:
        return {
            "fuel_sides": {
                "side_1": asdict(FuelParameters(side_exists=True)),
                "side_2": asdict(FuelParameters(side_exists=False))
            },
            "gui_sides": {
                "side_1": asdict(GuiParameters(side_exists=True)),
                "side_2": asdict(GuiParameters(side_exists=False))
            },
            "main_parameters": asdict(MainParameters())
        }
    
    def load_config(self) -> Dict[str, Any]:
        try:
            if not self.config_path.exists():
                logging.warning("Config file not found, creating default")
                self.save_config(self.default_config)
                return self.default_config
            
            with open(self.config_path, 'r') as f:
                loaded_config = json.load(f)
                
            merged_config = self._merge_with_defaults(loaded_config)
            self.current_config = merged_config
            return merged_config
            
        except Exception as e:
            logging.error(f"Error loading config: {e}, using defaults")
            return self.default_config
    
    def save_config(self, config: Dict[str, Any]) -> bool:
        try:
            with open(self.config_path, 'w') as f:
                json.dump(config, f, indent=4)
            return True
        except Exception as e:
            logging.error(f"Error saving config: {e}")
            return False
    
    def _merge_with_defaults(self, custom_config: Dict[str, Any]) -> Dict[str, Any]:
        merged = deepcopy(self.default_config)

        for section, default_val in merged.items():
            if section not in custom_config:
                continue

            custom_val = custom_config[section]
            if isinstance(default_val, dict) and all(isinstance(v, dict) for v in default_val.values()):
                for key, val in custom_val.items():
                    if isinstance(val, dict):
                        merged[section].setdefault(key, {})
                        merged[section][key].update(val)
                    else:
                        merged[section][key] = val
            elif isinstance(default_val, dict) and isinstance(custom_val, dict):
                merged[section].update(custom_val)
            else:
                merged[section] = custom_val

        return merged
    
    def get_fuel_parameters(self, side: int) -> FuelParameters:
        side_key = f"side_{side}"
        if self.current_config and side_key in self.current_config["fuel_sides"]:
            return FuelParameters(**self.current_config["fuel_sides"][side_key])
        return FuelParameters()
    
    def get_gui_parameters(self, side: int) -> GuiParameters:
        side_key = f"side_{side}"
        if self.current_config and side_key in self.current_config["gui_sides"]:
            return GuiParameters(**self.current_config["gui_sides"][side_key])
        return GuiParameters()
    
    def get_main_parameters(self) -> MainParameters:
        if self.current_config and "main_parameters" in self.current_config:
            return MainParameters(**self.current_config["main_parameters"])
        return MainParameters()
