import { ApiService } from "../core/apiservice.js";
import { TableRenderer } from "../ui/tablerenderer.js";
import { Pagination } from "../ui/pagination.js";
import { Toast } from "../ui/toast.js";

/**
 * DispensesModule handles loading, searching, deleting,
 * and exporting dispense records in the dashboard.
 */
export class DispensesModule {
    /**
     * Load dispense data from the server with optional paging and filters.
     * Updates the table, pagination controls, and shows status to the user.
     * @param {number|null} [page=null] - Specific page to load or null to keep current.
     * @param {Object} [filters={}] - Additional query filters (start_time, end_time, etc.).
     */
    static async loadDispenses(page = null, filters = {}) {
        // If a new page number is provided, update state
        if (page !== null) {
            Dashboard.pagination.dispenses.currentPage = page;
        }

        const { currentPage, pageSize } = Dashboard.pagination.dispenses;
        const loading = document.getElementById('dispenses-loading');
        const btn = document.getElementById('load-dispenses');

        try {
            // Disable button and show loading spinner
            btn.disabled = true;
            loading.classList.remove('d-none');

            // Build query string with pagination and filters
            const urlParams = new URLSearchParams({ page: currentPage, limit: pageSize, ...filters });
            const url = `${Dashboard.API_BASE}/erogations/?${urlParams.toString()}`;

            // Fetch data via ApiService (with retry)
            const data = await ApiService.fetchWithRetry(url);

            // Update pagination state
            Dashboard.pagination.dispenses.totalItems = data.total;

            // Render table and pagination controls
            TableRenderer.renderDispenses(data.items);
            Pagination.updatePaginationControls('dispenses');

            // Notify user of current page status
            Toast.showToast(`Pagina ${currentPage} di ${Math.ceil(data.total / pageSize)}`);
        } catch (err) {
            // Show detailed error toast and reset page to 1 if failure
            ApiService.showDetailedErrorToast(err, 'Caricamento fallito');
            if (page !== null) {
                Dashboard.pagination.dispenses.currentPage = 1;
                Pagination.updatePaginationControls('dispenses');
            }
        } finally {
            // Re-enable button and hide spinner
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    /**
     * Perform a search with date filters or field query, updating the table.
     * @throws {Error} If search parameters are invalid.
     */
    static async searchDispenses() {
        // Access flatpickr instances for date filters
        const startPicker = document.getElementById('dispenses-start-filter')._flatpickr;
        const endPicker = document.getElementById('dispenses-end-filter')._flatpickr;
        const query = document.getElementById('dispenses-search').value.trim();

        // Convert selected dates to ISO strings
        const startTime = startPicker.selectedDates[0]?.toISOString();
        const endTime = endPicker.selectedDates[0]?.toISOString();

        try {
            // Disable search button and show spinner
            const btn = document.getElementById('search-dispenses');
            btn.disabled = true;
            document.getElementById('dispenses-loading').classList.remove('d-none');

            // Base search params include current page and page size
            const searchParams = { page: Dashboard.pagination.dispenses.currentPage, limit: Dashboard.pagination.dispenses.pageSize };
            let url;

            // If any filter or query provided, build search URL
            if (startTime || endTime || query) {
                if (startTime) searchParams.start_time = startTime;
                if (endTime) searchParams.end_time = endTime;
                if (query) {
                    const parsedQuery = Dashboard.parseSearchQuery(query);
                    // Validate allowed fields for 'dispenses'
                    Dashboard.validateSearchParams('dispenses', parsedQuery);
                    Object.assign(searchParams, parsedQuery);
                }
                url = `${Dashboard.API_BASE}/erogations/search/?${new URLSearchParams(searchParams).toString()}`;
            } else {
                // No filters: fallback to full load
                return this.loadDispenses();
            }

            // Fetch and render results
            const data = await ApiService.fetchWithRetry(url);
            Dashboard.pagination.dispenses.totalItems = data.total;
            TableRenderer.renderDispenses(data.items);
            Pagination.updatePaginationControls('dispenses');
        } catch (err) {
            // Show error if search fails
            ApiService.showDetailedErrorToast(err, 'Ricerca fallita');
        } finally {
            // Re-enable button and hide spinner
            const btn = document.getElementById('search-dispenses');
            btn.disabled = false;
            document.getElementById('dispenses-loading').classList.add('d-none');
        }
    }

    /**
     * Delete all dispense records after user confirmation,
     * then clear the table and reset pagination.
     */
    static async deleteAllDispenses() {
        // Confirm destructive operation
        if (!confirm("Sei sicuro di voler eliminare TUTTE le erogazioni? L'operazione è irreversibile.")) {
            return;
        }
        try {
            // Send DELETE request to API
            const res = await fetch(`${Dashboard.API_BASE}/erogations/`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });

            // On success, clear table and reset state
            if (res.status === 204 || res.ok) {
                document.querySelector('#dispense-table tbody').innerHTML = '';
                Dashboard.pagination.dispenses.totalItems = 0;
                Pagination.updatePaginationControls('dispenses');
                Toast.showToast('Erogazioni eliminate con successo');
            } else {
                // On failure, throw error to trigger catch
                const text = await res.text();
                throw new Error(text || "Errore durante l'eliminazione delle erogazioni");
            }
        } catch (err) {
            // Log and notify user of deletion error
            console.error('Errore eliminazione erogazioni:', err);
            Toast.showToast(`Errore: ${err.message}`, 'danger');
        }
    }

    /**
     * Export all dispenses by fetching full dataset and
     * delegating to Dashboard.exportDataToCSV.
     */
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

