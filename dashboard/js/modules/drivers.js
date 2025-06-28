import { ApiService } from "../core/apiservice.js";
import { TableRenderer } from "../ui/tablerenderer.js";
import { Pagination } from "../ui/pagination.js";
import { Toast } from "../ui/toast.js";
import { Modals } from "../ui/modals.js";

/**
 * DriversModule manages CRUD operations, search, pagination, and export
 * for driver records in the dashboard.
 */
export class DriversModule {
    /**
     * Load drivers from the server, update table and pagination.
     * @param {number|null} [page=null] - Page number to load, or keep current if null.
     */
    static async loadDrivers(page = null) {
        // If page specified, update pagination state
        if (page !== null) {
            Dashboard.pagination.drivers.currentPage = page;
        }

        const { currentPage, pageSize } = Dashboard.pagination.drivers;
        const loading = document.getElementById('drivers-loading');
        const btn = document.getElementById('load-drivers');

        try {
            // Disable load button and show spinner
            btn.disabled = true;
            loading.classList.remove('d-none');

            // Build API URL with pagination
            const url = `${Dashboard.API_BASE}/drivers/?page=${currentPage}&limit=${pageSize}`;
            const data = await ApiService.fetchWithRetry(url);

            // Update total count and cache
            Dashboard.pagination.drivers.totalItems = data.total || data.items.length;
            Dashboard.driversCache = data.items;

            // Render table and pagination controls
            TableRenderer.renderDrivers(data.items);
            Pagination.updatePaginationControls('drivers');

            // Notify user of load status
            Toast.showToast(`Autisti caricati (pagina ${currentPage})`);
        } catch (err) {
            // Show detailed error on failure
            ApiService.showDetailedErrorToast(err, 'Caricamento autisti fallito');
        } finally {
            // Re-enable button and hide spinner
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    /**
     * Search drivers with field or free-text query, reset to page 1.
     */
    static async searchDrivers() {
        const input = document.getElementById('drivers-search');
        const query = input.value.trim();
        const loading = document.getElementById('drivers-loading');
        const btn = document.getElementById('load-drivers');

        // Always start from first page on search
        Dashboard.pagination.drivers.currentPage = 1;

        if (!query) {
            // Warn if no query provided
            Toast.showToast('Inserire un termine di ricerca', 'warning');
            input.focus();
            return this.loadDrivers();
        }

        try {
            btn.disabled = true;
            loading.classList.remove('d-none');

            // Parse and validate search query
            let searchParams;
            try {
                searchParams = Dashboard.parseSearchQuery(query);
                Dashboard.validateSearchParams('drivers', searchParams);
            } catch (err) {
                Toast.showToast(err.message, 'warning');
                return;
            }

            // Build search URL with pagination and filters
            const { currentPage, pageSize } = Dashboard.pagination.drivers;
            const url = Dashboard.buildSearchUrl('/drivers/search/', {
                ...searchParams,
                page: currentPage,
                limit: pageSize
            });

            // Fetch and display results
            const data = await ApiService.fetchWithRetry(url);
            Dashboard.pagination.drivers.totalItems = data.total || data.items.length;
            Dashboard.driversCache = data.items;
            TableRenderer.renderDrivers(data.items);
            Pagination.updatePaginationControls('drivers');

            // Inform user of search outcome
            if (data.items.length === 0) {
                Toast.showToast('Nessun autista corrispondente ai criteri di ricerca', 'info');
            } else {
                const itemCount = data.items.length;
                const totalCount = Dashboard.pagination.drivers.totalItems;
                const message = totalCount > itemCount
                    ? `Mostrati ${itemCount} di ${totalCount} autisti corrispondenti`
                    : `Trovati ${itemCount} autisti corrispondenti`;
                Toast.showToast(message);
            }
        } catch (err) {
            // On error, show toast and clear table
            ApiService.showDetailedErrorToast(err, 'Ricerca fallita');
            document.querySelector('#drivers-table tbody').innerHTML = '';
            Dashboard.pagination.drivers.totalItems = 0;
            Pagination.updatePaginationControls('drivers');
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    /**
     * Handle submission of driver form for create or update.
     * @param {Event} e - Form submit event.
     */
    static async handleDriverSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const pinError = document.getElementById('pin-error');

        // Validate PIN if requested
        if (form.richiedi_pin.checked && !form.pin.value) {
            form.pin.classList.add('is-invalid');
            pinError.style.display = 'block';
            return;
        }

        try {
            // Construct payload from form fields
            const payload = {
                card: form.tessera.value,
                company: form.nome_compagnia.value,
                driver_full_name: form.nome_autista.value,
                request_pin: form.richiedi_pin.checked,
                request_vehicle_id: form.richiedi_id_veicolo.checked,
                pin: form.pin.value
            };

            // Determine HTTP method and endpoint
            const method = form.dataset.originaltessera ? 'PUT' : 'POST';
            const url = form.dataset.originaltessera
                ? `${Dashboard.API_BASE}/drivers/${encodeURIComponent(form.dataset.originaltessera)}`
                : `${Dashboard.API_BASE}/drivers/`;

            // Send request
            await ApiService.fetchWithRetry(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Close modal, reset form, clear cache, reload list
            Modals.hideModal('modal-driver');
            form.reset();
            delete form.dataset.originaltessera;
            Dashboard.driversCache = null;
            await this.loadDrivers();

            Toast.showToast(`Autista ${method === 'POST' ? 'creato' : 'aggiornato'} con successo`);
        } catch (err) {
            ApiService.showDetailedErrorToast(err, 'Operazione autista fallita');
        }
    }

    /**
     * Populate form with existing driver data for editing.
     * @param {string} tessera - Driver card identifier.
     */
    static async editDriver(tessera) {
        try {
            // Ensure cache is populated
            if (!Dashboard.driversCache) {
                await this.loadDrivers();
            }

            // Find driver by card
            const driver = Dashboard.driversCache.find(d => d.card === tessera);
            if (!driver) {
                throw new Error('Autista non trovato');
            }

            // Fill form fields
            const form = document.getElementById('form-driver');
            form.tessera.value = driver.card;
            form.nome_compagnia.value = driver.company || '';
            form.nome_autista.value = driver.driver_full_name || '';
            form.richiedi_pin.checked = driver.request_pin || false;
            form.richiedi_id_veicolo.checked = driver.request_vehicle_id || false;
            form.pin.value = driver.pin || '';

            // Mark form as editing and show modal
            form.dataset.originaltessera = driver.card;
            Modals.showModal('modal-driver');
            Toast.showToast('Modifica i campi dell\'autista e salva le modifiche');
        } catch (err) {
            console.error('Errore modifica autista:', err);
            Toast.showToast(`Errore durante la modifica: ${err.message}`, 'danger');
        }
    }

    /**
     * Delete a driver by card after confirmation, then reload list.
     * @param {string} card - Driver card identifier.
     */
    static async deleteDriver(card) {
        // Confirm deletion
        if (!confirm(`Sei sicuro di voler eliminare l'autista con tessera: ${card}?`)) return;

        try {
            // Send DELETE request
            const res = await fetch(
                `${Dashboard.API_BASE}/drivers/${encodeURIComponent(card)}`,
                { method: 'DELETE', headers: { 'Content-Type': 'application/json' } }
            );

            if (res.status === 204 || res.ok) {
                // Clear cache and reload
                Dashboard.driversCache = null;
                await this.loadDrivers();
                Toast.showToast('Autista eliminato con successo');
            } else {
                // Extract error message from response
                let errorMessage;
                try {
                    const errorData = await res.json();
                    errorMessage = errorData.message || errorData.error || 'Eliminazione fallita';
                } catch {
                    errorMessage = await res.text();
                }
                throw new Error(errorMessage);
            }
        } catch (err) {
            ApiService.showDetailedErrorToast(err, 'Autista non eliminato');
        }
    }

    /**
     * Export all drivers via CSV download.
     */
    static async exportAllDrivers() {
        try {
            const url = `${Dashboard.API_BASE}/drivers/`;
            const data = await ApiService.fetchWithRetry(url);
            Dashboard.exportDataToCSV(data.items, 'autisti_completi.csv');
            Toast.showToast('Tutti gli autisti esportati con successo');
        } catch (err) {
            console.error('Errore esportazione autisti:', err);
            Toast.showToast(`Errore durante l'esportazione: ${err.message}`, 'danger');
        }
    }
}

