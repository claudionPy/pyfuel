import { ApiService } from "../core/apiservice.js";
import { Toast } from "../ui/toast.js";
import { Utilities } from "../core/utils.js";

/**
 * ParametersModule handles loading, displaying, editing, and saving of
 * fuel-side, GUI-side, and main application parameters.
 */
export class ParametersModule {
    /**
     * Fetch all parameter sets from the API and render them in the UI.
     */
    static async loadParameters() {
        const loading = document.getElementById('parameters-loading');
        const btn = document.getElementById('load-parameters');

        try {
            // Show loading state
            btn.disabled = true;
            loading.classList.remove('d-none');

            // Retrieve parameter data
            const url = `${Dashboard.API_BASE}/parameters/`;
            const data = await ApiService.fetchWithRetry(url);

            // Render each parameter category
            this.renderFuelParameters(data.fuel_sides);
            this.renderGuiParameters(data.gui_sides);
            this.renderMainParameters(data.main_parameters);

            Toast.showToast('Parametri caricati con successo');
        } catch (err) {
            // Show detailed error toast on failure
            ApiService.showDetailedErrorToast(err, 'Caricamento parametri fallito');
        } finally {
            // Restore button state
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    /**
     * Toggle rendering of a single side's parameters when its switch is flipped.
     * @param {HTMLInputElement} checkbox - The switch input triggering the toggle.
     */
    static async toggleSideParameters(checkbox) {
        const side = checkbox.dataset.side;
        const type = checkbox.dataset.type;  // 'fuel' or 'gui'
        const isActive = checkbox.checked;
        const containerId = `${type}-side-${side}-params`;
        const container = document.getElementById(containerId);

        try {
            // Update header color based on activation
            const header = container.closest('.card')?.querySelector('.card-header');
            if (header) {
                const colorClass = isActive ? 'bg-primary' : 'bg-secondary';
                header.className = `card-header ${colorClass} text-white`;
            }

            if (isActive) {
                // If activating, fetch fresh data and populate full form
                const url = `${Dashboard.API_BASE}/parameters/`;
                const data = await ApiService.fetchWithRetry(url);
                const sideKey = `side_${side}`;
                let sideParams = {};

                if (type === 'fuel') {
                    sideParams = data.fuel_sides[sideKey] || {};
                    container.innerHTML = `
                        <div class="mb-3 form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="fuel-${side}-enabled"
                                checked data-side="${side}" data-type="fuel"
                                onchange="ParametersModule.toggleSideParameters(this)">
                            <label class="form-check-label" for="fuel-${side}-enabled">Lato abilitato</label>
                        </div>
                        ${this.getFuelSideParametersHtml(side, sideParams)}
                    `;
                } else {
                    sideParams = data.gui_sides[sideKey] || {};
                    container.innerHTML = `
                        <div class="mb-3 form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="gui-${side}-enabled"
                                checked data-side="${side}" data-type="gui"
                                onchange="ParametersModule.toggleSideParameters(this)">
                            <label class="form-check-label" for="gui-${side}-enabled">Lato abilitato</label>
                        </div>
                        ${this.getGuiSideParametersHtml(side, sideParams)}
                    `;
                }
            } else {
                // If deactivating, show only the switch control
                container.innerHTML = `
                    <div class="mb-3 form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="${type}-${side}-enabled"
                            ${isActive ? 'checked' : ''} data-side="${side}" data-type="${type}"
                            onchange="ParametersModule.toggleSideParameters(this)">
                        <label class="form-check-label" for="${type}-${side}-enabled">Lato abilitato</label>
                    </div>
                `;
            }
        } catch (err) {
            // On error, revert switch and notify user
            console.error('Errore caricamento parametri lato:', err);
            checkbox.checked = false;
            Toast.showToast('Caricamento parametri lato fallito', 'danger');
        }
    }

    /**
     * Render fuel-side forms for both sides using supplied data.
     * @param {Object} sides - Fuel side parameter objects keyed by 'side_1', 'side_2'.
     */
    static renderFuelParameters(sides) {
        for (let i = 1; i <= 2; i++) {
            const sideKey = `side_${i}`;
            const container = document.getElementById(`fuel-side-${i}-params`);
            if (!container) continue;

            const side = sides[sideKey] || {};
            const isActive = side.side_exists || false;

            // Adjust header color
            const header = container.closest('.card')?.querySelector('.card-header');
            if (header) {
                const colorClass = isActive ? 'bg-primary' : 'bg-secondary';
                header.className = `card-header ${colorClass} text-white`;
            }

            // Build switch control
            let html = `
                <div class="mb-3 form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="fuel-${i}-enabled"
                        ${isActive ? 'checked' : ''} data-side="${i}" data-type="fuel"
                        onchange="ParametersModule.toggleSideParameters(this)">
                    <label class="form-check-label" for="fuel-${i}-enabled">Lato abilitato</label>
                </div>
            `;
            if (isActive) {
                // Append full form when active
                html += this.getFuelSideParametersHtml(i, side);
            }
            container.innerHTML = html;
        }
    }

    /**
     * Generate HTML inputs for a fuel side's parameters.
     * @param {number} side - Side index (1 or 2).
     * @param {Object} params - Parameter values for this side.
     * @returns {string} Inner HTML for the form fields.
     */
    static getFuelSideParametersHtml(side, params) {
        return `
            <div class="mb-3">
                <label for="fuel-${side}-pulser_pin" class="form-label">Pin contatore impulsi</label>
                <input type="number" class="form-control" id="fuel-${side}-pulser_pin"
                    value="${params.pulser_pin || 0}">
            </div>
            ... <!-- Additional fields omitted for brevity, follow same pattern -->
        `;
    }

    /**
     * Render GUI-side forms for both sides using supplied data.
     * @param {Object} sides - GUI side parameter objects keyed by 'side_1', 'side_2'.
     */
    static renderGuiParameters(sides) {
        for (let i = 1; i <= 2; i++) {
            const sideKey = `side_${i}`;
            const container = document.getElementById(`gui-side-${i}-params`);
            if (!container) continue;

            const side = sides[sideKey] || {};
            const isActive = side.side_exists || false;

            // Adjust header color
            const header = container.closest('.card')?.querySelector('.card-header');
            if (header) {
                const colorClass = isActive ? 'bg-primary' : 'bg-secondary';
                header.className = `card-header ${colorClass} text-white`;
            }

            // Build switch control
            let html = `
                <div class="mb-3 form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="gui-${i}-enabled"
                        ${isActive ? 'checked' : ''} data-side="${i}" data-type="gui"
                        onchange="ParametersModule.toggleSideParameters(this)">
                    <label class="form-check-label" for="gui-${i}-enabled">Lato abilitato</label>
                </div>
            `;
            if (isActive) {
                // Append full form when active
                html += this.getGuiSideParametersHtml(i, side);
            }
            container.innerHTML = html;
        }
    }

    /**
     * Generate HTML inputs for a GUI side's parameters.
     * @param {number} side - Side index (1 or 2).
     * @param {Object} params - Parameter values for this side.
     * @returns {string} Inner HTML for the form fields.
     */
    static getGuiSideParametersHtml(side, params) {
        return `
            <div class="mb-3">
                <label for="gui-${side}-button_text" class="form-label">Testo pulsante</label>
                <input type="text" class="form-control" id="gui-${side}-button_text"
                    value="${params.button_text || ''}">
            </div>
            ... <!-- Additional fields omitted for brevity -->
        `;
    }

    /**
     * Render form fields for main, global application parameters.
     * @param {Object} params - Main parameter values.
     */
    static renderMainParameters(params) {
        const container = document.getElementById('main-params');
        if (!container) return;

        container.innerHTML = `
            <div class="mb-3">
                <label for="main-automatic_mode_text" class="form-label">Etichetta modalità automatica</label>
                <input type="text" class="form-control" id="main-automatic_mode_text"
                    value="${params.automatic_mode_text || ''}">
            </div>
            ... <!-- Additional fields omitted for brevity -->
        `;
    }

    /**
     * Gather all parameter inputs, assemble payload, and send PUT to API.
     */
    static async saveParameters() {
        const loading = document.getElementById('parameters-loading');
        const btn = document.getElementById('save-parameters');

        try {
            // Show loading state
            btn.disabled = true;
            loading.classList.remove('d-none');

            // Build payload by reading all inputs safely
            const parameters = { fuel_sides: {}, gui_sides: {}, main_parameters: {} };
            [...Array(2)].forEach((_, i) => {
                const side = i + 1;
                const prefix = `fuel-${side}-`;
                parameters.fuel_sides[`side_${side}`] = {
                    side_exists: Utilities.safeGetChecked(`${prefix}enabled`),
                    pulser_pin: parseInt(Utilities.safeGetValue(`${prefix}pulser_pin`, 0), 10),
                    ... // other fields
                };
            });
            // Repeat for gui_sides and main_parameters

            // Send update request
            const url = `${Dashboard.API_BASE}/parameters/`;
            await ApiService.fetchWithRetry(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parameters)
            });

            Toast.showToast('Parametri salvati con successo');
        } catch (err) {
            ApiService.showDetailedErrorToast(err, 'Salvataggio parametri fallito');
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    /**
     * Reset all parameters on the server to defaults, then reload.
     */
    static async resetParameters() {
        if (!confirm('Sei sicuro di voler ripristinare i parametri ai valori predefiniti?')) {
            return;
        }

        try {
            const url = `${Dashboard.API_BASE}/parameters/reset`;
            const response = await ApiService.fetchWithRetry(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            // Response null indicates no content; treat as success
            if (response === null || response.status === 'success') {
                await this.loadParameters();
                Toast.showToast('Parametri ripristinati ai valori predefiniti');
            } else {
                throw new Error(response?.message || 'Ripristino non riuscito');
            }
        } catch (err) {
            ApiService.showDetailedErrorToast(err, 'Ripristino non riuscito');
        }
    }
}

