import { Utilities } from "./utils.js";
import { DispensesModule } from "../modules/dispenses.js";
import { VehiclesModule } from "../modules/vehicles.js";
import { DriversModule } from "../modules/drivers.js";
import { ParametersModule } from "../modules/parameters.js";
import { TableRenderer } from "../ui/tablerenderer.js";
import { Modals } from "../ui/modals.js";

/**
 * EventHandlers sets up core UI event listeners for forms, buttons,
 * and keyboard interactions across the dashboard.
 */
export class EventHandlers {
    /**
     * Attach all primary event listeners: form submits, data loading,
     * searching, exporting, and parameter management.
     */
    static setupCoreEventListeners() {
        // Vehicle form submission
        const formVehicle = document.getElementById('form-vehicle');
        if (formVehicle) {
            formVehicle.addEventListener('submit', event => {
                event.preventDefault();
                VehiclesModule.handleVehicleSubmit(event);
            });
        }

        // Driver form submission
        const formDriver = document.getElementById('form-driver');
        if (formDriver) {
            formDriver.addEventListener('submit', event => {
                event.preventDefault();
                DriversModule.handleDriverSubmit(event);
            });
        }

        // Load and search dispenses with debouncing
        document.getElementById('load-dispenses')
            .addEventListener('click', Utilities.debounce(
                () => DispensesModule.loadDispenses(), 300
            ));
        document.getElementById('search-dispenses')
            .addEventListener('click', () => DispensesModule.searchDispenses());
        document.getElementById('dispenses-search')
            .addEventListener('keypress', e => {
                if (e.key === 'Enter') DispensesModule.searchDispenses();
            });

        // Load and search vehicles
        document.getElementById('load-vehicles')
            .addEventListener('click', Utilities.debounce(
                () => VehiclesModule.loadVehicles(), 300
            ));
        document.getElementById('search-vehicles')
            .addEventListener('click', Utilities.debounce(
                () => VehiclesModule.searchVehicles(), 300
            ));
        document.getElementById('vehicles-search')
            .addEventListener('keypress', e => e.key === 'Enter' && VehiclesModule.searchVehicles());
        // Show vehicle modal for adding a new entry
        document.getElementById('add-vehicle')
            .addEventListener('click', () => {
                const form = document.getElementById('form-vehicle');
                form.reset();
                delete form.dataset.originalId;
                Modals.showModal('modal-vehicle');
            });

        // Load and search drivers
        document.getElementById('load-drivers')
            .addEventListener('click', Utilities.debounce(
                () => DriversModule.loadDrivers(), 300
            ));
        document.getElementById('search-drivers')
            .addEventListener('click', Utilities.debounce(
                () => DriversModule.searchDrivers(), 300
            ));
        document.getElementById('drivers-search')
            .addEventListener('keypress', e => e.key === 'Enter' && DriversModule.searchDrivers());
        // Show driver modal for adding a new entry
        document.getElementById('add-driver')
            .addEventListener('click', () => {
                const form = document.getElementById('form-driver');
                form.reset();
                delete form.dataset.originaltessera;
                Modals.showModal('modal-driver');
            });

        // Table export and bulk actions for dispenses
        document.getElementById('export-dispenses')
            .addEventListener('click', () =>
                TableRenderer.exportCurrentPageTable('dispense-table', 'erogazioni.csv')
            );
        document.getElementById('export-all-dispenses')
            .addEventListener('click', () => DispensesModule.exportAllDispenses());
        document.getElementById('delete-all-dispenses')
            .addEventListener('click', () => DispensesModule.deleteAllDispenses());

        // Table export for vehicles and drivers
        document.getElementById('export-vehicles')
            .addEventListener('click', () =>
                TableRenderer.exportCurrentPageTable('vehicles-table', 'veicoli.csv')
            );
        document.getElementById('export-all-vehicles')
            .addEventListener('click', () => VehiclesModule.exportAllVehicles());
        document.getElementById('export-drivers')
            .addEventListener('click', () =>
                TableRenderer.exportCurrentPageTable('drivers-table', 'autisti.csv')
            );
        document.getElementById('export-all-drivers')
            .addEventListener('click', () => DriversModule.exportAllDrivers());

        // Parameter management: load, save, reset
        document.getElementById('load-parameters')
            .addEventListener('click', Utilities.debounce(
                () => ParametersModule.loadParameters(), 300
            ));
        document.getElementById('save-parameters')
            .addEventListener('click', Utilities.debounce(
                () => ParametersModule.saveParameters(), 300
            ));
        document.getElementById('reset-parameters')
            .addEventListener('click', () => ParametersModule.resetParameters());
    }
}

