import { EventHandlers } from './eventh.js';
import { Utilities } from './utils.js';
import { DispensesModule } from '../modules/dispenses.js';

/**
 * Dashboard orchestrates UI initialization, data fetching, pagination, search,
 * and exports for the Dispenses, Vehicles, and Drivers sections.
 */
export class Dashboard {
    /**
     * Base URL for API endpoints (can be overridden via global window.API_BASE).
     * @type {string}
     */
    static API_BASE = window.API_BASE || 'http://localhost:8000';

    /**
     * Client-side caches for vehicles and drivers to avoid redundant requests.
     * @type {any[]|null}
     */
    static vehiclesCache = null;
    static driversCache = null;

    /**
     * Holds debounce timers keyed by action names to throttle rapid events.
     * @type {Object<string, number>}
     */
    static debounceTimers = {};

    /**
     * Pagination state for each resource section.
     * @type {Object}
     */
    static pagination = {
        dispenses: { currentPage: 1, pageSize: 25, totalItems: 0 },
        vehicles: { currentPage: 1, pageSize: 25, totalItems: 0 },
        drivers: { currentPage: 1, pageSize: 25, totalItems: 0 }
    };

    /**
     * Allowed fields for constructing field-specific search queries.
     * @type {Object<string, string[]>}
     */
    static allowedSearchFields = {
        dispenses: [
            'card', 'vehicle_id', 'company', 'vehicle_total_km',
            'erogation_side', 'mode', 'dispensed_product', 'dispensed_liters'
        ],
        vehicles: [
            'vehicle_id', 'company_vehicle', 'vehicle_total_km', 'plate',
            'request_vehicle_km'
        ],
        drivers: [
            'card', 'company', 'driver_full_name', 'request_pin',
            'request_vehicle_id'
        ]
    };

    /**
     * Initialize all dashboard behaviors: tabs, event handlers, forms, validation,
     * search helpers, pagination controls, and date pickers.
     */
    static init() {
        this.setupTabNavigation();
        EventHandlers.setupCoreEventListeners();
        this.setupFormHandlers();
        this.setupInputValidation();
        this.setupSearchFieldHelpers();
        this.setupPageSizeControls();
        this.setupDateTimePickers();

        // Delegate toggling parameters on dynamic checkboxes
        document.addEventListener('click', (e) => {
            if (e.target.matches('.form-check-input[data-type][data-side]')) {
                ParametersModule.toggleSideParameters(e.target);
            }
        });
    }

    /**
     * Enable switching between sidebar tabs by showing/hiding sections.
     */
    static setupTabNavigation() {
        document.querySelectorAll('.sidebar .nav-link').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                // Reset active class on all links
                document.querySelectorAll('.sidebar .nav-link')
                    .forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                // Hide all tab contents, show selected
                document.querySelectorAll('.tab-content')
                    .forEach(sec => sec.style.display = 'none');
                document.getElementById(this.getAttribute('data-tab')).style.display = 'block';
            });
        });
    }

    /**
     * Handle showing or hiding the PIN input based on checkbox state.
     */
    static setupFormHandlers() {
        document.getElementById('richiedi_pin')?.addEventListener('change', function () {
            const pinField = document.getElementById('pin');
            const pinError = document.getElementById('pin-error');
            if (this.checked) {
                pinField.required = true;
                pinField.classList.remove('is-invalid');
                pinError.style.display = 'none';
            } else {
                pinField.required = false;
            }
        });
    }

    /**
     * Validate total kilometers input on blur, showing a warning toast if invalid.
     */
    static setupInputValidation() {
        const kmInput = document.getElementById('km_totali_veicolo');
        if (kmInput) {
            kmInput.addEventListener('blur', function () {
                const value = this.value.trim();
                if (value && !/^\d*\.?\d+$/.test(value)) {
                    this.classList.add('is-invalid');
                    Toast.showToast('I chilometri devono essere un valore numerico', 'warning');
                } else {
                    this.classList.remove('is-invalid');
                }
            });
        }
    }

    /**
     * Attach handlers to page-size select controls to reload data on change.
     */
    static setupPageSizeControls() {
        document.getElementById('dispenses-page-size')?.addEventListener('change', (e) => {
            this.pagination.dispenses.pageSize = parseInt(e.target.value, 10);
            this.pagination.dispenses.currentPage = 1;
            DispensesModule.loadDispenses();
        });

        document.getElementById('vehicles-page-size')?.addEventListener('change', (e) => {
            this.pagination.vehicles.pageSize = parseInt(e.target.value, 10);
            this.pagination.vehicles.currentPage = 1;
            VehiclesModule.loadVehicles();
        });

        document.getElementById('drivers-page-size')?.addEventListener('change', (e) => {
            this.pagination.drivers.pageSize = parseInt(e.target.value, 10);
            this.pagination.drivers.currentPage = 1;
            DriversModule.loadDrivers();
        });
    }

    /**
     * Populate dropdowns with allowed search fields and wire up click-to-insert behavior.
     */
    static setupSearchFieldHelpers() {
        const createDropdownItems = (section, dropdownId) => {
            const dropdown = document.querySelector(`#${dropdownId} + ul.search-fields-dropdown`);
            if (!dropdown) return;
            dropdown.innerHTML = '';

            // Add header
            const header = document.createElement('li');
            header.className = 'dropdown-header';
            header.textContent = 'Campi di ricerca disponibili:';
            dropdown.appendChild(header);

            // Add each allowed field as a clickable item
            this.allowedSearchFields[section].forEach(field => {
                const item = document.createElement('li');
                const link = document.createElement('a');
                link.className = 'dropdown-item';
                link.href = '#';
                link.textContent = field;
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const input = document.getElementById(`${section}-search`);
                    input.value = `${field}: `;
                    input.focus();
                });
                item.appendChild(link);
                dropdown.appendChild(item);
            });
        };

        createDropdownItems('dispenses', 'dispensesFieldsDropdown');
        createDropdownItems('vehicles', 'vehiclesFieldsDropdown');
        createDropdownItems('drivers', 'driversFieldsDropdown');
    }

    /**
     * Initialize and wire up Flatpickr date/time pickers for filtering dispenses.
     */
    static setupDateTimePickers() {
        const fpOptions = {
            enableTime: true,
            time_24hr: true,
            dateFormat: "d/m/Y H:i",
            locale: "it",
            defaultDate: new Date(),
            utc: true,
            static: true,
            monthSelectorType: 'static',
            onReady: function () { this._input.removeAttribute('readonly'); },
            onChange: function (selectedDates) { if (selectedDates.length) this._input.dispatchEvent(new Event('change')); }
        };

        // Create picker instances
        const startPicker = flatpickr("#dispenses-start-filter", fpOptions);
        const endPicker = flatpickr("#dispenses-end-filter", fpOptions);

        // Clear filter button with debounce
        const debouncedClear = Utilities.debounce(() => {
            startPicker.clear();
            endPicker.clear();
            DispensesModule.loadDispenses();
        }, 300);

        document.getElementById('clear-time-filter').addEventListener('click', debouncedClear);
        document.getElementById('apply-time-filter').addEventListener('click',
            Utilities.debounce(() => DispensesModule.searchDispenses(), 300)
        );
    }

    /**
     * Parse user input into a field-specific or full-text search parameter object.
     * @param {string} query - Raw search string (e.g. "plate: ABC123").
     * @returns {Object} Key/value map for search parameters.
     */
    static parseSearchQuery(query) {
        // Handle timestamp filter
        const timestampMatch = query.match(/erogation_timestamp:\s*(.+)/);
        if (timestampMatch) {
            return { erogation_timestamp: timestampMatch[1].trim() };
        }

        // Handle generic field:value pattern
        const m = query.match(/^([\w]+)\s*:\s*(.+)$/);
        if (m) {
            const field = m[1].trim();
            let value = m[2].trim().replace(/^['"](.+)['"]$/, '$1');
            return { [field]: value };
        }

        // Fallback to full-text
        return { q: query };
    }

    /**
     * Ensure all search keys are permitted for the given section.
     * @param {string} section - "dispenses", "vehicles", or "drivers".
     * @param {Object} params - Parsed search parameters.
     * @throws {Error} If invalid field names are present.
     */
    static validateSearchParams(section, params) {
        const allowed = this.allowedSearchFields[section];
        const invalid = Object.keys(params).filter(k => !allowed.includes(k));
        if (invalid.length) {
            throw new Error(
                `Campo non valido${invalid.length > 1 ? 'i' : ''}: ` +
                `${invalid.join(', ')}. Campi disponibili: ${allowed.join(', ')}`
            );
        }
    }

    /**
     * Build a full URL with query string for API calls.
     * @param {string} basePath - Endpoint path (e.g. '/dispenses').
     * @param {Object} searchParams - Key/value map to append as query params.
     * @returns {string} Full URL ready for fetch.
     */
    static buildSearchUrl(basePath, searchParams) {
        const url = new URL(`${this.API_BASE}${basePath}`);
        Object.entries(searchParams).forEach(([key, value]) => {
            if (value != null && value !== '') {
                url.searchParams.append(key, value);
            }
        });
        return url.toString();
    }

    /**
     * Export an array of objects to CSV and trigger download.
     * @param {Object[]} data - Array of records (all objects should share same keys).
     * @param {string} filename - Desired CSV filename (e.g. 'export.csv').
     * @throws {Error} If data is empty or invalid.
     */
    static exportDataToCSV(data, filename) {
        if (!data || !data.length) {
            throw new Error('Nessun dato da esportare');
        }

        // Extract headers from first record
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];

        // Serialize each record, escaping quotes
        data.forEach(item => {
            const values = headers.map(header => {
                const val = item[header] != null ? item[header] : '';
                return `"${String(val).replace(/"/g, '""')}"`;
            });
            csvRows.push(values.join(','));
        });

        // Create CSV blob and download
        const csvContent = csvRows.join('\n');
        this.downloadCSV(csvContent, filename);
    }

    /**
     * Trigger browser download of a CSV string.
     * @param {string} csv - Raw CSV file content.
     * @param {string} filename - Filename to assign to download.
     */
    static downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }

    /**
     * Clear in-memory caches for vehicles and drivers.
     */
    static clearCaches() {
        this.vehiclesCache = null;
        this.driversCache = null;
    }
}

