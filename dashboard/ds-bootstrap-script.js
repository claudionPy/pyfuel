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

// Set

class Dashboard {
    static API_BASE = window.API_BASE || 'http://raspberrypi.local:8000';
    static vehiclesCache = null;
    static driversCache = null;
    static debounceTimers = {};

    // Pagination configuration
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

    // Allowed search fields for each section
    static allowedSearchFields = {
        dispenses: [
            'tessera',
            'id_veicolo',
            'nome_compagnia',
            'km_totali_veicolo',
            'lato_erogazione',
            'modalita_erogazione',
            'prodotto_erogato',
            'litri_erogati',
            'timestamp_erogazione'
        ],
        vehicles: [
            'id_veicolo',
            'nome_compagnia',
            'km_totali_veicolo',
            'targa',
            'richiedi_km_veicolo'
        ],
        drivers: [
            'tessera',
            'nome_compagnia',
            'nome_autista',
            'richiedi_pin',
            'richiedi_id_veicolo'
        ]
    };

    // Initialize the dashboard
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

        flatpickr("#dispenses-start-filter, #dispenses-end-filter", {
            enableTime: true,
            time_24hr: true,
            dateFormat: "Y-m-d H:i",
        });
        // Dispenses time filter
        const dispensesTimeInput = document.getElementById('dispenses-time-filter');
        if (dispensesTimeInput) {
            const dispensesCalendarIcon = dispensesTimeInput.previousElementSibling;

            dispensesCalendarIcon.addEventListener('click', () => {
                dispensesTimeInput.showPicker();
            });

            // Set default value to current date/time
            const now = new Date();
            const timezoneOffset = now.getTimezoneOffset() * 60000;
            const localISOTime = (new Date(now - timezoneOffset)).toISOString().slice(0, 16);
            dispensesTimeInput.value = localISOTime;

            document.getElementById('apply-time-filter').addEventListener('click', () => {
                const start = document.getElementById('dispenses-start-filter').value;
                const end = document.getElementById('dispenses-end-filter').value;
                if (!start || !end) {
                    this.showToast('Seleziona sia data/ora iniziale che finale', 'warning');
                    return;
                }
                this.loadDispenses({ start_time: start, end_time: end });
            });

            // Listener “Annulla”
            document.getElementById('clear-time-filter').addEventListener('click', () => {
                document.getElementById('dispenses-start-filter').value = '';
                document.getElementById('dispenses-end-filter').value = '';
                this.loadDispenses();
            });
        }
    }
    // Set up tab navigation
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

    // Set up event listeners
    static setupEventListeners() {
        // Vehicle form
        const formVehicle = document.getElementById('form-vehicle');
        if (formVehicle) {
            formVehicle.addEventListener('submit', event => {
                event.preventDefault();
                this.handleVehicleSubmit(event);
            });
        }

        // Driver form
        const formDriver = document.getElementById('form-driver');
        if (formDriver) {
            formDriver.addEventListener('submit', event => {
                event.preventDefault();
                this.handleDriverSubmit(event);
            });
        }

        // Dispenses
        document.getElementById('load-dispenses').addEventListener('click',
            this.debounce(() => this.loadDispenses(), 300));
        // Dispenses search button
        document.getElementById('search-dispenses').addEventListener('click', () => {
            this.searchDispenses();
        });

        // Dispenses search input (Enter key)
        document.getElementById('dispenses-search').addEventListener('keypress', e => {
            if (e.key === 'Enter') {
                this.searchDispenses();
            }
        });

        document.getElementById('apply-time-filter').addEventListener('click', () => {
            const start = document.getElementById('dispenses-start-filter').value;
            const end = document.getElementById('dispenses-end-filter').value;
            if (!start || !end) {
                this.showToast('Please select both start and end time', 'warning');
                return;
            }
            this.searchDispenses(); // This will handle the time filter search
        });

        document.getElementById('clear-time-filter').addEventListener('click', () => {
            document.getElementById('dispenses-start-filter').value = '';
            document.getElementById('dispenses-end-filter').value = '';
            document.getElementById('dispenses-search').value = '';
            this.loadDispenses(); // Load without any filters
        });

        // Vehicles
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

        // Drivers
        document.getElementById('load-drivers').addEventListener('click',
            this.debounce(() => this.loadDrivers(), 300));
        document.getElementById('search-drivers').addEventListener('click',
            this.debounce(() => this.searchDrivers(), 300));
        document.getElementById('drivers-search').addEventListener('keypress',
            e => e.key === 'Enter' && this.searchDrivers());
        document.getElementById('add-driver').addEventListener('click', () => {
            const form = document.getElementById('form-driver');
            form.reset();
            delete form.dataset.originalTessera;
            this.showModal('modal-driver');
        });

        // Export and delete buttons
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

        // Parameters
        document.getElementById('load-parameters').addEventListener('click',
            this.debounce(() => this.loadParameters(), 300));
        document.getElementById('save-parameters').addEventListener('click',
            this.debounce(() => this.saveParameters(), 300));
        document.getElementById('reset-parameters').addEventListener('click',
            () => this.resetParameters());
    }

    // Set up form handlers
    static setupFormHandlers() {
        // Driver PIN requirement toggle
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

    // Set up input validation
    static setupInputValidation() {
        const kmInput = document.getElementById('km_totali_veicolo');
        if (kmInput) {
            kmInput.addEventListener('blur', function () {
                const value = this.value.trim();
                if (value && !/^\d*\.?\d+$/.test(value)) {
                    this.classList.add('is-invalid');
                    Dashboard.showToast('Kilometers must be a numeric value', 'warning');
                } else {
                    this.classList.remove('is-invalid');
                }
            });
        }
    }

    // Set up page size controls
    static setupPageSizeControls() {
        // Dispenses page size
        document.getElementById('dispenses-page-size')?.addEventListener('change', (e) => {
            this.pagination.dispenses.pageSize = parseInt(e.target.value);
            this.pagination.dispenses.currentPage = 1;
            this.loadDispenses();
        });

        // Vehicles page size
        document.getElementById('vehicles-page-size')?.addEventListener('change', (e) => {
            this.pagination.vehicles.pageSize = parseInt(e.target.value);
            this.pagination.vehicles.currentPage = 1;
            this.loadVehicles();
        });

        // Drivers page size
        document.getElementById('drivers-page-size')?.addEventListener('change', (e) => {
            this.pagination.drivers.pageSize = parseInt(e.target.value);
            this.pagination.drivers.currentPage = 1;
            this.loadDrivers();
        });
    }

    // Set up search field helpers
    static setupSearchFieldHelpers() {
        // Helper function to create dropdown items
        const createDropdownItems = (section, dropdownId) => {
            const dropdown = document.querySelector(`#${dropdownId} + ul.search-fields-dropdown`);
            if (!dropdown) return;

            dropdown.innerHTML = '';

            // Add header
            const header = document.createElement('li');
            header.className = 'dropdown-header';
            header.textContent = 'Available search fields:';
            dropdown.appendChild(header);

            // Add each field as clickable item
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

        // Setup for each section
        createDropdownItems('dispenses', 'dispensesFieldsDropdown');
        createDropdownItems('vehicles', 'vehiclesFieldsDropdown');
        createDropdownItems('drivers', 'driversFieldsDropdown');
    }

    // Load dispenses with pagination
    static async loadDispenses(page = null) {
        if (page !== null) {
            this.pagination.dispenses.currentPage = page;
        }

        const { currentPage, pageSize } = this.pagination.dispenses;
        const loading = document.getElementById('dispenses-loading');
        const btn = document.getElementById('load-dispenses');

        try {
            btn.disabled = true;
            loading.classList.remove('d-none');

            const url = `${this.API_BASE}/erogazioni/?page=${currentPage}&limit=${pageSize}`;
            const data = await this.fetchWithRetry(url);

            this.pagination.dispenses.totalItems = data.total || data.items.length;
            const itemsToRender = data.items.reverse();
            this.renderDispenses(itemsToRender);
            this.updatePaginationControls('dispenses');

            this.showToast(`Dispenses loaded (page ${currentPage})`);
        } catch (err) {
            this.showDetailedErrorToast(err, 'Failed to load dispenses');
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    // Load vehicles with pagination
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

            const url = `${this.API_BASE}/veicoli/?page=${currentPage}&limit=${pageSize}`;
            const data = await this.fetchWithRetry(url);

            this.pagination.vehicles.totalItems = data.total || data.items.length;
            this.vehiclesCache = data.items;

            const itemsToRender = data.items.reverse();
            this.renderVehicles(itemsToRender);
            this.updatePaginationControls('vehicles');

            this.showToast(`Vehicles loaded (page ${currentPage})`);
        } catch (err) {
            this.showDetailedErrorToast(err, 'Failed to load vehicles');
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    // Load drivers with pagination
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

            const url = `${this.API_BASE}/autisti/?page=${currentPage}&limit=${pageSize}`;
            const data = await this.fetchWithRetry(url);

            this.pagination.drivers.totalItems = data.total || data.items.length;
            this.driversCache = data.items;

            const itemsToRender = data.items.reverse();
            this.renderDrivers(itemsToRender);
            this.updatePaginationControls('drivers');

            this.showToast(`Drivers loaded (page ${currentPage})`);
        } catch (err) {
            this.showDetailedErrorToast(err, 'Failed to load drivers');
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    static async searchDispenses() {
        const input = document.getElementById('dispenses-search');
        const query = input.value.trim();
        const startTime = document.getElementById('dispenses-start-filter').value;
        const endTime = document.getElementById('dispenses-end-filter').value;

        // Reset to first page when searching
        this.pagination.dispenses.currentPage = 1;

        // If no search criteria at all
        if (!query && !startTime && !endTime) {
            this.showToast('Please enter a search term or set time filters', 'warning');
            return this.loadDispenses();
        }

        try {
            const btn = document.getElementById('search-dispenses');
            const loading = document.getElementById('dispenses-loading');

            btn.disabled = true;
            loading.classList.remove('d-none');

            let searchParams = {};

            // Parse search query if exists
            if (query) {
                try {
                    searchParams = this.parseSearchQuery(query);
                    this.validateSearchParams('dispenses', searchParams);
                } catch (err) {
                    this.showToast(err.message, 'warning');
                    return;
                }
            }

            // Add time filters if they exist
            if (startTime) searchParams.start_time = startTime;
            if (endTime) searchParams.end_time = endTime;

            const { currentPage, pageSize } = this.pagination.dispenses;
            const url = this.buildSearchUrl('/erogazioni/search/', {
                ...searchParams,
                page: currentPage,
                limit: pageSize
            });

            const data = await this.fetchWithRetry(url);
            this.pagination.dispenses.totalItems = data.total || data.items.length;
            this.renderDispenses(data.items.reverse());
            this.updatePaginationControls('dispenses');

            if (data.items.length === 0) {
                this.showToast('No matching dispenses found. Try different search terms.', 'info');
            } else {
                const itemCount = data.items.length;
                const totalCount = this.pagination.dispenses.totalItems;
                const message = totalCount > itemCount
                    ? `Showing ${itemCount} of ${totalCount} matching dispenses`
                    : `Found ${itemCount} matching dispenses`;
                this.showToast(message);
            }
        } catch (err) {
            this.showDetailedErrorToast(err, 'Search failed');
            document.querySelector('#dispense-table tbody').innerHTML = '';
            this.pagination.dispenses.totalItems = 0;
            this.updatePaginationControls('dispenses');
        } finally {
            const btn = document.getElementById('search-dispenses');
            const loading = document.getElementById('dispenses-loading');
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    // Search vehicles with pagination
    static async searchVehicles() {
        const input = document.getElementById('vehicles-search');
        const query = input.value.trim();
        const loading = document.getElementById('vehicles-loading');
        const btn = document.getElementById('load-vehicles');

        // Reset to first page when searching
        this.pagination.vehicles.currentPage = 1;

        if (!query) {
            this.showToast('Please enter a search term', 'warning');
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
            const url = this.buildSearchUrl('/veicoli/search/', {
                ...searchParams,
                page: currentPage,
                limit: pageSize
            });

            const data = await this.fetchWithRetry(url);
            this.pagination.vehicles.totalItems = data.total || data.items.length;
            this.vehiclesCache = data.items;
            this.renderVehicles(data.items.reverse());
            this.updatePaginationControls('vehicles');

            if (data.items.length === 0) {
                this.showToast('No matching vehicles found. Try different search terms.', 'info');
            } else {
                const itemCount = data.items.length;
                const totalCount = this.pagination.vehicles.totalItems;
                const message = totalCount > itemCount
                    ? `Showing ${itemCount} of ${totalCount} matching vehicles`
                    : `Found ${itemCount} matching vehicles`;
                this.showToast(message);
            }
        } catch (err) {
            this.showDetailedErrorToast(err, 'Search failed');
            document.querySelector('#vehicles-table tbody').innerHTML = '';
            this.pagination.vehicles.totalItems = 0;
            this.updatePaginationControls('vehicles');
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    // Search drivers with pagination
    static async searchDrivers() {
        const input = document.getElementById('drivers-search');
        const query = input.value.trim();
        const loading = document.getElementById('drivers-loading');
        const btn = document.getElementById('load-drivers');

        // Reset to first page when searching
        this.pagination.drivers.currentPage = 1;

        if (!query) {
            this.showToast('Please enter a search term', 'warning');
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
            const url = this.buildSearchUrl('/autisti/search/', {
                ...searchParams,
                page: currentPage,
                limit: pageSize
            });

            const data = await this.fetchWithRetry(url);
            this.pagination.drivers.totalItems = data.total || data.items.length;
            this.driversCache = data.items;
            this.renderDrivers(data.items.reverse());
            this.updatePaginationControls('drivers');

            if (data.items.length === 0) {
                this.showToast('No matching drivers found. Try different search terms.', 'info');
            } else {
                const itemCount = data.items.length;
                const totalCount = this.pagination.drivers.totalItems;
                const message = totalCount > itemCount
                    ? `Showing ${itemCount} of ${totalCount} matching drivers`
                    : `Found ${itemCount} matching drivers`;
                this.showToast(message);
            }
        } catch (err) {
            this.showDetailedErrorToast(err, 'Search failed');
            document.querySelector('#drivers-table tbody').innerHTML = '';
            this.pagination.drivers.totalItems = 0;
            this.updatePaginationControls('drivers');
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    // Parse search query
    static parseSearchQuery(query) {
        // Handle timestamp search
        const timestampMatch = query.match(/timestamp_erogazione:\s*(.+)/);
        if (timestampMatch) {
            return { timestamp_erogazione: timestampMatch[1].trim() };
        }

        // Existing field:value parsing
        const m = query.match(/^([a-zA-Z0-9_]+)\s*:\s*(.+)$/);
        if (m) {
            const field = m[1].trim();
            let value = m[2].trim().replace(/^['"](.+)['"]$/, '$1');
            return { [field]: value };
        }
        return { q: query };
    }

    // Validate search parameters
    static validateSearchParams(section, params) {
        const allowed = this.allowedSearchFields[section];
        const invalid = Object.keys(params).filter(k => !allowed.includes(k));
        if (invalid.length) {
            throw new Error(`Invalid field${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}. Available fields: ${allowed.join(', ')}`);
        }
    }

    // Build search URL
    static buildSearchUrl(basePath, searchParams) {
        const url = new URL(`${this.API_BASE}${basePath}`);
        Object.entries(searchParams).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.append(key, value);
            }
        });
        return url.toString();
    }

    // Render dispenses table
    static renderDispenses(data) {
        const tbody = document.querySelector('#dispense-table tbody');
        const fragment = document.createDocumentFragment();

        data.forEach(item => {
            const tr = document.createElement('tr');
            // Format timestamp consistently
            const ts = item.timestamp_erogazione
                ? new Date(item.timestamp_erogazione).toLocaleString('it-IT', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                })
                : '-';

            tr.innerHTML = `
                <td>${item.tessera || '-'}</td>
                <td>${item.id_veicolo || '-'}</td>
                <td>${item.nome_compagnia || '-'}</td>
                <td>${item.km_totali_veicolo || '0'}</td>
                <td>${item.lato_erogazione || '-'}</td>
                <td>${item.modalita_erogazione || '-'}</td>
                <td>${item.prodotto_erogato || '-'}</td>
                <td>${item.litri_erogati || '0'}</td>
                <td>${ts}</td>
            `;
            fragment.appendChild(tr);
        });

        tbody.innerHTML = '';
        tbody.appendChild(fragment);
    }

    // Render vehicles table
    static renderVehicles(data) {
        const tbody = document.querySelector('#vehicles-table tbody');
        const fragment = document.createDocumentFragment();

        data.forEach(v => {
            const tr = document.createElement('tr');
            // Treat ID as string
            const vehicleId = v.id_veicolo !== undefined && v.id_veicolo !== null ? String(v.id_veicolo) : '-';
            tr.innerHTML = `
                <td>${vehicleId}</td>
                <td>${v.nome_compagnia || '-'}</td>
                <td>${v.km_totali_veicolo || '0'}</td>
                <td>${v.targa || '-'}</td>
                <td>${v.richiedi_km_veicolo ? 'Yes' : 'No'}</td>
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

    // Render drivers table
    static renderDrivers(data) {
        const tbody = document.querySelector('#drivers-table tbody');
        const fragment = document.createDocumentFragment();

        data.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.tessera || '-'}</td>
                <td>${u.nome_compagnia || '-'}</td>
                <td>${u.nome_autista || '-'}</td>
                <td>${u.pin || '-'}</td>
                <td>${u.richiedi_pin ? 'Yes' : 'No'}</td>
                <td>${u.richiedi_id_veicolo ? 'Yes' : 'No'}</td>
                <td>
                    <button class="btn btn-sm btn-primary me-1"
                            onclick="Dashboard.editDriver('${u.tessera}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-danger"
                            onclick="Dashboard.deleteDriver('${u.tessera}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            fragment.appendChild(tr);
        });

        tbody.innerHTML = '';
        tbody.appendChild(fragment);
    }

    // Handle vehicle form submission
    static async handleVehicleSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const kmInput = form.km_totali_veicolo;

        // Validate kilometers input
        if (kmInput.value.trim() && !/^\d*\.?\d+$/.test(kmInput.value.trim())) {
            kmInput.classList.add('is-invalid');
            this.showToast('Kilometers must be a numeric value', 'warning');
            return;
        }

        try {
            const payload = {
                id_veicolo: form.id_veicolo.value, // Send as string
                nome_compagnia: form.nome_compagnia.value,
                km_totali_veicolo: String(form.km_totali_veicolo.value || '0'),
                targa: form.targa.value,
                richiedi_km_veicolo: form.richiedi_km_veicolo.checked
            };

            const method = form.dataset.originalId ? 'PUT' : 'POST';
            const url = form.dataset.originalId
                ? `${this.API_BASE}/veicoli/${encodeURIComponent(form.dataset.originalId)}`
                : `${this.API_BASE}/veicoli/`;

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

            this.showToast(`Vehicle ${method === 'POST' ? 'created' : 'updated'} successfully`);
        } catch (err) {
            this.showDetailedErrorToast(err, 'Vehicle operation failed');
        }
    }

    // Handle driver form submission
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
                tessera: form.tessera.value,
                nome_compagnia: form.nome_compagnia.value,
                nome_autista: form.nome_autista.value,
                richiedi_pin: form.richiedi_pin.checked,
                richiedi_id_veicolo: form.richiedi_id_veicolo.checked,
                pin: form.pin.value
            };

            const method = form.dataset.originalTessera ? 'PUT' : 'POST';
            const url = form.dataset.originalTessera
                ? `${this.API_BASE}/autisti/${encodeURIComponent(form.dataset.originalTessera)}`
                : `${this.API_BASE}/autisti/`;

            await this.fetchWithRetry(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            this.hideModal('modal-driver');
            form.reset();
            delete form.dataset.originalTessera;

            this.driversCache = null;
            await this.loadDrivers();

            this.showToast(`Driver ${method === 'POST' ? 'created' : 'updated'} successfully`);
        } catch (err) {
            this.showDetailedErrorToast(err, 'Driver operation failed');
        }
    }

    // Edit vehicle
    static async editVehicle(vehicleId) {
        try {
            if (!this.vehiclesCache) {
                await this.loadVehicles();
            }

            // Handle both string and numeric IDs
            const vehicle = this.vehiclesCache.find(v =>
                String(v.id_veicolo) === String(vehicleId)
            );

            if (!vehicle) {
                throw new Error('Vehicle not found');
            }

            const form = document.getElementById('form-vehicle');
            // Display the ID as string
            form.id_veicolo.value = String(vehicle.id_veicolo);
            form.nome_compagnia.value = vehicle.nome_compagnia || '';
            form.km_totali_veicolo.value = vehicle.km_totali_veicolo || '0';
            form.targa.value = vehicle.targa || '';
            form.richiedi_km_veicolo.checked = vehicle.richiedi_km_veicolo || false;

            // Store original ID as string
            form.dataset.originalId = String(vehicle.id_veicolo);
            this.showModal('modal-vehicle');
            this.showToast('Edit vehicle fields and save changes');
        } catch (err) {
            console.error('Edit vehicle error:', err);
            this.showToast(`Error editing vehicle: ${err.message}`, 'danger');
        }
    }

    // Edit driver
    static async editDriver(tessera) {
        try {
            if (!this.driversCache) {
                await this.loadDrivers();
            }

            const driver = this.driversCache.find(d => d.tessera === tessera);
            if (!driver) {
                throw new Error('Driver not found');
            }

            const form = document.getElementById('form-driver');
            form.tessera.value = driver.tessera;
            form.nome_compagnia.value = driver.nome_compagnia || '';
            form.nome_autista.value = driver.nome_autista || '';
            form.richiedi_pin.checked = driver.richiedi_pin || false;
            form.richiedi_id_veicolo.checked = driver.richiedi_id_veicolo || false;
            form.pin.value = driver.pin || '';

            form.dataset.originalTessera = driver.tessera;
            this.showModal('modal-driver');
            this.showToast('Edit driver fields and save changes');
        } catch (err) {
            console.error('Edit driver error:', err);
            this.showToast(`Error editing driver: ${err.message}`, 'danger');
        }
    }

    // Delete vehicle
    static async deleteVehicle(vehicleId) {
        if (!confirm(`Are you sure you want to delete vehicle with ID ${vehicleId}?`)) return;

        try {
            const res = await fetch(`${this.API_BASE}/veicoli/${encodeURIComponent(vehicleId)}`, {
                method: 'DELETE'
            });

            if (res.status === 204 || res.ok) {
                this.vehiclesCache = null;
                await this.loadVehicles();
                this.showToast('Vehicle deleted successfully');
            } else {
                let errorMessage;
                try {
                    const errorData = await res.json();
                    errorMessage = errorData.message || errorData.error || 'Deletion failed';
                } catch (e) {
                    errorMessage = await res.text();
                }
                throw new Error(errorMessage);
            }
        } catch (err) {
            this.showDetailedErrorToast(err, 'Failed to delete vehicle');
        }
    }

    // Delete driver
    static async deleteDriver(tessera) {
        if (!confirm(`Are you sure you want to delete driver with card ${tessera}?`)) return;

        try {
            const res = await fetch(`${this.API_BASE}/autisti/${encodeURIComponent(tessera)}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.status === 204 || res.ok) {
                this.driversCache = null;
                await this.loadDrivers();
                this.showToast('Driver deleted successfully');
            } else {
                let errorMessage;
                try {
                    const errorData = await res.json();
                    errorMessage = errorData.message || errorData.error || 'Deletion failed';
                } catch (e) {
                    errorMessage = await res.text();
                }
                throw new Error(errorMessage);
            }
        } catch (err) {
            this.showDetailedErrorToast(err, 'Failed to delete driver');
        }
    }

    // Delete all dispenses
    static async deleteAllDispenses() {
        if (!confirm('Are you sure you want to delete ALL dispenses? This action cannot be undone.')) {
            return;
        }
        try {
            const res = await fetch(`${this.API_BASE}/erogazioni/`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.status === 204 || res.ok) {
                document.querySelector('#dispense-table tbody').innerHTML = '';
                this.pagination.dispenses.totalItems = 0;
                this.updatePaginationControls('dispenses');
                this.showToast('All dispenses have been deleted');
            } else {
                const text = await res.text();
                throw new Error(text || 'Error deleting all dispenses');
            }
        } catch (err) {
            console.error('Delete all dispenses error:', err);
            this.showToast(`Error: ${err.message}`, 'danger');
        }
    }

    static async loadParameters() {
        const loading = document.getElementById('parameters-loading');
        const btn = document.getElementById('load-parameters');

        try {
            btn.disabled = true;
            loading.classList.remove('d-none');

            const url = `${this.API_BASE}/parameters/`;
            const data = await this.fetchWithRetry(url);

            // Render all parameter sections
            this.renderFuelParameters(data.fuel_sides);
            this.renderGuiParameters(data.gui_sides);
            this.renderMainParameters(data.main_parameters);

            this.showToast('Parameters loaded successfully');
        } catch (err) {
            this.showDetailedErrorToast(err, 'Failed to load parameters');
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    static async toggleSideParameters(checkbox) {
        const side = checkbox.dataset.side;
        const type = checkbox.dataset.type;
        const isActive = checkbox.checked;

        // Update the header color immediately
        const containerId = `${type}-side-${side}-params`;
        const container = document.getElementById(containerId);
        if (container) {
            const header = container.closest('.card')?.querySelector('.card-header');
            if (header) {
                header.className = `card-header ${isActive ? 'bg-primary' : 'bg-secondary'} text-white`;
            }
        }

        // If enabling, we need to load the parameters
        if (isActive) {
            try {
                // Get current parameters to show existing values
                const url = `${this.API_BASE}/parameters/`;
                const data = await this.fetchWithRetry(url);

                const sideKey = `side_${side}`;
                let sideParams = {};

                if (type === 'fuel') {
                    sideParams = data.fuel_sides[sideKey] || {
                        pulserPin: 0,
                        nozzleSwitchPin: 0,
                        relaySwitchPin: 0,
                        pulsesPerLiter: 0,
                        price: 0,
                        product: '',
                        isAutomatic: false,
                        relayActivationDelay: 0,
                        nozzleSwitch_invert_polarity: false,
                        max_time_without_fueling: 0,
                        calibration_factor: 1.0,
                        simulation_pulser: false
                    };
                    container.innerHTML = `
                    <div class="mb-3 form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="fuel-${side}-enabled"
                            checked data-side="${side}" data-type="fuel"
                            onchange="Dashboard.toggleSideParameters(this)">
                        <label class="form-check-label" for="fuel-${side}-enabled">Side Enabled</label>
                    </div>
                    ${this.getFuelSideParametersHtml(side, sideParams)}
                `;
                } else {
                    sideParams = data.gui_sides[sideKey] || {
                        buttonText: '',
                        buttonWidth: 0,
                        buttonHeight: 0,
                        buttonColor: '#808080',
                        buttonBorderColor: '#C0C0C0',
                        aut_buttonColor: '#008000',
                        aut_buttonBorderColor: '#556B2F',
                        inuse_buttonColor: '#B00000',
                        inuse_buttonBorderColor: '#8D0000',
                        available_buttonColor: '#FF8C00',
                        available_buttonBorderColor: '#DAA520',
                        buttonBorderWidth: 0,
                        buttonCornerRadius: 0,
                        button_relx: 0,
                        button_rely: 0,
                        labelText: ''
                    };
                    container.innerHTML = `
                    <div class="mb-3 form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="gui-${side}-enabled"
                            checked data-side="${side}" data-type="gui"
                            onchange="Dashboard.toggleSideParameters(this)">
                        <label class="form-check-label" for="gui-${side}-enabled">Side Enabled</label>
                    </div>
                    ${this.getGuiSideParametersHtml(side, sideParams)}
                `;
                }
            } catch (err) {
                console.error('Error loading side parameters:', err);
                checkbox.checked = false;
                this.showToast('Failed to load side parameters', 'danger');
            }
        } else {
            // If disabling, just show the enable checkbox
            document.getElementById(containerId).innerHTML = `
            <div class="mb-3 form-check form-switch">
                <input class="form-check-input" type="checkbox" id="${type}-${side}-enabled"
                    ${isActive ? 'checked' : ''} data-side="${side}" data-type="${type}"
                    onchange="Dashboard.toggleSideParameters(this)">
                <label class="form-check-label" for="${type}-${side}-enabled">Side Enabled</label>
            </div>
        `;
        }
    }
    static renderFuelParameters(sides) {
        for (let i = 1; i <= 4; i++) {
            const sideKey = `side_${i}`;
            const container = document.getElementById(`fuel-side-${i}-params`);
            if (!container) continue;

            const side = sides[sideKey] || {};
            const isActive = side.sideExists || false;

            // Dynamic header class based on active state
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
                <label class="form-check-label" for="fuel-${i}-enabled">Side Enabled</label>
            </div>
        `;

            if (isActive) {
                // Initialize with default values if they don't exist
                const sideParams = {
                    pulserPin: side.pulserPin || 0,
                    nozzleSwitchPin: side.nozzleSwitchPin || 0,
                    relaySwitchPin: side.relaySwitchPin || 0,
                    pulsesPerLiter: side.pulsesPerLiter || 0,
                    price: side.price || 0,
                    product: side.product || '',
                    isAutomatic: side.isAutomatic || false,
                    relayActivationDelay: side.relayActivationDelay || 0,
                    nozzleSwitch_invert_polarity: side.nozzleSwitch_invert_polarity || false,
                    max_time_without_fueling: side.max_time_without_fueling || 0,
                    calibration_factor: side.calibration_factor || 1.0,
                    simulation_pulser: side.simulation_pulser || false
                };

                html += this.getFuelSideParametersHtml(i, sideParams);
            }

            container.innerHTML = html;
        }
    }

    static getFuelSideParametersHtml(side, params) {
        return `
        <div class="mb-3">
            <label for="fuel-${side}-pulserPin" class="form-label">Pulser Pin</label>
            <input type="number" class="form-control" id="fuel-${side}-pulserPin"
                value="${params.pulserPin}">
        </div>
        <div class="mb-3">
            <label for="fuel-${side}-nozzleSwitchPin" class="form-label">Nozzle Switch Pin</label>
            <input type="number" class="form-control" id="fuel-${side}-nozzleSwitchPin"
                value="${params.nozzleSwitchPin}">
        </div>
        <div class="mb-3">
            <label for="fuel-${side}-relaySwitchPin" class="form-label">Relay Switch Pin</label>
            <input type="number" class="form-control" id="fuel-${side}-relaySwitchPin"
                value="${params.relaySwitchPin}">
        </div>
        <div class="mb-3">
            <label for="fuel-${side}-pulsesPerLiter" class="form-label">Pulses Per Liter</label>
            <input type="number" class="form-control" id="fuel-${side}-pulsesPerLiter"
                value="${params.pulsesPerLiter}">
        </div>
        <div class="mb-3">
            <label for="fuel-${side}-price" class="form-label">Price</label>
            <input type="number" step="0.01" class="form-control" id="fuel-${side}-price"
                value="${params.price}">
        </div>
        <div class="mb-3">
            <label for="fuel-${side}-product" class="form-label">Product</label>
            <input type="text" class="form-control" id="fuel-${side}-product"
                value="${params.product}">
        </div>
        <div class="mb-3 form-check">
            <input class="form-check-input" type="checkbox" id="fuel-${side}-isAutomatic"
                ${params.isAutomatic ? 'checked' : ''}>
            <label class="form-check-label" for="fuel-${side}-isAutomatic">Automatic</label>
        </div>
        <div class="mb-3">
            <label for="fuel-${side}-relayActivationDelay" class="form-label">Relay Activation Delay (s)</label>
            <input type="number" class="form-control" id="fuel-${side}-relayActivationDelay"
                value="${params.relayActivationDelay}">
        </div>
        <div class="mb-3 form-check">
            <input class="form-check-input" type="checkbox" id="fuel-${side}-nozzleSwitch_invert_polarity"
                ${params.nozzleSwitch_invert_polarity ? 'checked' : ''}>
            <label class="form-check-label" for="fuel-${side}-nozzleSwitch_invert_polarity">
                Invert Nozzle Switch Polarity
            </label>
        </div>
        <div class="mb-3">
            <label for="fuel-${side}-max_time_without_fueling" class="form-label">Max Time Without Fueling (s)</label>
            <input type="number" class="form-control" id="fuel-${side}-max_time_without_fueling"
                value="${params.max_time_without_fueling}">
        </div>
        <div class="mb-3">
            <label for="fuel-${side}-calibration_factor" class="form-label">Calibration Factor</label>
            <input type="number" step="0.01" class="form-control" id="fuel-${side}-calibration_factor"
                value="${params.calibration_factor}">
        </div>
        <div class="mb-3 form-check">
            <input class="form-check-input" type="checkbox" id="fuel-${side}-simulation_pulser"
                ${params.simulation_pulser ? 'checked' : ''}>
            <label class="form-check-label" for="fuel-${side}-simulation_pulser">
                Simulation Pulser
            </label>
        </div>
    `;
    }
    static renderGuiParameters(sides) {
        for (let i = 1; i <= 4; i++) {
            const sideKey = `side_${i}`;
            const container = document.getElementById(`gui-side-${i}-params`);
            if (!container) continue;

            const side = sides[sideKey] || {};
            const isActive = side.sideExists || false;

            // Dynamic header class based on active state
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
                <label class="form-check-label" for="gui-${i}-enabled">Side Enabled</label>
            </div>
        `;

            if (isActive) {
                // Initialize with default values if they don't exist
                const sideParams = {
                    buttonText: side.buttonText || '',
                    buttonWidth: side.buttonWidth || 0,
                    buttonHeight: side.buttonHeight || 0,
                    buttonColor: side.buttonColor || '#808080',
                    buttonBorderColor: side.buttonBorderColor || '#C0C0C0',
                    aut_buttonColor: side.aut_buttonColor || '#008000',
                    aut_buttonBorderColor: side.aut_buttonBorderColor || '#556B2F',
                    inuse_buttonColor: side.inuse_buttonColor || '#B00000',
                    inuse_buttonBorderColor: side.inuse_buttonBorderColor || '#8D0000',
                    available_buttonColor: side.available_buttonColor || '#FF8C00',
                    available_buttonBorderColor: side.available_buttonBorderColor || '#DAA520',
                    buttonBorderWidth: side.buttonBorderWidth || 0,
                    buttonCornerRadius: side.buttonCornerRadius || 0,
                    button_relx: side.button_relx || 0,
                    button_rely: side.button_rely || 0,
                    labelText: side.labelText || ''
                };

                html += this.getGuiSideParametersHtml(i, sideParams);
            }

            container.innerHTML = html;
        }
    }

    static getGuiSideParametersHtml(side, params) {
        return `
        <div class="mb-3">
            <label for="gui-${side}-buttonText" class="form-label">Button Text</label>
            <input type="text" class="form-control" id="gui-${side}-buttonText"
                value="${params.buttonText}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-buttonWidth" class="form-label">Button Width</label>
            <input type="number" class="form-control" id="gui-${side}-buttonWidth"
                value="${params.buttonWidth}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-buttonHeight" class="form-label">Button Height</label>
            <input type="number" class="form-control" id="gui-${side}-buttonHeight"
                value="${params.buttonHeight}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-buttonColor" class="form-label">Button Color</label>
            <input type="color" class="form-control form-control-color" id="gui-${side}-buttonColor"
                value="${params.buttonColor}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-buttonBorderColor" class="form-label">Button Border Color</label>
            <input type="color" class="form-control form-control-color" id="gui-${side}-buttonBorderColor"
                value="${params.buttonBorderColor}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-aut_buttonColor" class="form-label">Automatic Button Color</label>
            <input type="color" class="form-control form-control-color" id="gui-${side}-aut_buttonColor"
                value="${params.aut_buttonColor}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-aut_buttonBorderColor" class="form-label">Automatic Border Color</label>
            <input type="color" class="form-control form-control-color" id="gui-${side}-aut_buttonBorderColor"
                value="${params.aut_buttonBorderColor}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-inuse_buttonColor" class="form-label">In-use Button Color</label>
            <input type="color" class="form-control form-control-color" id="gui-${side}-inuse_buttonColor"
                value="${params.inuse_buttonColor}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-inuse_buttonBorderColor" class="form-label">In-use Border Color</label>
            <input type="color" class="form-control form-control-color" id="gui-${side}-inuse_buttonBorderColor"
                value="${params.inuse_buttonBorderColor}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-available_buttonColor" class="form-label">Available Button Color</label>
            <input type="color" class="form-control form-control-color" id="gui-${side}-available_buttonColor"
                value="${params.available_buttonColor}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-available_buttonBorderColor" class="form-label">Available Border Color</label>
            <input type="color" class="form-control form-control-color" id="gui-${side}-available_buttonBorderColor"
                value="${params.available_buttonBorderColor}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-labelText" class="form-label">Label Text</label>
            <input type="text" class="form-control" id="gui-${side}-labelText"
                value="${params.labelText}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-buttonBorderWidth" class="form-label">Border Width</label>
            <input type="number" class="form-control" id="gui-${side}-buttonBorderWidth"
                value="${params.buttonBorderWidth}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-buttonCornerRadius" class="form-label">Corner Radius</label>
            <input type="number" class="form-control" id="gui-${side}-buttonCornerRadius"
                value="${params.buttonCornerRadius}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-button_relx" class="form-label">Relative X (%)</label>
            <input type="number" step="0.01" class="form-control" id="gui-${side}-button_relx"
                value="${params.button_relx}">
        </div>
        <div class="mb-3">
            <label for="gui-${side}-button_rely" class="form-label">Relative Y (%)</label>
            <input type="number" step="0.01" class="form-control" id="gui-${side}-button_rely"
                value="${params.button_rely}">
        </div>
    `;
    }
    static renderMainParameters(params) {
        const container = document.getElementById('main-params');
        if (!container) return;

        container.innerHTML = `
    <div class="mb-3">
        <label for="main-aut_MainLabel" class="form-label">Automatic Mode Label</label>
        <input type="text" class="form-control" id="main-aut_MainLabel"
            value="${params.aut_MainLabel || ''}">
    </div>
    <div class="mb-3">
        <label for="main-man_MainLabel" class="form-label">Manual Mode Label</label>
        <input type="text" class="form-control" id="main-man_MainLabel"
            value="${params.man_MainLabel || ''}">
    </div>

    <!-- Parametri aggiunti -->
    <div class="mb-3">
        <label for="main-sel_MainLabel" class="form-label">Select Side Label</label>
        <input type="text" class="form-control" id="main-sel_MainLabel"
            value="${params.sel_MainLabel || ''}">
    </div>
    <div class="mb-3">
        <label for="main-ref_MainLabel" class="form-label">Card Denied Label</label>
        <input type="text" class="form-control" id="main-ref_MainLabel"
            value="${params.ref_MainLabel || ''}">
    </div>

    <div class="mb-3">
        <label for="main-exp_MainLabel" class="form-label">Timeout Label</label>
        <input type="text" class="form-control" id="main-exp_MainLabel"
            value="${params.exp_MainLabel || ''}">
    </div>
    <div class="mb-3">
        <label for="main-max_selection_time" class="form-label">Max Selection Time (s)</label>
        <input type="number" class="form-control" id="main-max_selection_time"
            value="${params.max_selection_time || ''}">
    </div>
    `;
    }


    static async saveParameters() {
        const loading = document.getElementById('parameters-loading');
        const btn = document.getElementById('save-parameters');
        try {
            btn.disabled = true;
            loading.classList.remove('d-none');

            const parameters = { fuel_sides: {}, gui_sides: {}, main_parameters: {} };

            // Fuel sides
            for (let i = 1; i <= 4; i++) {
                const p = `fuel-${i}-`;
                parameters.fuel_sides[`side_${i}`] = {
                    sideExists: safeGetChecked(`${p}enabled`),
                    pulserPin: parseInt(safeGetValue(`${p}pulserPin`, 0), 10),
                    nozzleSwitchPin: parseInt(safeGetValue(`${p}nozzleSwitchPin`, 0), 10),
                    relaySwitchPin: parseInt(safeGetValue(`${p}relaySwitchPin`, 0), 10),
                    pulsesPerLiter: parseInt(safeGetValue(`${p}pulsesPerLiter`, 0), 10),
                    price: parseFloat(safeGetValue(`${p}price`, 0)),
                    product: safeGetValue(`${p}product`, ''),
                    isAutomatic: safeGetChecked(`${p}isAutomatic`),
                    relayActivationDelay: parseInt(safeGetValue(`${p}relayActivationDelay`, 0), 10),
                    nozzleSwitch_invert_polarity:
                        safeGetChecked(`${p}nozzleSwitch_invert_polarity`),
                    max_time_without_fueling:
                        parseInt(safeGetValue(`${p}max_time_without_fueling`, 0), 10),
                    calibration_factor: parseFloat(safeGetValue(`${p}calibration_factor`, 1)),
                    simulation_pulser: safeGetChecked(`${p}simulation_pulser`)
                };
            }

            // GUI sides
            for (let i = 1; i <= 4; i++) {
                const p = `gui-${i}-`;
                parameters.gui_sides[`side_${i}`] = {
                    sideExists: safeGetChecked(`${p}enabled`),
                    buttonText: safeGetValue(`${p}buttonText`, ''),
                    buttonWidth: parseInt(safeGetValue(`${p}buttonWidth`, 0), 10),
                    buttonHeight: parseInt(safeGetValue(`${p}buttonHeight`, 0), 10),
                    buttonColor: safeGetValue(`${p}buttonColor`, '#808080'),
                    buttonBorderColor: safeGetValue(`${p}buttonBorderColor`, '#C0C0C0'),
                    aut_buttonColor: safeGetValue(`${p}aut_buttonColor`, '#008000'),
                    aut_buttonBorderColor: safeGetValue(`${p}aut_buttonBorderColor`, '#556B2F'),
                    inuse_buttonColor: safeGetValue(`${p}inuse_buttonColor`, '#B00000'),
                    inuse_buttonBorderColor:
                        safeGetValue(`${p}inuse_buttonBorderColor`, '#8D0000'),
                    available_buttonColor: safeGetValue(`${p}available_buttonColor`, '#FF8C00'),
                    available_buttonBorderColor:
                        safeGetValue(`${p}available_buttonBorderColor`, '#DAA520'),
                    buttonBorderWidth: parseInt(safeGetValue(`${p}buttonBorderWidth`, 0), 10),
                    buttonCornerRadius: parseInt(safeGetValue(`${p}buttonCornerRadius`, 0), 10),
                    button_relx: parseFloat(safeGetValue(`${p}button_relx`, null)),
                    button_rely: parseFloat(safeGetValue(`${p}button_rely`, null)),
                    labelText: safeGetValue(`${p}labelText`, '')
                };
            }

            // Main parameters
            parameters.main_parameters = {
                aut_MainLabel: safeGetValue('main-aut_MainLabel', ''),
                man_MainLabel: safeGetValue('main-man_MainLabel', ''),
                sel_MainLabel: safeGetValue('main-sel_MainLabel', ''),
                ref_MainLabel: safeGetValue('main-ref_MainLabel', ''),
                exp_MainLabel: safeGetValue('main-exp_MainLabel', ''),
                max_selection_time:
                    parseInt(safeGetValue('main-max_selection_time', 0), 10)
            };

            // Invio
            const url = `${this.API_BASE}/parameters/`;
            await this.fetchWithRetry(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parameters)
            });

            this.showToast('Parameters saved successfully');
        } catch (err) {
            this.showDetailedErrorToast(err, 'Failed to save parameters');
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }


    // Reset parameters to defaults
    static async resetParameters() {
        if (!confirm('Are you sure you want to reset all parameters to default values?')) {
            return;
        }

        try {
            const url = `${this.API_BASE}/parameters/reset`;
            const response = await this.fetchWithRetry(url, {
                method: 'POST'
            });

            // Reload the parameters to show the defaults
            await this.loadParameters();
            this.showToast('Parameters reset to defaults successfully');
        } catch (err) {
            this.showDetailedErrorToast(err, 'Failed to reset parameters');
        }
    }
    // Export current page table to CSV
    static exportCurrentPageTable(tableId, filename) {
        try {
            const rows = Array.from(document.querySelectorAll(`#${tableId} tr`));
            const csv = rows.map(row => {
                const cols = Array.from(row.querySelectorAll('th, td'));
                return cols.map(col => `"${col.textContent.replace(/"/g, '""')}"`).join(',');
            }).join('\n');

            this.downloadCSV(csv, filename);
            this.showToast(`Exported ${filename} successfully`);
        } catch (error) {
            console.error('Export error:', error);
            this.showToast(`Export error: ${error.message}`, 'danger');
        }
    }

    // Export all dispenses
    static async exportAllDispenses() {
        try {
            const url = `${this.API_BASE}/erogazioni/`;
            const data = await this.fetchWithRetry(url);
            this.exportDataToCSV(data.items, 'erogazioni_complete.csv');
            this.showToast('All dispenses exported successfully');
        } catch (err) {
            console.error('Export all dispenses error:', err);
            this.showToast(`Error exporting all dispenses: ${err.message}`, 'danger');
        }
    }

    // Export all vehicles
    static async exportAllVehicles() {
        try {
            const url = `${this.API_BASE}/veicoli/`;
            const data = await this.fetchWithRetry(url);
            this.exportDataToCSV(data.items, 'veicoli_completi.csv');
            this.showToast('All vehicles exported successfully');
        } catch (err) {
            console.error('Export all vehicles error:', err);
            this.showToast(`Error exporting all vehicles: ${err.message}`, 'danger');
        }
    }

    // Export all drivers
    static async exportAllDrivers() {
        try {
            const url = `${this.API_BASE}/autisti/`;
            const data = await this.fetchWithRetry(url);
            this.exportDataToCSV(data.items, 'autisti_completi.csv');
            this.showToast('All drivers exported successfully');
        } catch (err) {
            console.error('Export all drivers error:', err);
            this.showToast(`Error exporting all drivers: ${err.message}`, 'danger');
        }
    }

    // Generic function to export any data to CSV
    static exportDataToCSV(data, filename) {
        if (!data || !data.length) {
            throw new Error('No data to export');
        }

        // Get headers from first object's keys
        const headers = Object.keys(data[0]);

        // Create CSV content
        const csvRows = [];

        // Add header row
        csvRows.push(headers.join(','));

        // Add data rows
        data.forEach(item => {
            const values = headers.map(header => {
                // Escape quotes and wrap in quotes
                const value = item[header] !== undefined ? item[header] : '';
                return `"${String(value).replace(/"/g, '""')}"`;
            });
            csvRows.push(values.join(','));
        });

        // Create and download CSV file
        const csvContent = csvRows.join('\n');
        this.downloadCSV(csvContent, filename);
    }

    // Download CSV file
    static downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }

    // Show toast notification
    static showToast(message, type = 'success') {
        const toastEl = document.getElementById('toast');
        const toastBody = toastEl.querySelector('.toast-body');

        // Adjust toast width for longer messages
        toastEl.style.maxWidth = message.length > 100 ? '400px' : '350px';

        toastEl.className = `toast align-items-center text-white bg-${type}`;
        toastBody.textContent = message;

        const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
        toast.show();

        // Adjust duration based on message length
        const duration = Math.min(10000, Math.max(3000, message.length * 50));
        setTimeout(() => toast.hide(), duration);
    }

    // Show modal dialog
    static showModal(modalId) {
        const modal = new bootstrap.Modal(document.getElementById(modalId));
        modal.show();
        const input = document.querySelector(`#${modalId} input`);
        if (input) input.focus();
    }

    // Hide modal dialog
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

    // Debounce function for performance
    static debounce(fn, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // Fetch with retry logic
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

                const error = new Error(`HTTP error! status: ${response.status}`);
                error.response = {
                    status: response.status,
                    data: errorData
                };
                throw error;
            }

            return await response.json();
        } catch (error) {
            // Don't retry for these cases
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

    // Parse API error
    static parseAPIError(error) {
        // Handle cases where error is already a string
        if (typeof error === 'string') return error;

        // Handle HTTP error responses
        if (error.response) {
            const { status, data } = error.response;

            // Special handling for 422 Unprocessable Entity
            if (status === 422) {
                if (data && data.errors) {
                    // Handle Laravel-style validation errors
                    return Object.values(data.errors)
                        .flat()
                        .join('. ');
                }
                return data.message || 'Validation failed. Please check your input.';
            }

            // Other status code mappings
            const statusMessages = {
                400: 'Invalid request',
                401: 'Please login again',
                403: 'You don\'t have permission for this',
                404: 'Resource not found',
                500: 'Server error',
                503: 'Service temporarily unavailable'
            };

            let message = statusMessages[status] || `Server error (${status})`;

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

        // Handle network errors
        if (error.message && error.message.includes('Network Error')) {
            return 'Could not connect to server. Please check your connection.';
        }

        // Fallback to error message or generic message
        return error.message || 'An unexpected error occurred';
    }

    // Show detailed error toast
    static showDetailedErrorToast(error, context = '') {
        let message = this.parseAPIError(error);

        // Add context if provided
        if (context) {
            message = `${context}: ${message}`;
        }

        // Special handling for common error patterns
        const commonErrors = {
            'violates foreign key constraint': 'Cannot delete: this item is being used elsewhere',
            'duplicate key value violates unique constraint': 'This item already exists',
            'network error': 'Could not connect to server'
        };

        Object.entries(commonErrors).forEach(([key, value]) => {
            if (message.toLowerCase().includes(key)) {
                message = value;
            }
        });

        this.showToast(message, 'danger');

        // Log full error to console for debugging
        console.error(context, error);
    }

    // Update pagination controls
    static updatePaginationControls(section) {
        const { currentPage, pageSize, totalItems } = this.pagination[section];
        const totalPages = Math.ceil(totalItems / pageSize);
        const controlsContainer = document.querySelector(`#${section} .pagination-controls`);

        if (!controlsContainer) return;

        controlsContainer.innerHTML = `
            <div class="btn-group">
                <button class="btn btn-sm btn-outline-primary ${currentPage <= 1 ? 'disabled' : ''}" 
                    onclick="Dashboard.load${section.charAt(0).toUpperCase() + section.slice(1)}(${currentPage - 1})">
                    <i class="bi bi-chevron-left"></i>
                </button>
                
                ${this.generatePageNumbers(section, currentPage, totalPages)}
                
                <button class="btn btn-sm btn-outline-primary ${currentPage >= totalPages ? 'disabled' : ''}" 
                    onclick="Dashboard.load${section.charAt(0).toUpperCase() + section.slice(1)}(${currentPage + 1})">
                    <i class="bi bi-chevron-right"></i>
                </button>
            </div>
            <span class="ms-2">${currentPage} of ${totalPages}</span>
        `;
    }

    // Generate page number buttons with smart truncation
    static generatePageNumbers(section, currentPage, totalPages) {
        let pagesHtml = '';
        const maxVisiblePages = 5; // Show up to 5 page numbers

        if (totalPages <= maxVisiblePages) {
            // Show all pages
            for (let i = 1; i <= totalPages; i++) {
                pagesHtml += this.getPageButton(section, i, currentPage);
            }
        } else {
            // Show limited pages with ellipsis
            if (currentPage <= 3) {
                // Show first 3 pages, ellipsis, last page
                for (let i = 1; i <= 3; i++) {
                    pagesHtml += this.getPageButton(section, i, currentPage);
                }
                pagesHtml += '<span class="btn btn-sm btn-outline-secondary disabled">...</span>';
                pagesHtml += this.getPageButton(section, totalPages, currentPage);
            } else if (currentPage >= totalPages - 2) {
                // Show first page, ellipsis, last 3 pages
                pagesHtml += this.getPageButton(section, 1, currentPage);
                pagesHtml += '<span class="btn btn-sm btn-outline-secondary disabled">...</span>';
                for (let i = totalPages - 2; i <= totalPages; i++) {
                    pagesHtml += this.getPageButton(section, i, currentPage);
                }
            } else {
                // Show first page, ellipsis, current-1, current, current+1, ellipsis, last page
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

    // Generate a single page button
    static getPageButton(section, page, currentPage) {
        return `
            <button class="btn btn-sm ${page === currentPage ? 'btn-primary' : 'btn-outline-primary'}" 
                onclick="Dashboard.load${section.charAt(0).toUpperCase() + section.slice(1)}(${page})">
                ${page}
            </button>
        `;
    }

    // Clear caches when switching tabs
    static clearCaches() {
        this.vehiclesCache = null;
        this.driversCache = null;
    }
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => Dashboard.init());