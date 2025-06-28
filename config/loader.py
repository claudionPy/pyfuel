# loader.py
# Manages loading and saving the station’s JSON configuration,
# merging custom settings with defaults, and providing typed access.

import json
import logging
from copy import deepcopy
from pathlib import Path
from typing import Dict, Any
from dataclasses import asdict

from config.params import FuelParameters, GuiParameters, MainParameters

class ConfigManager:
    """
    Encapsulates reading, writing, and merging the station configuration.
    - default_config: built from dataclass defaults
    - current_config: in-memory dict after load_config()
    """

    def __init__(self, config_path: str = "config/config.json"):
        # Path to JSON file on disk
        self.config_path = Path(config_path)
        # Build the fallback defaults
        self.default_config = self._create_default_config()
        # Will hold the merged config after loading
        self.current_config = None

    def _create_default_config(self) -> Dict[str, Any]:
        """
        Construct the baseline configuration dict by serializing
        default dataclass instances for fuel, GUI, and main params.
        """
        return {
            "fuel_sides": {
                "side_1": asdict(FuelParameters(side_exists=True)),
                "side_2": asdict(FuelParameters(side_exists=False)),
            },
            "gui_sides": {
                "side_1": asdict(GuiParameters(side_exists=True)),
                "side_2": asdict(GuiParameters(side_exists=False)),
            },
            "main_parameters": asdict(MainParameters()),
        }

    def load_config(self) -> Dict[str, Any]:
        """
        Load JSON from disk, merge with defaults, and cache it.
        If file is missing or invalid, writes defaults and returns them.
        """
        try:
            # If missing, create file with defaults
            if not self.config_path.exists():
                logging.warning("Config file not found, creating default")
                self.save_config(self.default_config)
                self.current_config = deepcopy(self.default_config)
                return self.current_config

            # Read user-provided JSON
            with open(self.config_path, 'r') as f:
                custom = json.load(f)

            # Merge and cache
            merged = self._merge_with_defaults(custom)
            self.current_config = merged
            return merged

        except Exception as e:
            # On error, log and fallback to defaults
            logging.error(f"Error loading config: {e}, using defaults")
            self.current_config = deepcopy(self.default_config)
            return self.current_config

    def save_config(self, config: Dict[str, Any]) -> bool:
        """
        Write the given config dict to disk as formatted JSON.
        Returns True on success, False (and logs) on failure.
        """
        try:
            with open(self.config_path, 'w') as f:
                json.dump(config, f, indent=4)
            return True
        except Exception as e:
            logging.error(f"Error saving config: {e}")
            return False

    def _merge_with_defaults(self, custom: Dict[str, Any]) -> Dict[str, Any]:
        """
        Deep-merge a user-provided config onto the defaults:
        - Preserves any missing sections/keys from defaults
        - Updates nested dicts for each section
        """
        merged = deepcopy(self.default_config)

        for section, default_val in merged.items():
            if section not in custom:
                continue  # leave defaults untouched

            custom_val = custom[section]
            # If this section is a dict-of-dicts (fuel_sides or gui_sides)
            if isinstance(default_val, dict) and all(isinstance(v, dict) for v in default_val.values()):
                for key, val in custom_val.items():
                    if isinstance(val, dict):
                        # Merge nested parameters
                        merged[section].setdefault(key, {})
                        merged[section][key].update(val)
                    else:
                        merged[section][key] = val
            # If this section is a flat dict (main_parameters)
            elif isinstance(default_val, dict) and isinstance(custom_val, dict):
                merged[section].update(custom_val)
            else:
                # Scalar override
                merged[section] = custom_val

        return merged

    def get_fuel_parameters(self, side: int) -> FuelParameters:
        """
        Return a typed FuelParameters for the given side (1 or 2),
        based on the current_config or defaults if not loaded.
        """
        key = f"side_{side}"
        if self.current_config and key in self.current_config["fuel_sides"]:
            data = self.current_config["fuel_sides"][key]
            return FuelParameters(**data)
        return FuelParameters()

    def get_gui_parameters(self, side: int) -> GuiParameters:
        """
        Return a typed GuiParameters for the given side (1 or 2).
        Falls back to defaults if not present.
        """
        key = f"side_{side}"
        if self.current_config and key in self.current_config["gui_sides"]:
            data = self.current_config["gui_sides"][key]
            return GuiParameters(**data)
        return GuiParameters()

    def get_main_parameters(self) -> MainParameters:
        """
        Return a typed MainParameters object for general texts and timeouts.
        Falls back to defaults if config not loaded.
        """
        if self.current_config and "main_parameters" in self.current_config:
            return MainParameters(**self.current_config["main_parameters"])
        return MainParameters()

