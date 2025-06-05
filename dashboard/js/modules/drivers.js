import { ApiService } from "../core/apiservice.js";
import { TableRenderer } from "../ui/tablerenderer.js";
import { Pagination } from "../ui/pagination.js";
import { Toast } from "../ui/toast.js";
import { Modals } from "../ui/modals.js";

export class DriversModule {
    static async loadDrivers(page = null) {
        if (page !== null) {
            Dashboard.pagination.drivers.currentPage = page;
        }

        const { currentPage, pageSize } = Dashboard.pagination.drivers;
        const loading = document.getElementById('drivers-loading');
        const btn = document.getElementById('load-drivers');

        try {
            btn.disabled = true;
            loading.classList.remove('d-none');

            const url = `${Dashboard.API_BASE}/drivers/?page=${currentPage}&limit=${pageSize}`;
            const data = await ApiService.fetchWithRetry(url);

            Dashboard.pagination.drivers.totalItems = data.total || data.items.length;
            Dashboard.driversCache = data.items;
            TableRenderer.renderDrivers(data.items);
            Pagination.updatePaginationControls('drivers');

            Toast.showToast(`Autisti caricati (pagina ${currentPage})`);
        } catch (err) {
            ApiService.showDetailedErrorToast(err, 'Caricamento autisti fallito');
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    static async searchDrivers() {
        const input = document.getElementById('drivers-search');
        const query = input.value.trim();
        const loading = document.getElementById('drivers-loading');
        const btn = document.getElementById('load-drivers');

        // Reimposta alla prima pagina durante la ricerca
        Dashboard.pagination.drivers.currentPage = 1;

        if (!query) {
            Toast.showToast('Inserire un termine di ricerca', 'warning');
            input.focus();
            return this.loadDrivers();
        }

        try {
            btn.disabled = true;
            loading.classList.remove('d-none');

            let searchParams;
            try {
                searchParams = Dashboard.parseSearchQuery(query);
                Dashboard.validateSearchParams('drivers', searchParams);
            } catch (err) {
                Toast.showToast(err.message, 'warning');
                return;
            }

            const { currentPage, pageSize } = Dashboard.pagination.drivers;
            const url = Dashboard.buildSearchUrl('/drivers/search/', {
                ...searchParams,
                page: currentPage,
                limit: pageSize
            });

            const data = await ApiService.fetchWithRetry(url);
            Dashboard.pagination.drivers.totalItems = data.total || data.items.length;
            Dashboard.driversCache = data.items;
            TableRenderer.renderDrivers(data.items);
            Pagination.updatePaginationControls('drivers');

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
            ApiService.showDetailedErrorToast(err, 'Ricerca fallita');
            document.querySelector('#drivers-table tbody').innerHTML = '';
            Dashboard.pagination.drivers.totalItems = 0;
            Pagination.updatePaginationControls('drivers');
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

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
                ? `${Dashboard.API_BASE}/drivers/${encodeURIComponent(form.dataset.originaltessera)}`
                : `${Dashboard.API_BASE}/drivers/`;

            await ApiService.fetchWithRetry(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

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

    static async editDriver(tessera) {
        try {
            if (!Dashboard.driversCache) {
                await this.loadDrivers();
            }

            const driver = Dashboard.driversCache.find(d => d.card === tessera);
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
            Modals.showModal('modal-driver');
            Toast.showToast('Modifica i campi dell\'autista e salva le modifiche');
        } catch (err) {
            console.error('Errore modifica autista:', err);
            Toast.showToast(`Errore durante la modifica: ${err.message}`, 'danger');
        }
    }

    static async deleteDriver(card) {
        if (!confirm(`Sei sicuro di voler eliminare l'autista con tessera: ${card}?`)) return;

        try {
            const res = await fetch(`${Dashboard.API_BASE}/drivers/${encodeURIComponent(card)}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.status === 204 || res.ok) {
                Dashboard.driversCache = null;
                await this.loadDrivers();
                Toast.showToast('Autista eliminato con successo');
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
            ApiService.showDetailedErrorToast(err, 'Autista non eliminato');
        }
    }

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