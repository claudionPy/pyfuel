import { ApiService } from "../core/apiservice.js";
import { TableRenderer } from "../ui/tablerenderer.js";
import { Pagination } from "../ui/pagination.js";
import { Toast } from "../ui/toast.js";

export class DispensesModule {
    static async loadDispenses(page = null, filters = {}) {
        // Update current page if specified
        if (page !== null) {
            Dashboard.pagination.dispenses.currentPage = page;
        }

        const { currentPage, pageSize } = Dashboard.pagination.dispenses;
        const loading = document.getElementById('dispenses-loading');
        const btn = document.getElementById('load-dispenses');

        try {
            btn.disabled = true;
            loading.classList.remove('d-none');

            const urlParams = new URLSearchParams({
                page: currentPage,
                limit: pageSize,
                ...filters
            });

            const url = `${Dashboard.API_BASE}/erogations/?${urlParams.toString()}`;
            const data = await ApiService.fetchWithRetry(url);

            Dashboard.pagination.dispenses.totalItems = data.total;
            TableRenderer.renderDispenses(data.items);
            Pagination.updatePaginationControls('dispenses');

            Toast.showToast(`Pagina ${currentPage} di ${Math.ceil(data.total / pageSize)}`);
        } catch (err) {
            ApiService.showDetailedErrorToast(err, 'Caricamento fallito');
            // Revert to previous page on error
            if (page !== null) {
                Dashboard.pagination.dispenses.currentPage = 1;
                Pagination.updatePaginationControls('dispenses');
            }
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    static async searchDispenses() {
        // Get picker instances directly (more efficient)
        const startPicker = document.getElementById('dispenses-start-filter')._flatpickr;
        const endPicker = document.getElementById('dispenses-end-filter')._flatpickr;
        const query = document.getElementById('dispenses-search').value.trim();

        // Get dates without creating new objects
        const startTime = startPicker.selectedDates[0]?.toISOString();
        const endTime = endPicker.selectedDates[0]?.toISOString();

        try {
            // Show loading state
            const btn = document.getElementById('search-dispenses');
            btn.disabled = true;
            document.getElementById('dispenses-loading').classList.remove('d-none');

            // Build search params
            const searchParams = {
                page: Dashboard.pagination.dispenses.currentPage,
                limit: Dashboard.pagination.dispenses.pageSize
            };

            // Determine which endpoint to use based on the search type
            let url;

            if (startTime || endTime || query) {
                // Use the search endpoint for date filtering
                if (startTime) searchParams.start_time = startTime;
                if (endTime) searchParams.end_time = endTime;
                if (query) {
                    const parsedQuery = Dashboard.parseSearchQuery(query);
                    Dashboard.validateSearchParams('dispenses', parsedQuery);
                    Object.assign(searchParams, parsedQuery);
                }
                url = `${Dashboard.API_BASE}/erogations/search/?${new URLSearchParams(searchParams).toString()}`;
            } else {
                // No search criteria - just load normally
                return this.loadDispenses();
            }

            // Make API call
            const data = await ApiService.fetchWithRetry(url);

            // Efficient rendering
            Dashboard.pagination.dispenses.totalItems = data.total;
            TableRenderer.renderDispenses(data.items);
            Pagination.updatePaginationControls('dispenses');

        } catch (err) {
            ApiService.showDetailedErrorToast(err, 'Ricerca fallita');
        } finally {
            const btn = document.getElementById('search-dispenses');
            btn.disabled = false;
            document.getElementById('dispenses-loading').classList.add('d-none');
        }
    }

    static async deleteAllDispenses() {
        if (!confirm('Sei sicuro di voler eliminare TUTTE le erogazioni? L\'operazione è irreversibile.')) {
            return;
        }
        try {
            const res = await fetch(`${Dashboard.API_BASE}/erogations/`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.status === 204 || res.ok) {
                document.querySelector('#dispense-table tbody').innerHTML = '';
                Dashboard.pagination.dispenses.totalItems = 0;
                Pagination.updatePaginationControls('dispenses');
                Toast.showToast('Erogazioni eliminate con successo');
            } else {
                const text = await res.text();
                throw new Error(text || 'Errore durante l\'eliminazione delle erogazioni');
            }
        } catch (err) {
            console.error('Errore eliminazione erogazioni:', err);
            Toast.showToast(`Errore: ${err.message}`, 'danger');
        }
    }

    static async exportAllDispenses() {
        try {
            const url = `${Dashboard.API_BASE}/erogations/`;
            const data = await ApiService.fetchWithRetry(url);
            Dashboard.exportDataToCSV(data.items, 'erogazioni_complete.csv');
            Toast.showToast('Tutte le erogazioni esportate con successo');
        } catch (err) {
            console.error('Errore esportazione erogazioni:', err);
            Toast.showToast(`Errore durante l'esportazione: ${err.message}`, 'danger');
        }
    }
}