import { EventHandlers } from './eventh.js';
import { Utilities } from './utils.js';
import { DispensesModule } from '../modules/dispenses.js';

export class Dashboard {
    static API_BASE = window.API_BASE || 'http://localhost:8000';
    static vehiclesCache = null;
    static driversCache = null;
    static debounceTimers = {};

    // Configurazione paginazione
    static pagination = {
        dispenses: {
            currentPage: 1,
            pageSize: 25,
            totalItems: 0
        },
        vehicles: {
            currentPage: 1,
            pageSize: 25,
            totalItems: 0
        },
        drivers: {
            currentPage: 1,
            pageSize: 25,
            totalItems: 0
        }
    };

    // Campi di ricerca consentiti per ogni sezione
    static allowedSearchFields = {
        dispenses: [
            'card',
            'vehicle_id',
            'company',
            'vehicle_total_km',
            'erogation_side',
            'mode',
            'dispensed_product',
            'dispensed_liters',
        ],
        vehicles: [
            'vehicle_id',
            'company_vehicle',
            'vehicle_total_km',
            'plate',
            'request_vehicle_km'
        ],
        drivers: [
            'card',
            'company',
            'driver_full_name',
            'request_pin',
            'request_vehicle_id'
        ]
    };

    static init() {
        this.setupTabNavigation();
        EventHandlers.setupCoreEventListeners();
        this.setupFormHandlers();
        this.setupInputValidation();
        this.setupSearchFieldHelpers();
        this.setupPageSizeControls();
        this.setupDateTimePickers();

        document.addEventListener('click', (e) => {
            if (e.target.matches('.form-check-input[data-type][data-side]')) {
                ParametersModule.toggleSideParameters(e.target);
            }
        });
    }

    static setupTabNavigation() {
        document.querySelectorAll('.sidebar .nav-link').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                document.querySelectorAll('.sidebar .nav-link').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                document.querySelectorAll('.tab-content').forEach(sec => sec.style.display = 'none');
                document.getElementById(this.getAttribute('data-tab')).style.display = 'block';
            });
        });
    }

    static setupFormHandlers() {
        // Toggle richiesta PIN autista
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

    static setupPageSizeControls() {
        // Dimensione pagina erogazioni
        document.getElementById('dispenses-page-size')?.addEventListener('change', (e) => {
            this.pagination.dispenses.pageSize = parseInt(e.target.value);
            this.pagination.dispenses.currentPage = 1;
            DispensesModule.loadDispenses();
        });

        // Dimensione pagina veicoli
        document.getElementById('vehicles-page-size')?.addEventListener('change', (e) => {
            this.pagination.vehicles.pageSize = parseInt(e.target.value);
            this.pagination.vehicles.currentPage = 1;
            VehiclesModule.loadVehicles();
        });

        // Dimensione pagina autisti
        document.getElementById('drivers-page-size')?.addEventListener('change', (e) => {
            this.pagination.drivers.pageSize = parseInt(e.target.value);
            this.pagination.drivers.currentPage = 1;
            DriversModule.loadDrivers();
        });
    }

    static setupSearchFieldHelpers() {
        // Funzione helper per creare elementi dropdown
        const createDropdownItems = (section, dropdownId) => {
            const dropdown = document.querySelector(`#${dropdownId} + ul.search-fields-dropdown`);
            if (!dropdown) return;

            dropdown.innerHTML = '';

            // Aggiungi intestazione
            const header = document.createElement('li');
            header.className = 'dropdown-header';
            header.textContent = 'Campi di ricerca disponibili:';
            dropdown.appendChild(header);

            // Aggiungi ogni campo come elemento cliccabile
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

        // Configura per ogni sezione
        createDropdownItems('dispenses', 'dispensesFieldsDropdown');
        createDropdownItems('vehicles', 'vehiclesFieldsDropdown');
        createDropdownItems('drivers', 'driversFieldsDropdown');
    }

    static setupDateTimePickers() {
        // Shared configuration for both pickers
        const fpOptions = {
            enableTime: true,
            time_24hr: true,
            dateFormat: "d/m/Y H:i",
            locale: "it",
            defaultDate: new Date(),
            utc: true,
            static: true,
            monthSelectorType: 'static',
            onReady: function () {
                this._input.removeAttribute('readonly');
            },
            onChange: function (selectedDates) {
                if (selectedDates.length) {
                    this._input.dispatchEvent(new Event('change'));
                }
            }
        };

        // Initialize pickers with debounced event handlers
        const startPicker = flatpickr("#dispenses-start-filter", fpOptions);
        const endPicker = flatpickr("#dispenses-end-filter", fpOptions);

        // Debounced clear handler
        const debouncedClear = Utilities.debounce(() => {
            startPicker.clear();
            endPicker.clear();
            DispensesModule.loadDispenses();
        }, 300);

        // Lightweight event listeners
        document.getElementById('clear-time-filter').addEventListener('click', debouncedClear);
        document.getElementById('apply-time-filter').addEventListener('click',
            Utilities.debounce(() => DispensesModule.searchDispenses(), 300));
    }

    static parseSearchQuery(query) {
        // Gestisci la ricerca per timestamp
        const timestampMatch = query.match(/erogation_timestamp:\s*(.+)/);
        if (timestampMatch) {
            return { erogation_timestamp: timestampMatch[1].trim() };
        }

        // Analisi campo:valore esistente
        const m = query.match(/^([a-zA-Z0-9_]+)\s*:\s*(.+)$/);
        if (m) {
            const field = m[1].trim();
            let value = m[2].trim().replace(/^['"](.+)['"]$/, '$1');
            return { [field]: value };
        }
        return { q: query };
    }

    static validateSearchParams(section, params) {
        const allowed = this.allowedSearchFields[section];
        const invalid = Object.keys(params).filter(k => !allowed.includes(k));
        if (invalid.length) {
            throw new Error(`Campo non valido${invalid.length > 1 ? 'i' : ''}: ${invalid.join(', ')}. Campi disponibili: ${allowed.join(', ')}`);
        }
    }

    static buildSearchUrl(basePath, searchParams) {
        const url = new URL(`${this.API_BASE}${basePath}`);
        Object.entries(searchParams).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.append(key, value);
            }
        });
        return url.toString();
    }

    static exportDataToCSV(data, filename) {
        if (!data || !data.length) {
            throw new Error('Nessun dato da esportare');
        }

        // Ottieni le intestazioni dalle chiavi del primo oggetto
        const headers = Object.keys(data[0]);

        // Crea il contenuto CSV
        const csvRows = [];

        // Aggiungi riga di intestazione
        csvRows.push(headers.join(','));

        // Aggiungi righe di dati
        data.forEach(item => {
            const values = headers.map(header => {
                const value = item[header] !== undefined ? item[header] : '';
                return `"${String(value).replace(/"/g, '""')}"`;
            });
            csvRows.push(values.join(','));
        });

        // Crea e scarica il file CSV
        const csvContent = csvRows.join('\n');
        this.downloadCSV(csvContent, filename);
    }

    static downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }

    static clearCaches() {
        this.vehiclesCache = null;
        this.driversCache = null;
    }
}
