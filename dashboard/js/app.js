import { Dashboard } from './core/dashboard.js';
import { ApiService } from './core/apiservice.js';
import { Utilities } from './core/utils.js';
import { EventHandlers } from './core/eventh.js';

import { DispensesModule } from './modules/dispenses.js';
import { VehiclesModule } from './modules/vehicles.js';
import { DriversModule } from './modules/drivers.js';
import { ParametersModule } from './modules/parameters.js';

import { Pagination } from './ui/pagination.js';
import { Modals } from './ui/modals.js';
import { Toast } from './ui/toast.js';
import { TableRenderer } from './ui/tablerenderer.js';

Dashboard.Dispenses = DispensesModule;
Dashboard.Vehicles = VehiclesModule;
Dashboard.Drivers = DriversModule;
Dashboard.Parameters = ParametersModule;

Dashboard.Pagination = Pagination;
Dashboard.Modals = Modals;
Dashboard.Toast = Toast;
Dashboard.TableRenderer = TableRenderer;

document.addEventListener('DOMContentLoaded', () => Dashboard.init());

window.DispensesModule = DispensesModule;
window.VehiclesModule = VehiclesModule;
window.DriversModule = DriversModule;
window.ParametersModule = ParametersModule;
window.Dashboard = Dashboard;
