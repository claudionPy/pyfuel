// app.js
// Entry point for the Fuel Dashboard web application.
// Wires together core logic, modules, UI components, and initializes on page load.

// === Core Imports ===
// Dashboard: central orchestrator object for managing modules and UI interactions.
import { Dashboard } from './core/dashboard.js';
// ApiService: abstraction over HTTP calls to the FastAPI backend.
import { ApiService } from './core/apiservice.js';
// Utilities: common helper functions (e.g., date formatting, query string parsing).
import { Utilities } from './core/utils.js';
// EventHandlers: centralized DOM event registration and delegation helpers.
import { EventHandlers } from './core/eventh.js';

// === Feature Modules ===
// Each module encapsulates one section's logic: fetching data, handling forms, rendering.
import { DispensesModule } from './modules/dispenses.js';      // Fuel dispense data (erogazioni)
import { VehiclesModule } from './modules/vehicles.js';       // Vehicle management (veicoli)
import { DriversModule } from './modules/drivers.js';         // Driver management (autisti)
import { ParametersModule } from './modules/parameters.js';   // Configuration parameter UI

// === UI Components ===
// Pagination controls, modals, toasts, and table rendering utilities.
import { Pagination } from './ui/pagination.js';       // Builds page navigation UI
import { Modals } from './ui/modals.js';               // Create and manage Bootstrap modals
import { Toast } from './ui/toast.js';                 // Show toast notifications
import { TableRenderer } from './ui/tablerenderer.js'; // Render data tables dynamically

// === Attach Modules to Dashboard ===
// Register each feature module under a named property on Dashboard,
// so Dashboard.init() can automatically wire up routes, menus, and event listeners.
Dashboard.Dispenses = DispensesModule;
Dashboard.Vehicles = VehiclesModule;
Dashboard.Drivers = DriversModule;
Dashboard.Parameters = ParametersModule;

// Register UI helpers on Dashboard for use within modules.
Dashboard.Pagination    = Pagination;
Dashboard.Modals        = Modals;
Dashboard.Toast         = Toast;
Dashboard.TableRenderer = TableRenderer;

// === Application Startup ===
// Wait for the DOM to be fully loaded, then initialize the Dashboard.
// Dashboard.init() will mount the default tab, load initial data, and bind events.
document.addEventListener('DOMContentLoaded', () => Dashboard.init());

// === Expose for Debugging ===
// Attach modules and the Dashboard object to window for easy access
// from the browser console during development or troubleshooting.
window.DispensesModule   = DispensesModule;
window.VehiclesModule    = VehiclesModule;
window.DriversModule     = DriversModule;
window.ParametersModule  = ParametersModule;
window.Dashboard         = Dashboard;

