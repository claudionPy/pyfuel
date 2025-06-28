import { ApiService } from "../core/apiservice.js";
import { TableRenderer } from "../ui/tablerenderer.js";
import { Pagination } from "../ui/pagination.js";
import { Toast } from "../ui/toast.js";
import { Modals } from "../ui/modals.js";

/**
 * VehiclesModule handles CRUD, search, pagination, and export
 * for vehicle records in the dashboard.
 */
export class VehiclesModule {
    /**
     * Load vehicles from API with optional page number, update table & pagination.
     * @param {number|null} [page=null] - Page to load or keep current if null.
     */
    static async loadVehicles(page = null) {
        if (page !== null) Dashboard.pagination.vehicles.currentPage = page;

        const { currentPage, pageSize } = Dashboard.pagination.vehicles;
        const loading = document.getElementById('vehicles-loading');
        const btn = document.getElementById('load-vehicles');

        try {
            // Indicate loading state
            btn.disabled = true;
            loading.classList.remove('d-none');

            // Fetch data
            const url = `${Dashboard.API_BASE}/vehicles/?page=${currentPage}&limit=${pageSize}`;
            const data = await ApiService.fetchWithRetry(url);

            // Update total count & cache
            Dashboard.pagination.vehicles.totalItems = data.total || data.items.length;
            Dashboard.vehiclesCache = data.items;

            // Render and paginate
            TableRenderer.renderVehicles(data.items);
            Pagination.updatePaginationControls('vehicles');

            Toast.showToast(`Veicoli caricati (pagina ${currentPage})`);
        } catch (err) {
            ApiService.showDetailedErrorToast(err, 'Caricamento veicoli fallito');
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    /**
     * Search vehicles by field or free-text, reset to page 1.
     */
    static async searchVehicles() {
        const input = document.getElementById('vehicles-search');
        const query = input.value.trim();
        const loading = document.getElementById('vehicles-loading');
        const btn = document.getElementById('load-vehicles');

        Dashboard.pagination.vehicles.currentPage = 1;

        if (!query) {
            Toast.showToast('Inserire un termine di ricerca', 'warning');
            input.focus();
            return this.loadVehicles();
        }

        try {
            btn.disabled = true;
            loading.classList.remove('d-none');

            // Parse & validate
            let searchParams;
            try {
                searchParams = Dashboard.parseSearchQuery(query);
                Dashboard.validateSearchParams('vehicles', searchParams);
            } catch (err) {
                Toast.showToast(err.message, 'warning');
                return;
            }

            // Build URL
            const { currentPage, pageSize } = Dashboard.pagination.vehicles;
            const url = Dashboard.buildSearchUrl('/vehicles/search/', {
                ...searchParams,
                page: currentPage,
                limit: pageSize
            });

            const data = await ApiService.fetchWithRetry(url);
            Dashboard.pagination.vehicles.totalItems = data.total || data.items.length;
            Dashboard.vehiclesCache = data.items;
            TableRenderer.renderVehicles(data.items);
            Pagination.updatePaginationControls('vehicles');

            // Notify user
            if (!data.items.length) {
                Toast.showToast('Nessun veicolo corrispondente ai criteri di ricerca', 'info');
            } else {
                const itemCount = data.items.length;
                const total = Dashboard.pagination.vehicles.totalItems;
                const msg = total > itemCount
                    ? `Mostrati ${itemCount} di ${total} veicoli corrispondenti`
                    : `Trovati ${itemCount} veicoli corrispondenti`;
                Toast.showToast(msg);
            }
        } catch (err) {
            ApiService.showDetailedErrorToast(err, 'Ricerca fallita');
            document.querySelector('#vehicles-table tbody').innerHTML = '';
            Dashboard.pagination.vehicles.totalItems = 0;
            Pagination.updatePaginationControls('vehicles');
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    /**
     * Handle submit for create or update vehicle.
     * @param {Event} e - Form submit event.
     */
    static async handleVehicleSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const kmInput = form.km_totali_veicolo;

        // Validate numeric km
        if (kmInput.value.trim() && !/^\d*\.?\d+$/.test(kmInput.value.trim())) {
            kmInput.classList.add('is-invalid');
            Toast.showToast('I chilometri devono essere un valore numerico', 'warning');
            return;
        }

        try {
            // Build payload
            const payload = {
                vehicle_id: form.id_veicolo.value,
                company_vehicle: form.nome_compagnia.value,
                vehicle_total_km: String(form.km_totali_veicolo.value || '0'),
                plate: form.targa.value,
                request_vehicle_km: form.richiedi_km_veicolo.checked
            };

            const method = form.dataset.originalId ? 'PUT' : 'POST';
            const url = form.dataset.originalId
                ? `${Dashboard.API_BASE}/vehicles/${encodeURIComponent(form.dataset.originalId)}`
                : `${Dashboard.API_BASE}/vehicles/`;

            await ApiService.fetchWithRetry(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Reset UI
            Modals.hideModal('modal-vehicle');
            form.reset();
            delete form.dataset.originalId;
            Dashboard.vehiclesCache = null;
            await this.loadVehicles();
            Toast.showToast(`Veicolo ${method === 'POST' ? 'creato' : 'aggiornato'} con successo`);
        } catch (err) {
            ApiService.showDetailedErrorToast(err, 'Operazione veicolo fallita');
        }
    }

    /**
     * Populate form for editing an existing vehicle.
     * @param {string|number} vehicleId - Identifier of the vehicle.
     */
    static async editVehicle(vehicleId) {
        try {
            if (!Dashboard.vehiclesCache) await this.loadVehicles();
            // Find vehicle in cache
            const vehicle = Dashboard.vehiclesCache.find(v =>
                String(v.vehicle_id) === String(vehicleId)
            );
            if (!vehicle) throw new Error('Veicolo non trovato');

            // Fill form fields
            const form = document.getElementById('form-vehicle');
            form.id_veicolo.value = String(vehicle.vehicle_id);
            form.nome_compagnia.value = vehicle.company_vehicle || '';
            form.km_totali_veicolo.value = vehicle.vehicle_total_km || '0';
            form.targa.value = vehicle.plate || '';
            form.richiedi_km_veicolo.checked = vehicle.request_vehicle_km || false;

            form.dataset.originalId = String(vehicle.vehicle_id);
            Modals.showModal('modal-vehicle');
            Toast.showToast('Modifica i campi del veicolo e salva le modifiche');
        } catch (err) {
            console.error('Errore modifica veicolo:', err);
            Toast.showToast(`Errore durante la modifica: ${err.message}`, 'danger');
        }
    }

    /**
     * Delete a vehicle after confirmation and reload list.
     * @param {string|number} vehicleId
     */
    static async deleteVehicle(vehicleId) {
        if (!confirm(`Sei sicuro di voler eliminare il veicolo con ID: ${vehicleId}?`)) return;

        try {
            const res = await fetch(`${Dashboard.API_BASE}/vehicles/${encodeURIComponent(vehicleId)}`, {
                method: 'DELETE'
            });
            if (res.status === 204 || res.ok) {
                Dashboard.vehiclesCache = null;
                await this.loadVehicles();
                Toast.showToast('Veicolo eliminato con successo');
            } else {
                let errorMessage;
                try {
                    const errData = await res.json();
                    errorMessage = errData.message || errData.error || 'Eliminazione fallita';
                } catch {
                    errorMessage = await res.text();
                }
                throw new Error(errorMessage);
            }
        } catch (err) {
            ApiService.showDetailedErrorToast(err, 'Veicolo non eliminato');
        }
    }

    /**
     * Export all vehicles by fetching full dataset and triggering CSV download.
     */
    static async exportAllVehicles() {
        try {
            const url = `${Dashboard.API_BASE}/vehicles/`;
            const data = await ApiService.fetchWithRetry(url);
            Dashboard.exportDataToCSV(data.items, 'veicoli_completi.csv');
            Toast.showToast('Tutti i veicoli esportati con successo');
        } catch (err) {
            console.error('Errore esportazione veicoli:', err);
            Toast.showToast(`Errore durante l'esportazione: ${err.message}`, 'danger');
        }
    }
}

