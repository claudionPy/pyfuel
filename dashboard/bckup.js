// ds-bootstrap-script.js
// utilità per leggere in sicurezza un valore da un input
function safeGetValue(id, def = '') {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`Elemento mancante: ${id}`);
        return def;
    }
    return el.value;
}

function safeGetChecked(id, def = false) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`Elemento mancante: ${id}`);
        return def;
    }
    return el.checked;
}

class Dashboard {
    static API_BASE = window.API_BASE || 'http://raspberrypi.local:8000';
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
            'erogation_timestamp'
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

    // Inizializza la dashboard
    static init() {
        this.setupTabNavigation();
        this.setupEventListeners();
        this.setupFormHandlers();
        this.setupInputValidation();
        this.setupSearchFieldHelpers();
        this.setupPageSizeControls();
        this.setupDateTimePickers();

        document.addEventListener('click', (e) => {
            if (e.target.matches('.form-check-input[data-type][data-side]')) {
                this.toggleSideParameters(e.target);
            }
        });
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
            static: true,  // Position calendar statically to prevent layout recalculations
            monthSelectorType: 'static', // Better performance
            onReady: function () {
                // Lightweight ready handler
                this._input.removeAttribute('readonly');
            },
            onChange: function (selectedDates) {
                // Minimal change handler
                if (selectedDates.length) {
                    this._input.dispatchEvent(new Event('change'));
                }
            }
        };

        // Initialize pickers with debounced event handlers
        const startPicker = flatpickr("#dispenses-start-filter", fpOptions);
        const endPicker = flatpickr("#dispenses-end-filter", fpOptions);

        // Debounced clear handler
        const debouncedClear = this.debounce(() => {
            startPicker.clear();
            endPicker.clear();
            this.loadDispenses();
        }, 300);

        // Lightweight event listeners
        document.getElementById('clear-time-filter').addEventListener('click', debouncedClear);
        document.getElementById('apply-time-filter').addEventListener('click',
            this.debounce(() => this.searchDispenses(), 300));
    }

    // Configura la navigazione tra tab
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

    // Configura i listener degli eventi
    static setupEventListeners() {
        // Form veicolo
        const formVehicle = document.getElementById('form-vehicle');
        if (formVehicle) {
            formVehicle.addEventListener('submit', event => {
                event.preventDefault();
                this.handleVehicleSubmit(event);
            });
        }

        // Form autista
        const formDriver = document.getElementById('form-driver');
        if (formDriver) {
            formDriver.addEventListener('submit', event => {
                event.preventDefault();
                this.handleDriverSubmit(event);
            });
        }

        // Erogazioni
        document.getElementById('load-dispenses').addEventListener('click',
            this.debounce(() => this.loadDispenses(), 300));

        document.getElementById('search-dispenses').addEventListener('click', () => {
            this.searchDispenses();
        });

        document.getElementById('dispenses-search').addEventListener('keypress', e => {
            if (e.key === 'Enter') this.searchDispenses();
        });

        // Veicoli
        document.getElementById('load-vehicles').addEventListener('click',
            this.debounce(() => this.loadVehicles(), 300));
        document.getElementById('search-vehicles').addEventListener('click',
            this.debounce(() => this.searchVehicles(), 300));
        document.getElementById('vehicles-search').addEventListener('keypress',
            e => e.key === 'Enter' && this.searchVehicles());
        document.getElementById('add-vehicle').addEventListener('click', () => {
            const form = document.getElementById('form-vehicle');
            form.reset();
            delete form.dataset.originalId;
            this.showModal('modal-vehicle');
        });

        // Autisti
        document.getElementById('load-drivers').addEventListener('click',
            this.debounce(() => this.loadDrivers(), 300));
        document.getElementById('search-drivers').addEventListener('click',
            this.debounce(() => this.searchDrivers(), 300));
        document.getElementById('drivers-search').addEventListener('keypress',
            e => e.key === 'Enter' && this.searchDrivers());
        document.getElementById('add-driver').addEventListener('click', () => {
            const form = document.getElementById('form-driver');
            form.reset();
            delete form.dataset.originaltessera;
            this.showModal('modal-driver');
        });

        // Pulsanti esportazione ed eliminazione
        document.getElementById('export-dispenses').addEventListener('click',
            () => this.exportCurrentPageTable('dispense-table', 'erogazioni.csv'));
        document.getElementById('export-all-dispenses').addEventListener('click',
            () => this.exportAllDispenses());
        document.getElementById('delete-all-dispenses').addEventListener('click',
            () => this.deleteAllDispenses());
        document.getElementById('export-vehicles').addEventListener('click',
            () => this.exportCurrentPageTable('vehicles-table', 'veicoli.csv'));
        document.getElementById('export-all-vehicles').addEventListener('click',
            () => this.exportAllVehicles());
        document.getElementById('export-drivers').addEventListener('click',
            () => this.exportCurrentPageTable('drivers-table', 'autisti.csv'));
        document.getElementById('export-all-drivers').addEventListener('click',
            () => this.exportAllDrivers());

        // Parametri
        document.getElementById('load-parameters').addEventListener('click',
            this.debounce(() => this.loadParameters(), 300));
        document.getElementById('save-parameters').addEventListener('click',
            this.debounce(() => this.saveParameters(), 300));
        document.getElementById('reset-parameters').addEventListener('click',
            () => this.resetParameters());
    }

    // Configura i gestori dei form
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

    // Configura la validazione degli input
    static setupInputValidation() {
        const kmInput = document.getElementById('km_totali_veicolo');
        if (kmInput) {
            kmInput.addEventListener('blur', function () {
                const value = this.value.trim();
                if (value && !/^\d*\.?\d+$/.test(value)) {
                    this.classList.add('is-invalid');
                    Dashboard.showToast('I chilometri devono essere un valore numerico', 'warning');
                } else {
                    this.classList.remove('is-invalid');
                }
            });
        }
    }

    // Configura i controlli della dimensione della pagina
    static setupPageSizeControls() {
        // Dimensione pagina erogazioni
        document.getElementById('dispenses-page-size')?.addEventListener('change', (e) => {
            this.pagination.dispenses.pageSize = parseInt(e.target.value);
            this.pagination.dispenses.currentPage = 1;
            this.loadDispenses();
        });

        // Dimensione pagina veicoli
        document.getElementById('vehicles-page-size')?.addEventListener('change', (e) => {
            this.pagination.vehicles.pageSize = parseInt(e.target.value);
            this.pagination.vehicles.currentPage = 1;
            this.loadVehicles();
        });

        // Dimensione pagina autisti
        document.getElementById('drivers-page-size')?.addEventListener('change', (e) => {
            this.pagination.drivers.pageSize = parseInt(e.target.value);
            this.pagination.drivers.currentPage = 1;
            this.loadDrivers();
        });
    }

    // Configura gli helper per i campi di ricerca
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

    // Carica le erogazioni con paginazione
    static async loadDispenses(page = null, filters = {}) {
        // Update current page if specified
        if (page !== null) {
            this.pagination.dispenses.currentPage = page;
        }

        const { currentPage, pageSize } = this.pagination.dispenses;
        const loading = document.getElementById('dispenses-loading');
        const btn = document.getElementById('load-dispenses');

        try {
            btn.disabled = true;
            loading.classList.remove('d-none');

            const urlParams = new URLSearchParams({
                page: currentPage,  // Now uses the updated page number
                limit: pageSize,
                ...filters
            });

            const url = `${this.API_BASE}/erogations/?${urlParams.toString()}`;
            const data = await this.fetchWithRetry(url);

            this.pagination.dispenses.totalItems = data.total;
            this.renderDispenses(data.items);
            this.updatePaginationControls('dispenses');

            this.showToast(`Pagina ${currentPage} di ${Math.ceil(data.total / pageSize)}`);
        } catch (err) {
            this.showDetailedErrorToast(err, 'Caricamento fallito');
            // Revert to previous page on error
            if (page !== null) {
                this.pagination.dispenses.currentPage = 1;
                this.updatePaginationControls('dispenses');
            }
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    // Carica i veicoli con paginazione
    static async loadVehicles(page = null) {
        if (page !== null) {
            this.pagination.vehicles.currentPage = page;
        }

        const { currentPage, pageSize } = this.pagination.vehicles;
        const loading = document.getElementById('vehicles-loading');
        const btn = document.getElementById('load-vehicles');

        try {
            btn.disabled = true;
            loading.classList.remove('d-none');

            const url = `${this.API_BASE}/vehicles/?page=${currentPage}&limit=${pageSize}`;
            const data = await this.fetchWithRetry(url);

            this.pagination.vehicles.totalItems = data.total || data.items.length;
            this.vehiclesCache = data.items;
            this.renderVehicles(data.items);
            this.updatePaginationControls('vehicles');

            this.showToast(`Veicoli caricati (pagina ${currentPage})`);
        } catch (err) {
            this.showDetailedErrorToast(err, 'Caricamento veicoli fallito');
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    // Carica gli autisti con paginazione
    static async loadDrivers(page = null) {
        if (page !== null) {
            this.pagination.drivers.currentPage = page;
        }

        const { currentPage, pageSize } = this.pagination.drivers;
        const loading = document.getElementById('drivers-loading');
        const btn = document.getElementById('load-drivers');

        try {
            btn.disabled = true;
            loading.classList.remove('d-none');

            const url = `${this.API_BASE}/drivers/?page=${currentPage}&limit=${pageSize}`;
            const data = await this.fetchWithRetry(url);

            this.pagination.drivers.totalItems = data.total || data.items.length;
            this.driversCache = data.items;
            this.renderDrivers(data.items);
            this.updatePaginationControls('drivers');

            this.showToast(`Autisti caricati (pagina ${currentPage})`);
        } catch (err) {
            this.showDetailedErrorToast(err, 'Caricamento autisti fallito');
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    // Cerca erogazioni
    static async searchDispenses() {
        // Get picker instances directly (more efficient)
        const startPicker = document.getElementById('dispenses-start-filter')._flatpickr;
        const endPicker = document.getElementById('dispenses-end-filter')._flatpickr;

        // Get dates without creating new objects
        const startTime = startPicker.selectedDates[0]?.toISOString();
        const endTime = endPicker.selectedDates[0]?.toISOString();

        // Only proceed if at least one date is selected
        if (!startTime && !endTime) {
            this.showToast('Seleziona almeno una data', 'warning');
            return;
        }

        try {
            // Show loading state
            const btn = document.getElementById('search-dispenses');
            btn.disabled = true;
            document.getElementById('dispenses-loading').classList.remove('d-none');

            // Build efficient search params
            const searchParams = new URLSearchParams({
                page: this.pagination.dispenses.currentPage,
                limit: this.pagination.dispenses.pageSize
            });

            if (startTime) searchParams.append('start_time', startTime);
            if (endTime) searchParams.append('end_time', endTime);

            // Make API call
            const url = `${this.API_BASE}/erogations/search/?${searchParams.toString()}`;
            const data = await this.fetchWithRetry(url);

            // Efficient rendering
            this.pagination.dispenses.totalItems = data.total;
            this.renderDispenses(data.items);
            this.updatePaginationControls('dispenses');

        } catch (err) {
            this.showDetailedErrorToast(err, 'Ricerca fallita');
        } finally {
            const btn = document.getElementById('search-dispenses');
            btn.disabled = false;
            document.getElementById('dispenses-loading').classList.add('d-none');
        }
    }

    // Cerca veicoli con paginazione
    static async searchVehicles() {
        const input = document.getElementById('vehicles-search');
        const query = input.value.trim();
        const loading = document.getElementById('vehicles-loading');
        const btn = document.getElementById('load-vehicles');

        // Reimposta alla prima pagina durante la ricerca
        this.pagination.vehicles.currentPage = 1;

        if (!query) {
            this.showToast('Inserire un termine di ricerca', 'warning');
            input.focus();
            return this.loadVehicles();
        }

        try {
            btn.disabled = true;
            loading.classList.remove('d-none');

            let searchParams;
            try {
                searchParams = this.parseSearchQuery(query);
                this.validateSearchParams('vehicles', searchParams);
            } catch (err) {
                this.showToast(err.message, 'warning');
                return;
            }

            const { currentPage, pageSize } = this.pagination.vehicles;
            const url = this.buildSearchUrl('/vehicles/search/', {
                ...searchParams,
                page: currentPage,
                limit: pageSize
            });

            const data = await this.fetchWithRetry(url);
            this.pagination.vehicles.totalItems = data.total || data.items.length;
            this.vehiclesCache = data.items;
            this.renderVehicles(data.items);
            this.updatePaginationControls('vehicles');

            if (data.items.length === 0) {
                this.showToast('Nessun veicolo corrispondente ai criteri di ricerca', 'info');
            } else {
                const itemCount = data.items.length;
                const totalCount = this.pagination.vehicles.totalItems;
                const message = totalCount > itemCount
                    ? `Mostrati ${itemCount} di ${totalCount} veicoli corrispondenti`
                    : `Trovati ${itemCount} veicoli corrispondenti`;
                this.showToast(message);
            }
        } catch (err) {
            this.showDetailedErrorToast(err, 'Ricerca fallita');
            document.querySelector('#vehicles-table tbody').innerHTML = '';
            this.pagination.vehicles.totalItems = 0;
            this.updatePaginationControls('vehicles');
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    // Cerca autisti con paginazione
    static async searchDrivers() {
        const input = document.getElementById('drivers-search');
        const query = input.value.trim();
        const loading = document.getElementById('drivers-loading');
        const btn = document.getElementById('load-drivers');

        // Reimposta alla prima pagina durante la ricerca
        this.pagination.drivers.currentPage = 1;

        if (!query) {
            this.showToast('Inserire un termine di ricerca', 'warning');
            input.focus();
            return this.loadDrivers();
        }

        try {
            btn.disabled = true;
            loading.classList.remove('d-none');

            let searchParams;
            try {
                searchParams = this.parseSearchQuery(query);
                this.validateSearchParams('drivers', searchParams);
            } catch (err) {
                this.showToast(err.message, 'warning');
                return;
            }

            const { currentPage, pageSize } = this.pagination.drivers;
            const url = this.buildSearchUrl('/drivers/search/', {
                ...searchParams,
                page: currentPage,
                limit: pageSize
            });

            const data = await this.fetchWithRetry(url);
            this.pagination.drivers.totalItems = data.total || data.items.length;
            this.driversCache = data.items;
            this.renderDrivers(data.items);
            this.updatePaginationControls('drivers');

            if (data.items.length === 0) {
                this.showToast('Nessun autista corrispondente ai criteri di ricerca', 'info');
            } else {
                const itemCount = data.items.length;
                const totalCount = this.pagination.drivers.totalItems;
                const message = totalCount > itemCount
                    ? `Mostrati ${itemCount} di ${totalCount} autisti corrispondenti`
                    : `Trovati ${itemCount} autisti corrispondenti`;
                this.showToast(message);
            }
        } catch (err) {
            this.showDetailedErrorToast(err, 'Ricerca fallita');
            document.querySelector('#drivers-table tbody').innerHTML = '';
            this.pagination.drivers.totalItems = 0;
            this.updatePaginationControls('drivers');
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    // Analizza la query di ricerca
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

    // Valida i parametri di ricerca
    static validateSearchParams(section, params) {
        const allowed = this.allowedSearchFields[section];
        const invalid = Object.keys(params).filter(k => !allowed.includes(k));
        if (invalid.length) {
            throw new Error(`Campo non valido${invalid.length > 1 ? 'i' : ''}: ${invalid.join(', ')}. Campi disponibili: ${allowed.join(', ')}`);
        }
    }

    // Costruisci URL di ricerca
    static buildSearchUrl(basePath, searchParams) {
        const url = new URL(`${this.API_BASE}${basePath}`);
        Object.entries(searchParams).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.append(key, value);
            }
        });
        return url.toString();
    }

    // Visualizza le erogazioni nella tabella
    static renderDispenses(data) {
        const tbody = document.querySelector('#dispense-table tbody');

        // Use document fragment and batch DOM operations
        const fragment = document.createDocumentFragment();
        const rowTemplate = document.createElement('tr');

        data.forEach(item => {
            const row = rowTemplate.cloneNode();
            row.innerHTML = `
            <td>${item.card || '-'}</td>
            <td>${item.vehicle_id || '-'}</td>
            <td>${item.company || '-'}</td>
            <td>${item.vehicle_total_km || '0'}</td>
            <td>${item.erogation_side || '-'}</td>
            <td>${item.mode || '-'}</td>
            <td>${item.dispensed_product || '-'}</td>
            <td>${item.dispensed_liters || '0'}</td>
            <td>${this.formatTimestamp(item.erogation_timestamp)}</td>
        `;
            fragment.appendChild(row);
        });

        // Single DOM update
        tbody.innerHTML = '';
        tbody.appendChild(fragment);
    }

    static formatTimestamp(timestamp) {
        if (!timestamp) return '-';
        try {
            const date = new Date(timestamp.endsWith('Z') ? timestamp : `${timestamp}Z`);
            return isNaN(date) ? '-' : date.toLocaleString('it-IT');
        } catch {
            return '-';
        }
    }

    static normalizeTimestamp(timestamp) {
        if (!timestamp) return null;

        // If it's already a Date object
        if (timestamp instanceof Date) return timestamp;

        // If it's a number (epoch time)
        if (!isNaN(timestamp)) return new Date(Number(timestamp));

        // If it's an ISO string without Z (UTC indicator)
        if (typeof timestamp === 'string' && !timestamp.endsWith('Z')) {
            // Try adding Z if it looks like an ISO string without timezone
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(timestamp)) {
                return new Date(timestamp + 'Z');
            }
        }

        // Default case - let Date constructor handle it
        return new Date(timestamp);
    }

    // Visualizza i veicoli nella tabella
    static renderVehicles(data) {
        const tbody = document.querySelector('#vehicles-table tbody');
        const fragment = document.createDocumentFragment();

        data.forEach(v => {
            const tr = document.createElement('tr');
            // Tratta l'ID come stringa
            const vehicleId = v.vehicle_id !== undefined && v.vehicle_id !== null ? String(v.vehicle_id) : '-';
            tr.innerHTML = `
                <td>${vehicleId}</td>
                <td>${v.company_vehicle || '-'}</td>
                <td>${v.vehicle_total_km || '0'}</td>
                <td>${v.plate || '-'}</td>
                <td>${v.request_vehicle_km ? 'Sì' : 'No'}</td>
                <td>
                    <button class="btn btn-sm btn-primary me-1"
                            onclick="Dashboard.editVehicle('${vehicleId}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-danger"
                            onclick="Dashboard.deleteVehicle('${vehicleId}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            fragment.appendChild(tr);
        });

        tbody.innerHTML = '';
        tbody.appendChild(fragment);
    }

    // Visualizza gli autisti nella tabella
    static renderDrivers(data) {
        const tbody = document.querySelector('#drivers-table tbody');
        const fragment = document.createDocumentFragment();

        data.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.card || '-'}</td>
                <td>${u.company || '-'}</td>
                <td>${u.driver_full_name || '-'}</td>
                <td>${u.pin || '-'}</td>
                <td>${u.request_pin ? 'Sì' : 'No'}</td>
                <td>${u.request_vehicle_id ? 'Sì' : 'No'}</td>
                <td>
                    <button class="btn btn-sm btn-primary me-1"
                            onclick="Dashboard.editDriver('${u.card}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-danger"
                            onclick="Dashboard.deleteDriver('${u.card}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            fragment.appendChild(tr);
        });

        tbody.innerHTML = '';
        tbody.appendChild(fragment);
    }

    // Gestisce l'invio del form veicolo
    static async handleVehicleSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const kmInput = form.km_totali_veicolo;

        // Valida l'input dei chilometri
        if (kmInput.value.trim() && !/^\d*\.?\d+$/.test(kmInput.value.trim())) {
            kmInput.classList.add('is-invalid');
            this.showToast('I chilometri devono essere un valore numerico', 'warning');
            return;
        }

        try {
            const payload = {
                vehicle_id: form.id_veicolo.value, // Invia come stringa
                company_vehicle: form.nome_compagnia.value,
                vehicle_total_km: String(form.km_totali_veicolo.value || '0'),
                plate: form.targa.value,
                request_vehicle_km: form.richiedi_km_veicolo.checked
            };

            const method = form.dataset.originalId ? 'PUT' : 'POST';
            const url = form.dataset.originalId
                ? `${this.API_BASE}/vehicles/${encodeURIComponent(form.dataset.originalId)}`
                : `${this.API_BASE}/vehicles/`;

            await this.fetchWithRetry(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            this.hideModal('modal-vehicle');
            form.reset();
            delete form.dataset.originalId;

            this.vehiclesCache = null;
            await this.loadVehicles();

            this.showToast(`Veicolo ${method === 'POST' ? 'creato' : 'aggiornato'} con successo`);
        } catch (err) {
            this.showDetailedErrorToast(err, 'Operazione veicolo fallita');
        }
    }

    // Gestisce l'invio del form autista
    static async handleDriverSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const pinError = document.getElementById('pin-error');

        if (form.richiedi_pin.checked && !form.pin.value) {
            form.pin.classList.add('is-invalid');
            pinError.style.display = 'block';
            return;
        }

        try {
            const payload = {
                card: form.tessera.value,
                company: form.nome_compagnia.value,
                driver_full_name: form.nome_autista.value,
                request_pin: form.richiedi_pin.checked,
                request_vehicle_id: form.richiedi_id_veicolo.checked,
                pin: form.pin.value
            };

            const method = form.dataset.originaltessera ? 'PUT' : 'POST';
            const url = form.dataset.originaltessera
                ? `${this.API_BASE}/drivers/${encodeURIComponent(form.dataset.originaltessera)}`
                : `${this.API_BASE}/drivers/`;

            await this.fetchWithRetry(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            this.hideModal('modal-driver');
            form.reset();
            delete form.dataset.originaltessera;

            this.driversCache = null;
            await this.loadDrivers();

            this.showToast(`Autista ${method === 'POST' ? 'creato' : 'aggiornato'} con successo`);
        } catch (err) {
            this.showDetailedErrorToast(err, 'Operazione autista fallita');
        }
    }

    // Modifica veicolo
    static async editVehicle(vehicleId) {
        try {
            if (!this.vehiclesCache) {
                await this.loadVehicles();
            }

            // Gestisci sia ID stringa che numerici
            const vehicle = this.vehiclesCache.find(v =>
                String(v.vehicle_id) === String(vehicleId)
            );

            if (!vehicle) {
                throw new Error('Veicolo non trovato');
            }

            const form = document.getElementById('form-vehicle');
            // Mostra l'ID come stringa
            form.id_veicolo.value = String(vehicle.vehicle_id);
            form.nome_compagnia.value = vehicle.company_vehicle || '';
            form.km_totali_veicolo.value = vehicle.vehicle_total_km || '0';
            form.targa.value = vehicle.plate || '';
            form.richiedi_km_veicolo.checked = vehicle.request_vehicle_km || false;

            // Memorizza l'ID originale come stringa
            form.dataset.originalId = String(vehicle.vehicle_id);
            this.showModal('modal-vehicle');
            this.showToast('Modifica i campi del veicolo e salva le modifiche');
        } catch (err) {
            console.error('Errore modifica veicolo:', err);
            this.showToast(`Errore durante la modifica: ${err.message}`, 'danger');
        }
    }

    // Modifica autista
    static async editDriver(tessera) {
        try {
            if (!this.driversCache) {
                await this.loadDrivers();
            }

            const driver = this.driversCache.find(d => d.card === tessera);
            if (!driver) {
                throw new Error('Autista non trovato');
            }

            const form = document.getElementById('form-driver');
            form.tessera.value = driver.card;
            form.nome_compagnia.value = driver.company || '';
            form.nome_autista.value = driver.driver_full_name || '';
            form.richiedi_pin.checked = driver.request_pin || false;
            form.richiedi_id_veicolo.checked = driver.request_vehicle_id || false;
            form.pin.value = driver.pin || '';

            form.dataset.originaltessera = driver.card;
            this.showModal('modal-driver');
            this.showToast('Modifica i campi dell\'autista e salva le modifiche');
        } catch (err) {
            console.error('Errore modifica autista:', err);
            this.showToast(`Errore durante la modifica: ${err.message}`, 'danger');
        }
    }

    // Elimina veicolo
    static async deleteVehicle(vehicleId) {
        if (!confirm(`Sei sicuro di voler eliminare il veicolo con ID: ${vehicleId}?`)) return;

        try {
            const res = await fetch(`${this.API_BASE}/vehicles/${encodeURIComponent(vehicleId)}`, {
                method: 'DELETE'
            });

            if (res.status === 204 || res.ok) {
                this.vehiclesCache = null;
                await this.loadVehicles();
                this.showToast('Veicolo eliminato con successo');
            } else {
                let errorMessage;
                try {
                    const errorData = await res.json();
                    errorMessage = errorData.message || errorData.error || 'Eliminazione fallita';
                } catch (e) {
                    errorMessage = await res.text();
                }
                throw new Error(errorMessage);
            }
        } catch (err) {
            this.showDetailedErrorToast(err, 'Veicolo non eliminato');
        }
    }

    // Elimina autista
    static async deleteDriver(card) {
        if (!confirm(`Sei sicuro di voler eliminare l'autista con tessera: ${card}?`)) return;

        try {
            const res = await fetch(`${this.API_BASE}/drivers/${encodeURIComponent(card)}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.status === 204 || res.ok) {
                this.driversCache = null;
                await this.loadDrivers();
                this.showToast('Autista eliminato con successo');
            } else {
                let errorMessage;
                try {
                    const errorData = await res.json();
                    errorMessage = errorData.message || errorData.error || 'Eliminazione fallita';
                } catch (e) {
                    errorMessage = await res.text();
                }
                throw new Error(errorMessage);
            }
        } catch (err) {
            this.showDetailedErrorToast(err, 'Autista non eliminato');
        }
    }

    // Elimina tutte le erogazioni
    static async deleteAllDispenses() {
        if (!confirm('Sei sicuro di voler eliminare TUTTE le erogazioni? L\'operazione è irreversibile.')) {
            return;
        }
        try {
            const res = await fetch(`${this.API_BASE}/erogations/`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.status === 204 || res.ok) {
                document.querySelector('#dispense-table tbody').innerHTML = '';
                this.pagination.dispenses.totalItems = 0;
                this.updatePaginationControls('dispenses');
                this.showToast('Erogazioni eliminate con successo');
            } else {
                const text = await res.text();
                throw new Error(text || 'Errore durante l\'eliminazione delle erogazioni');
            }
        } catch (err) {
            console.error('Errore eliminazione erogazioni:', err);
            this.showToast(`Errore: ${err.message}`, 'danger');
        }
    }

    // Carica i parametri
    static async loadParameters() {
        const loading = document.getElementById('parameters-loading');
        const btn = document.getElementById('load-parameters');

        try {
            btn.disabled = true;
            loading.classList.remove('d-none');

            const url = `${this.API_BASE}/parameters/`;
            const data = await this.fetchWithRetry(url);

            // Visualizza tutte le sezioni dei parametri
            this.renderFuelParameters(data.fuel_sides);
            this.renderGuiParameters(data.gui_sides);
            this.renderMainParameters(data.main_parameters);

            this.showToast('Parametri caricati con successo');
        } catch (err) {
            this.showDetailedErrorToast(err, 'Caricamento parametri fallito');
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    // Attiva/disattiva i parametri del lato
    static async toggleSideParameters(checkbox) {
        const side = checkbox.dataset.side;
        const type = checkbox.dataset.type;
        const isActive = checkbox.checked;

        try {
            // Aggiorna il colore dell'intestazione immediatamente
            const containerId = `${type}-side-${side}-params`;
            const container = document.getElementById(containerId);
            if (container) {
                const header = container.closest('.card')?.querySelector('.card-header');
                if (header) {
                    header.className = `card-header ${isActive ? 'bg-primary' : 'bg-secondary'} text-white`;
                }
            }

            // Se si sta attivando, dobbiamo caricare i parametri
            if (isActive) {
                // Ottieni i parametri correnti per mostrare i valori esistenti
                const url = `${this.API_BASE}/parameters/`;
                const data = await this.fetchWithRetry(url);

                const sideKey = `side_${side}`;
                let sideParams = {};

                if (type === 'fuel') {
                    sideParams = data.fuel_sides[sideKey] || {
                        pulser_pin: 0,
                        nozzle_pin: 0,
                        relay_pin: 0,
                        pulses_per_liter: 0,
                        price: 0,
                        product: '',
                        automatic_mode: false,
                        relay_activation_timer: 0,
                        reverse_nozzle_polarity: false,
                        timeout_reached_without_dispensing: 0,
                        calibration_factor: 1.0,
                        simulation_pulser: false
                    };
                    container.innerHTML = `
                    <div class="mb-3 form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="fuel-${side}-enabled"
                            checked data-side="${side}" data-type="fuel"
                            onchange="Dashboard.toggleSideParameters(this)">
                        <label class="form-check-label" for="fuel-${side}-enabled">Lato abilitato</label>
                    </div>
                    ${this.getFuelSideParametersHtml(side, sideParams)}
                `;
                } else {
                    sideParams = data.gui_sides[sideKey] || {
                        button_text: '',
                        button_width: 0,
                        button_height: 0,
                        button_color: '#808080',
                        button_border_color: '#C0C0C0',
                        automatic_button_color: '#008000',
                        automatic_button_border_color: '#556B2F',
                        busy_button_color: '#B00000',
                        busy_button_border_color: '#8D0000',
                        available_button_color: '#FF8C00',
                        available_button_border_color: '#DAA520',
                        button_border_width: 0,
                        button_corner_radius: 0,
                        button_relx: 0,
                        button_rely: 0,
                        preset_label: ''
                    };
                    container.innerHTML = `
                    <div class="mb-3 form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="gui-${side}-enabled"
                            checked data-side="${side}" data-type="gui"
                            onchange="Dashboard.toggleSideParameters(this)">
                        <label class="form-check-label" for="gui-${side}-enabled">Lato abilitato</label>
                    </div>
                    ${this.getGuiSideParametersHtml(side, sideParams)}
                `;
                }
            } else {
                // Se si sta disattivando, mostra solo la checkbox di abilitazione
                document.getElementById(containerId).innerHTML = `
                <div class="mb-3 form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="${type}-${side}-enabled"
                        ${isActive ? 'checked' : ''} data-side="${side}" data-type="${type}"
                        onchange="Dashboard.toggleSideParameters(this)">
                    <label class="form-check-label" for="${type}-${side}-enabled">Lato abilitato</label>
                </div>
            `;
            }
        } catch (err) {
            console.error('Errore caricamento parametri lato:', err);
            checkbox.checked = false;
            this.showToast('Caricamento parametri lato fallito', 'danger');
        }
    }

    // Visualizza i parametri carburante
    static renderFuelParameters(sides) {
        for (let i = 1; i <= 4; i++) {
            const sideKey = `side_${i}`;
            const container = document.getElementById(`fuel-side-${i}-params`);
            if (!container) continue;

            const side = sides[sideKey] || {};
            const isActive = side.side_exists || false;

            // Classe dinamica per l'intestazione in base allo stato attivo
            const headerClass = isActive ? 'bg-primary' : 'bg-secondary';
            const header = container.closest('.card')?.querySelector('.card-header');
            if (header) {
                header.className = `card-header ${headerClass} text-white`;
            }

            let html = `
            <div class="mb-3 form-check form-switch">
                <input class="form-check-input" type="checkbox" id="fuel-${i}-enabled"
                    ${isActive ? 'checked' : ''} data-side="${i}" data-type="fuel"
                    onchange="Dashboard.toggleSideParameters(this)">
                <label class="form-check-label" for="fuel-${i}-enabled">Lato abilitato</label>
            </div>
        `;

            if (isActive) {
                // Inizializza con valori predefiniti se non esistono
                const sideParams = {
                    pulser_pin: side.pulser_pin || 0,
                    nozzle_pin: side.nozzle_pin || 0,
                    relay_pin: side.relay_pin || 0,
                    pulses_per_liter: side.pulses_per_liter || 0,
                    price: side.price || 0,
                    product: side.product || '',
                    automatic_mode: side.automatic_mode || false,
                    relay_activation_timer: side.relay_activation_timer || 0,
                    reverse_nozzle_polarity: side.reverse_nozzle_polarity || false,
                    timeout_reached_without_dispensing: side.timeout_reached_without_dispensing || 0,
                    calibration_factor: side.calibration_factor || 1.0,
                    simulation_pulser: side.simulation_pulser || false
                };

                html += this.getFuelSideParametersHtml(i, sideParams);
            }

            container.innerHTML = html;
        }
    }

    // Ottieni HTML per i parametri carburante del lato
    static getFuelSideParametersHtml(side, params) {
        return `
        <div class="mb-3">
            <label for="fuel-${side}-pulser_pin" class="form-label">Pin contatore impulsi</label>
            <input type="number" class="form-control" id="fuel-${side}-pulser_pin"
                value="${params.pulser_pin}">
        </div>
        <div class="mb-3">
            <label for="fuel-${side}-nozzle_pin" class="form-label">Pin interruttore pompa</label>
            <input type="number" class="form-control" id="fuel-${side}-nozzle_pin"
                value="${params.nozzle_pin}">
        </div>
        <div class="mb-3">
            <label for="fuel-${side}-relay_pin" class="form-label">Pin relè</label>
            <input type="number" class="form-control" id="fuel-${side}-relay_pin"
                value="${params.relay_pin}">
        </div>
        <div class="mb-3">
            <label for="fuel-${side}-pulses_per_liter" class="form-label">Impulsi per litro</label>
            <input type="number" class="form-control" id="fuel-${side}-pulses_per_liter"
                value="${params.pulses_per_liter}">
        </div>
        <div class="mb-3">
            <label for="fuel-${side}-price" class="form-label">Prezzo</label>
            <input type="number" step="0.01" class="form-control" id="fuel-${side}-price"
                value="${params.price}">
        </div>
        <div class="mb-3">
            <label for="fuel-${side}-product" class="form-label">Prodotto</label>
            <input type="text" class="form-control" id="fuel-${side}-product"
                value="${params.product}">
        </div>
        <div class="mb-3 form-check">
            <input class="form-check-input" type="checkbox" id="fuel-${side}-automatic_mode"
                ${params.automatic_mode ? 'checked' : ''}>
            <label class="form-check-label" for="fuel-${side}-automatic_mode">Modalità automatica</label>
        </div>
        <div class="mb-3">
            <label for="fuel-${side}-relay_activation_timer" class="form-label">Ritardo attivazione relè (s)</label>
            <input type="number" class="form-control" id="fuel-${side}-relay_activation_timer"
                value="${params.relay_activation_timer}">
        </div>
        <div class="mb-3 form-check">
            <input class="form-check-input" type="checkbox" id="fuel-${side}-reverse_nozzle_polarity"
                ${params.reverse_nozzle_polarity ? 'checked' : ''}>
            <label class="form-check-label" for="fuel-${side}-reverse_nozzle_polarity">
                Inverti polarità interruttore pompa
            </label>
        </div>
        <div class="mb-3">
            <label for="fuel-${side}-timeout_reached_without_dispensing" class="form-label">Tempo max senza erogazione (s)</label>
            <input type="number" class="form-control" id="fuel-${side}-timeout_reached_without_dispensing"
                value="${params.timeout_reached_without_dispensing}">
        </div>
        <div class="mb-3">
            <label for="fuel-${side}-calibration_factor" class="form-label">Fattore di calibrazione</label>
            <input type="number" step="0.01" class="form-control" id="fuel-${side}-calibration_factor"
                value="${params.calibration_factor}">
        </div>
        <div class="mb-3 form-check">
            <input class="form-check-input" type="checkbox" id="fuel-${side}-simulation_pulser"
                ${params.simulation_pulser ? 'checked' : ''}>
            <label class="form-check-label" for="fuel-${side}-simulation_pulser">
                Simulatore contatore impulsi
            </label>
        </div>
    `;
    }

    // Visualizza i parametri GUI
    static renderGuiParameters(sides) {
        for (let i = 1; i <= 4; i++) {
            const sideKey = `side_${i}`;
            const container = document.getElementById(`gui-side-${i}-params`);
            if (!container) continue;

            const side = sides[sideKey] || {};
            const isActive = side.side_exists || false;

            // Classe dinamica per l'intestazione in base allo stato attivo
            const headerClass = isActive ? 'bg-primary' : 'bg-secondary';
            const header = container.closest('.card')?.querySelector('.card-header');
            if (header) {
                header.className = `card-header ${headerClass} text-white`;
            }

            let html = `
            <div class="mb-3 form-check form-switch">
                <input class="form-check-input" type="checkbox" id="gui-${i}-enabled"
                    ${isActive ? 'checked' : ''} data-side="${i}" data-type="gui"
                    onchange="Dashboard.toggleSideParameters(this)">
                <label class="form-check-label" for="gui-${i}-enabled">Lato abilitato</label>
            </div>
        `;

            if (isActive) {
                // Inizializza con valori predefiniti se non esistono
                const sideParams = {
                    button_text: side.button_text || '',
                    button_width: side.button_width || 0,
                    button_height: side.button_height || 0,
                    button_color: side.button_color || '#808080',
                    button_border_color: side.button_border_color || '#C0C0C0',
                    automatic_button_color: side.automatic_button_color || '#008000',
                    automatic_button_border_color: side.automatic_button_border_color || '#556B2F',
                    busy_button_color: side.busy_button_color || '#B00000',
                    busy_button_border_color: side.busy_button_border_color || '#8D0000',
                    available_button_color: side.available_button_color || '#FF8C00',
                    available_button_border_color: side.available_button_border_color || '#DAA520',
                    button_border_width: side.button_border_width || 0,
                    button_corner_radius: side.button_corner_radius || 0,
                    button_relx: side.button_relx || 0,
                    button_rely: side.button_rely || 0,
                    preset_label: side.preset_label || ''
                };

                html += this.getGuiSideParametersHtml(i, sideParams);
            }

            container.innerHTML = html;
        }
    }

    // Ottieni HTML per i parametri GUI del lato
    static getGuiSideParametersHtml(side, params) {
        return `
        <div class="mb-3">
            <label for="gui-${side}-button_text" class="form-label">Testo pulsante</label>
            <input type="text" class="form-control" id="gui-${side}-button_text"
                value="${params.button_text}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-button_width" class="form-label">Larghezza pulsante</label>
            <input type="number" class="form-control" id="gui-${side}-button_width"
                value="${params.button_width}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-button_height" class="form-label">Altezza pulsante</label>
            <input type="number" class="form-control" id="gui-${side}-button_height"
                value="${params.button_height}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-button_color" class="form-label">Colore pulsante</label>
            <input type="color" class="form-control form-control-color" id="gui-${side}-button_color"
                value="${params.button_color}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-button_border_color" class="form-label">Colore bordo pulsante</label>
            <input type="color" class="form-control form-control-color" id="gui-${side}-button_border_color"
                value="${params.button_border_color}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-automatic_button_color" class="form-label">Colore pulsante automatico</label>
            <input type="color" class="form-control form-control-color" id="gui-${side}-automatic_button_color"
                value="${params.automatic_button_color}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-automatic_button_border_color" class="form-label">Colore bordo automatico</label>
            <input type="color" class="form-control form-control-color" id="gui-${side}-automatic_button_border_color"
                value="${params.automatic_button_border_color}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-busy_button_color" class="form-label">Colore pulsante in uso</label>
            <input type="color" class="form-control form-control-color" id="gui-${side}-busy_button_color"
                value="${params.busy_button_color}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-busy_button_border_color" class="form-label">Colore bordo in uso</label>
            <input type="color" class="form-control form-control-color" id="gui-${side}-busy_button_border_color"
                value="${params.busy_button_border_color}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-available_button_color" class="form-label">Colore pulsante disponibile</label>
            <input type="color" class="form-control form-control-color" id="gui-${side}-available_button_color"
                value="${params.available_button_color}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-available_button_border_color" class="form-label">Colore bordo disponibile</label>
            <input type="color" class="form-control form-control-color" id="gui-${side}-available_button_border_color"
                value="${params.available_button_border_color}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-preset_label" class="form-label">Testo etichetta</label>
            <input type="text" class="form-control" id="gui-${side}-preset_label"
                value="${params.preset_label}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-button_border_width" class="form-label">Spessore bordo</label>
            <input type="number" class="form-control" id="gui-${side}-button_border_width"
                value="${params.button_border_width}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-button_corner_radius" class="form-label">Raggio angoli</label>
            <input type="number" class="form-control" id="gui-${side}-button_corner_radius"
                value="${params.button_corner_radius}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-button_relx" class="form-label">Posizione X relativa (%)</label>
            <input type="number" step="0.01" class="form-control" id="gui-${side}-button_relx"
                value="${params.button_relx}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-button_rely" class="form-label">Posizione Y relativa (%)</label>
            <input type="number" step="0.01" class="form-control" id="gui-${side}-button_rely"
                value="${params.button_rely}">
        </div>
    `;
    }

    // Visualizza i parametri principali
    static renderMainParameters(params) {
        const container = document.getElementById('main-params');
        if (!container) return;

        container.innerHTML = `
        <div class="mb-3">
            <label for="main-automatic_mode_text" class="form-label">Etichetta modalità automatica</label>
            <input type="text" class="form-control" id="main-automatic_mode_text"
                value="${params.automatic_mode_text || ''}">
        </div>
        <div class="mb-3">
            <label for="main-manual_mode_text" class="form-label">Etichetta modalità manuale</label>
            <input type="text" class="form-control" id="main-manual_mode_text"
                value="${params.manual_mode_text || ''}">
        </div>
        <div class="mb-3">
            <label for="main-select_side_text" class="form-label">Etichetta selezione lato</label>
            <input type="text" class="form-control" id="main-select_side_text"
                value="${params.select_side_text || ''}">
        </div>
        <div class="mb-3">
            <label for="main-refused_card_text" class="form-label">Etichetta tessera rifiutata</label>
            <input type="text" class="form-control" id="main-refused_card_text"
                value="${params.refused_card_text || ''}">
        </div>
        <div class="mb-3">
            <label for="main-selection_timeout_text" class="form-label">Etichetta timeout selezione</label>
            <input type="text" class="form-control" id="main-selection_timeout_text"
                value="${params.selection_timeout_text || ''}">
        </div>
        <div class="mb-3">
            <label for="main-selection_time" class="form-label">Tempo max selezione (s)</label>
            <input type="number" class="form-control" id="main-selection_time"
                value="${params.selection_time || ''}">
        </div>
        `;
    }

    // Salva i parametri
    static async saveParameters() {
        const loading = document.getElementById('parameters-loading');
        const btn = document.getElementById('save-parameters');
        try {
            btn.disabled = true;
            loading.classList.remove('d-none');

            const parameters = { fuel_sides: {}, gui_sides: {}, main_parameters: {} };

            // Lati carburante
            for (let i = 1; i <= 4; i++) {
                const p = `fuel-${i}-`;
                parameters.fuel_sides[`side_${i}`] = {
                    side_exists: safeGetChecked(`${p}enabled`),
                    pulser_pin: parseInt(safeGetValue(`${p}pulser_pin`, 0), 10),
                    nozzle_pin: parseInt(safeGetValue(`${p}nozzle_pin`, 0), 10),
                    relay_pin: parseInt(safeGetValue(`${p}relay_pin`, 0), 10),
                    pulses_per_liter: parseInt(safeGetValue(`${p}pulses_per_liter`, 0), 10),
                    price: parseFloat(safeGetValue(`${p}price`, 0)),
                    product: safeGetValue(`${p}product`, ''),
                    automatic_mode: safeGetChecked(`${p}automatic_mode`),
                    relay_activation_timer: parseInt(safeGetValue(`${p}relay_activation_timer`, 0), 10),
                    reverse_nozzle_polarity: safeGetChecked(`${p}reverse_nozzle_polarity`),
                    timeout_reached_without_dispensing: parseInt(safeGetValue(`${p}timeout_reached_without_dispensing`, 0), 10),
                    calibration_factor: parseFloat(safeGetValue(`${p}calibration_factor`, 1)),
                    simulation_pulser: safeGetChecked(`${p}simulation_pulser`)
                };
            }

            // Lati GUI
            for (let i = 1; i <= 4; i++) {
                const p = `gui-${i}-`;
                parameters.gui_sides[`side_${i}`] = {
                    side_exists: safeGetChecked(`${p}enabled`),
                    button_text: safeGetValue(`${p}button_text`, ''),
                    button_width: parseInt(safeGetValue(`${p}button_width`, 0), 10),
                    button_height: parseInt(safeGetValue(`${p}button_height`, 0), 10),
                    button_color: safeGetValue(`${p}button_color`, '#808080'),
                    button_border_color: safeGetValue(`${p}button_border_color`, '#C0C0C0'),
                    automatic_button_color: safeGetValue(`${p}automatic_button_color`, '#008000'),
                    automatic_button_border_color: safeGetValue(`${p}automatic_button_border_color`, '#556B2F'),
                    busy_button_color: safeGetValue(`${p}busy_button_color`, '#B00000'),
                    busy_button_border_color: safeGetValue(`${p}busy_button_border_color`, '#8D0000'),
                    available_button_color: safeGetValue(`${p}available_button_color`, '#FF8C00'),
                    available_button_border_color: safeGetValue(`${p}available_button_border_color`, '#DAA520'),
                    button_border_width: parseInt(safeGetValue(`${p}button_border_width`, 0), 10),
                    button_corner_radius: parseInt(safeGetValue(`${p}button_corner_radius`, 0), 10),
                    button_relx: parseFloat(safeGetValue(`${p}button_relx`, null)),
                    button_rely: parseFloat(safeGetValue(`${p}button_rely`, null)),
                    preset_label: safeGetValue(`${p}preset_label`, '')
                };
            }

            // Parametri principali
            parameters.main_parameters = {
                automatic_mode_text: safeGetValue('main-automatic_mode_text', ''),
                manual_mode_text: safeGetValue('main-manual_mode_text', ''),
                select_side_text: safeGetValue('main-select_side_text', ''),
                refused_card_text: safeGetValue('main-refused_card_text', ''),
                selection_timeout_text: safeGetValue('main-selection_timeout_text', ''),
                selection_time: parseInt(safeGetValue('main-selection_time', 0), 10)
            };

            // Invio
            const url = `${this.API_BASE}/parameters/`;
            await this.fetchWithRetry(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parameters)
            });

            this.showToast('Parametri salvati con successo');
        } catch (err) {
            this.showDetailedErrorToast(err, 'Salvataggio parametri fallito');
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    // Ripristina i parametri ai valori predefiniti
    static async resetParameters() {
        if (!confirm('Sei sicuro di voler ripristinare i parametri ai valori predefiniti?')) {
            return;
        }

        try {
            const url = `${this.API_BASE}/parameters/reset`;
            const response = await this.fetchWithRetry(url, {
                method: 'POST'
            });

            // Ricarica i parametri per mostrare i valori predefiniti
            await this.loadParameters();
            this.showToast('Parametri ripristinati ai valori predefiniti');
        } catch (err) {
            this.showDetailedErrorToast(err, 'Ripristino non riuscito');
        }
    }

    // Esporta la tabella corrente in CSV
    static exportCurrentPageTable(tableId, filename) {
        try {
            const rows = Array.from(document.querySelectorAll(`#${tableId} tr`));
            const csv = rows.map(row => {
                const cols = Array.from(row.querySelectorAll('th, td'));
                return cols.map(col => `"${col.textContent.replace(/"/g, '""')}"`).join(',');
            }).join('\n');

            this.downloadCSV(csv, filename);
            this.showToast(`Esportazione ${filename} completata con successo`);
        } catch (error) {
            console.error('Errore esportazione:', error);
            this.showToast(`Errore durante l'esportazione: ${error.message}`, 'danger');
        }
    }

    // Esporta tutte le erogazioni
    static async exportAllDispenses() {
        try {
            const url = `${this.API_BASE}/erogations/`;
            const data = await this.fetchWithRetry(url);
            this.exportDataToCSV(data.items, 'erogazioni_complete.csv');
            this.showToast('Tutte le erogazioni esportate con successo');
        } catch (err) {
            console.error('Errore esportazione erogazioni:', err);
            this.showToast(`Errore durante l'esportazione: ${err.message}`, 'danger');
        }
    }

    // Esporta tutti i veicoli
    static async exportAllVehicles() {
        try {
            const url = `${this.API_BASE}/vehicles/`;
            const data = await this.fetchWithRetry(url);
            this.exportDataToCSV(data.items, 'veicoli_completi.csv');
            this.showToast('Tutti i veicoli esportati con successo');
        } catch (err) {
            console.error('Errore esportazione veicoli:', err);
            this.showToast(`Errore durante l'esportazione: ${err.message}`, 'danger');
        }
    }

    // Esporta tutti gli autisti
    static async exportAllDrivers() {
        try {
            const url = `${this.API_BASE}/drivers/`;
            const data = await this.fetchWithRetry(url);
            this.exportDataToCSV(data.items, 'autisti_completi.csv');
            this.showToast('Tutti gli autisti esportati con successo');
        } catch (err) {
            console.error('Errore esportazione autisti:', err);
            this.showToast(`Errore durante l'esportazione: ${err.message}`, 'danger');
        }
    }

    // Funzione generica per esportare dati in CSV
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
                // Escapa le virgolette e racchiudi in virgolette
                const value = item[header] !== undefined ? item[header] : '';
                return `"${String(value).replace(/"/g, '""')}"`;
            });
            csvRows.push(values.join(','));
        });

        // Crea e scarica il file CSV
        const csvContent = csvRows.join('\n');
        this.downloadCSV(csvContent, filename);
    }

    // Scarica file CSV
    static downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }

    // Mostra notifica toast
    static showToast(message, type = 'success') {
        const toastEl = document.getElementById('toast');
        const toastBody = toastEl.querySelector('.toast-body');

        // Regola la larghezza del toast per messaggi più lunghi
        toastEl.style.maxWidth = message.length > 100 ? '400px' : '350px';

        toastEl.className = `toast align-items-center text-white bg-${type}`;
        toastBody.textContent = message;

        const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
        toast.show();

        // Regola la durata in base alla lunghezza del messaggio
        const duration = Math.min(10000, Math.max(3000, message.length * 50));
        setTimeout(() => toast.hide(), duration);
    }

    // Mostra modale
    static showModal(modalId) {
        const modal = new bootstrap.Modal(document.getElementById(modalId));
        modal.show();
        const input = document.querySelector(`#${modalId} input`);
        if (input) input.focus();
    }

    // Nascondi modale
    static hideModal(modalId) {
        const modalElement = document.getElementById(modalId);
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            } else {
                new bootstrap.Modal(modalElement).hide();
            }
        }
    }

    // Funzione debounce per performance
    static debounce(fn, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // Fetch con logica di ritentativo
    static async fetchWithRetry(url, options = {}, retries = 3) {
        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                let errorData;
                const contentType = response.headers.get('content-type');

                try {
                    errorData = contentType?.includes('application/json')
                        ? await response.json()
                        : await response.text();
                } catch (e) {
                    errorData = await response.text();
                }

                const error = new Error(`Errore HTTP! stato: ${response.status}`);
                error.response = {
                    status: response.status,
                    data: errorData
                };
                throw error;
            }

            return await response.json();
        } catch (error) {
            // Non ritentare per questi casi
            const noRetryConditions = [
                options.method === 'DELETE',
                error.message.includes('404'),
                error.message.includes('422'),
                error.message.includes('Network Error')
            ];

            if (noRetryConditions.some(cond => cond)) {
                throw error;
            }

            if (retries > 0) {
                await new Promise(res => setTimeout(res, 1000));
                return this.fetchWithRetry(url, options, retries - 1);
            }
            throw error;
        }
    }

    // Analizza errore API
    static parseAPIError(error) {
        // Gestisci i casi in cui l'errore è già una stringa
        if (typeof error === 'string') return error;

        // Gestisci risposte di errore HTTP
        if (error.response) {
            const { status, data } = error.response;

            // Gestione speciale per 422 Unprocessable Entity
            if (status === 422) {
                if (data && data.errors) {
                    // Gestisci errori di validazione in stile Laravel
                    return Object.values(data.errors)
                        .flat()
                        .join('. ');
                }
                return data.message || 'Validazione fallita. Controlla i tuoi input.';
            }

            // Mappatura altri codici di stato
            const statusMessages = {
                400: 'Richiesta non valida',
                401: 'Effettua di nuovo il login',
                403: 'Non hai i permessi per questa operazione',
                404: 'Risorsa non trovata',
                500: 'Errore del server',
                503: 'Servizio temporaneamente non disponibile'
            };

            let message = statusMessages[status] || `Errore del server (${status})`;

            if (data) {
                if (typeof data === 'string') {
                    try {
                        const jsonData = JSON.parse(data);
                        if (jsonData.message) return jsonData.message;
                        if (jsonData.error) return jsonData.error;
                    } catch (e) {
                        return data.length > 200 ? `${data.substring(0, 200)}...` : data;
                    }
                } else if (data.message) {
                    return data.message;
                } else if (data.error) {
                    return data.error;
                } else if (data.detail) {
                    return data.detail;
                }
            }
            return message;
        }

        // Gestisci errori di rete
        if (error.message && error.message.includes('Network Error')) {
            return 'Impossibile connettersi al server. Controlla la tua connessione.';
        }

        // Fallback al messaggio di errore o messaggio generico
        return error.message || 'Si è verificato un errore imprevisto';
    }

    // Mostra toast di errore dettagliato
    static showDetailedErrorToast(error, context = '') {
        let message = this.parseAPIError(error);

        // Aggiungi contesto se fornito
        if (context) {
            message = `${context}: ${message}`;
        }

        // Gestione speciale per modelli di errore comuni
        const commonErrors = {
            'violates foreign key constraint': 'Impossibile eliminare questo elemento poiché è in uso altrove',
            'duplicate key value violates unique constraint': 'Elemento già esistente',
            'network error': 'Impossibile connettersi al server',
        };

        Object.entries(commonErrors).forEach(([key, value]) => {
            if (message.toLowerCase().includes(key)) {
                message = value;
            }
        });

        this.showToast(message, 'danger');

        // Registra l'errore completo nella console per il debug
        console.error(context, error);
    }

    // Aggiorna i controlli di paginazione
    static updatePaginationControls(section) {
        const { currentPage, pageSize, totalItems } = this.pagination[section];
        const totalPages = Math.ceil(totalItems / pageSize);
        const controlsContainer = document.querySelector(`#${section} .pagination-controls`);

        controlsContainer.innerHTML = `
        <div class="btn-group">
            <button class="btn btn-sm btn-outline-primary ${currentPage <= 1 ? 'disabled' : ''}" 
                onclick="Dashboard.loadDispenses(${currentPage - 1})">
                <i class="bi bi-chevron-left"></i>
            </button>
            
            ${this.generatePageNumbers(section, currentPage, totalPages)}
            
            <button class="btn btn-sm btn-outline-primary ${currentPage >= totalPages ? 'disabled' : ''}" 
                onclick="Dashboard.loadDispenses(${currentPage + 1})">
                <i class="bi bi-chevron-right"></i>
            </button>
        </div>
        <span class="ms-2">Pagina ${currentPage} di ${totalPages}</span>
    `;
    }

    // Genera i pulsanti dei numeri di pagina con troncamento intelligente
    static generatePageNumbers(section, currentPage, totalPages) {
        let pagesHtml = '';
        const maxVisiblePages = 5; // Mostra fino a 5 numeri di pagina

        if (totalPages <= maxVisiblePages) {
            // Mostra tutte le pagine
            for (let i = 1; i <= totalPages; i++) {
                pagesHtml += this.getPageButton(section, i, currentPage);
            }
        } else {
            // Mostra pagine limitate con ellissi
            if (currentPage <= 3) {
                // Mostra prime 3 pagine, ellissi, ultima pagina
                for (let i = 1; i <= 3; i++) {
                    pagesHtml += this.getPageButton(section, i, currentPage);
                }
                pagesHtml += '<span class="btn btn-sm btn-outline-secondary disabled">...</span>';
                pagesHtml += this.getPageButton(section, totalPages, currentPage);
            } else if (currentPage >= totalPages - 2) {
                // Mostra prima pagina, ellissi, ultime 3 pagine
                pagesHtml += this.getPageButton(section, 1, currentPage);
                pagesHtml += '<span class="btn btn-sm btn-outline-secondary disabled">...</span>';
                for (let i = totalPages - 2; i <= totalPages; i++) {
                    pagesHtml += this.getPageButton(section, i, currentPage);
                }
            } else {
                // Mostra prima pagina, ellissi, current-1, current, current+1, ellissi, ultima pagina
                pagesHtml += this.getPageButton(section, 1, currentPage);
                pagesHtml += '<span class="btn btn-sm btn-outline-secondary disabled">...</span>';
                for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                    pagesHtml += this.getPageButton(section, i, currentPage);
                }
                pagesHtml += '<span class="btn btn-sm btn-outline-secondary disabled">...</span>';
                pagesHtml += this.getPageButton(section, totalPages, currentPage);
            }
        }

        return pagesHtml;
    }

    // Genera un singolo pulsante di pagina
    static getPageButton(section, page, currentPage) {
        return `
            <button class="btn btn-sm ${page === currentPage ? 'btn-primary' : 'btn-outline-primary'}" 
                onclick="Dashboard.load${section.charAt(0).toUpperCase() + section.slice(1)}(${page})">
                ${page}
            </button>
        `;
    }

    // Svuota le cache quando si cambia tab
    static clearCaches() {
        this.vehiclesCache = null;
        this.driversCache = null;
    }
}

// Inizializza la dashboard quando il DOM è caricato
document.addEventListener('DOMContentLoaded', () => Dashboard.init());