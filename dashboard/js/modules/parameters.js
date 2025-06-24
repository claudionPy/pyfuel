import { ApiService } from "../core/apiservice.js";
import { Toast } from "../ui/toast.js";
import { Utilities } from "../core/utils.js";

export class ParametersModule {
    static async loadParameters() {
        const loading = document.getElementById('parameters-loading');
        const btn = document.getElementById('load-parameters');

        try {
            btn.disabled = true;
            loading.classList.remove('d-none');

            const url = `${Dashboard.API_BASE}/parameters/`;
            const data = await ApiService.fetchWithRetry(url);

            this.renderFuelParameters(data.fuel_sides);
            this.renderGuiParameters(data.gui_sides);
            this.renderMainParameters(data.main_parameters);

            Toast.showToast('Parametri caricati con successo');
        } catch (err) {
            ApiService.showDetailedErrorToast(err, 'Caricamento parametri fallito');
        } finally {
            btn.disabled = false;
            loading.classList.add('d-none');
        }
    }

    static async toggleSideParameters(checkbox) {
        const side = checkbox.dataset.side;
        const type = checkbox.dataset.type;
        const isActive = checkbox.checked;

        try {
            const containerId = `${type}-side-${side}-params`;
            const container = document.getElementById(containerId);
            if (container) {
                const header = container.closest('.card')?.querySelector('.card-header');
                if (header) {
                    header.className = `card-header ${isActive ? 'bg-primary' : 'bg-secondary'} text-white`;
                }
            }

            if (isActive) {
                const url = `${Dashboard.API_BASE}/parameters/`;
                const data = await ApiService.fetchWithRetry(url);

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
                            onchange="ParametersModule.toggleSideParameters(this)">
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
                            onchange="ParametersModule.toggleSideParameters(this)">
                        <label class="form-check-label" for="gui-${side}-enabled">Lato abilitato</label>
                    </div>
                    ${this.getGuiSideParametersHtml(side, sideParams)}
                `;
                }
            } else {
                document.getElementById(containerId).innerHTML = `
                <div class="mb-3 form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="${type}-${side}-enabled"
                        ${isActive ? 'checked' : ''} data-side="${side}" data-type="${type}"
                        onchange="ParametersModule.toggleSideParameters(this)">
                    <label class="form-check-label" for="${type}-${side}-enabled">Lato abilitato</label>
                </div>
            `;
            }
        } catch (err) {
            console.error('Errore caricamento parametri lato:', err);
            checkbox.checked = false;
            Toast.showToast('Caricamento parametri lato fallito', 'danger');
        }
    }

    static renderFuelParameters(sides) {
        for (let i = 1; i <= 2; i++) {
            const sideKey = `side_${i}`;
            const container = document.getElementById(`fuel-side-${i}-params`);
            if (!container) continue;

            const side = sides[sideKey] || {};
            const isActive = side.side_exists || false;

            const headerClass = isActive ? 'bg-primary' : 'bg-secondary';
            const header = container.closest('.card')?.querySelector('.card-header');
            if (header) {
                header.className = `card-header ${headerClass} text-white`;
            }

            let html = `
            <div class="mb-3 form-check form-switch">
                <input class="form-check-input" type="checkbox" id="fuel-${i}-enabled"
                    ${isActive ? 'checked' : ''} data-side="${i}" data-type="fuel"
                    onchange="ParametersModule.toggleSideParameters(this)">
                <label class="form-check-label" for="fuel-${i}-enabled">Lato abilitato</label>
            </div>
        `;

            if (isActive) {
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

    static renderGuiParameters(sides) {
        for (let i = 1; i <= 2; i++) {
            const sideKey = `side_${i}`;
            const container = document.getElementById(`gui-side-${i}-params`);
            if (!container) continue;

            const side = sides[sideKey] || {};
            const isActive = side.side_exists || false;

            const headerClass = isActive ? 'bg-primary' : 'bg-secondary';
            const header = container.closest('.card')?.querySelector('.card-header');
            if (header) {
                header.className = `card-header ${headerClass} text-white`;
            }

            let html = `
            <div class="mb-3 form-check form-switch">
                <input class="form-check-input" type="checkbox" id="gui-${i}-enabled"
                    ${isActive ? 'checked' : ''} data-side="${i}" data-type="gui"
                    onchange="ParametersModule.toggleSideParameters(this)">
                <label class="form-check-label" for="gui-${i}-enabled">Lato abilitato</label>
            </div>
        `;

            if (isActive) {
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
            <label for="main-all_sides_selected_text" class="form-label">Etichetta tutti i lati selezionati</label>
            <input type="text" class="form-control" id="main-all_sides_selected_text"
                value="${params.all_sides_selected_text || ''}">
        </div>
        <div class="mb-3">
            <label for="main-pin_error_text" class="form-label">Etichetta PIN errato</label>
            <input type="text" class="form-control" id="main-pin_error_text"
                value="${params.pin_error_text || ''}">
        </div>
        <div class="mb-3">
            <label for="main-vehicle_not_found_text" class="form-label">Etichetta veicolo non trovato</label>
            <input type="text" class="form-control" id="main-vehicle_not_found_text"
                value="${params.vehicle_not_found_text || ''}">
        </div>
        <div class="mb-3">
            <label for="main-km_error_text" class="form-label">Etichetta KM non validi</label>
            <input type="text" class="form-control" id="main-km_error_text"
                value="${params.km_error_text || ''}">
        </div>
        <div class="mb-3">
            <label for="main-km_error_text_2" class="form-label">Etichetta KM troppo bassi</label>
            <input type="text" class="form-control" id="main-km_error_text_2"
                value="${params.km_error_text_2 || ''}">
        </div>
        <div class="mb-3">
            <label for="main-pin_keyboard_text" class="form-label">Etichetta inserimento PIN</label>
            <input type="text" class="form-control" id="main-pin_keyboard_text"
                value="${params.pin_keyboard_text || ''}">
        </div>
        <div class="mb-3">
            <label for="main-vehicle_id_text" class="form-label">Etichetta inserimento ID veicolo</label>
            <input type="text" class="form-control" id="main-vehicle_id_text"
                value="${params.vehicle_id_text || ''}">
        </div>
        <div class="mb-3">
            <label for="main-km_prompt_text" class="form-label">Etichetta inserimento KM</label>
            <input type="text" class="form-control" id="main-km_prompt_text"
                value="${params.km_prompt_text || ''}">
        </div>
        <div class="mb-3">
            <label for="main-selection_time" class="form-label">Tempo max selezione (s)</label>
            <input type="number" class="form-control" id="main-selection_time"
                value="${params.selection_time || ''}">
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

            for (let i = 1; i <= 2; i++) {
                const p = `fuel-${i}-`;
                parameters.fuel_sides[`side_${i}`] = {
                    side_exists: Utilities.safeGetChecked(`${p}enabled`),
                    pulser_pin: parseInt(Utilities.safeGetValue(`${p}pulser_pin`, 0), 10),
                    nozzle_pin: parseInt(Utilities.safeGetValue(`${p}nozzle_pin`, 0), 10),
                    relay_pin: parseInt(Utilities.safeGetValue(`${p}relay_pin`, 0), 10),
                    pulses_per_liter: parseInt(Utilities.safeGetValue(`${p}pulses_per_liter`, 0), 10),
                    price: parseFloat(Utilities.safeGetValue(`${p}price`, 0)),
                    product: Utilities.safeGetValue(`${p}product`, ''),
                    automatic_mode: Utilities.safeGetChecked(`${p}automatic_mode`),
                    relay_activation_timer: parseInt(Utilities.safeGetValue(`${p}relay_activation_timer`, 0), 10),
                    reverse_nozzle_polarity: Utilities.safeGetChecked(`${p}reverse_nozzle_polarity`),
                    timeout_reached_without_dispensing: parseInt(Utilities.safeGetValue(`${p}timeout_reached_without_dispensing`, 0), 10),
                    calibration_factor: parseFloat(Utilities.safeGetValue(`${p}calibration_factor`, 1)),
                    simulation_pulser: Utilities.safeGetChecked(`${p}simulation_pulser`)
                };
            }

            for (let i = 1; i <= 2; i++) {
                const p = `gui-${i}-`;
                parameters.gui_sides[`side_${i}`] = {
                    side_exists: Utilities.safeGetChecked(`${p}enabled`),
                    button_text: Utilities.safeGetValue(`${p}button_text`, ''),
                    button_width: parseInt(Utilities.safeGetValue(`${p}button_width`, 0), 10),
                    button_height: parseInt(Utilities.safeGetValue(`${p}button_height`, 0), 10),
                    button_color: Utilities.safeGetValue(`${p}button_color`, '#808080'),
                    button_border_color: Utilities.safeGetValue(`${p}button_border_color`, '#C0C0C0'),
                    automatic_button_color: Utilities.safeGetValue(`${p}automatic_button_color`, '#008000'),
                    automatic_button_border_color: Utilities.safeGetValue(`${p}automatic_button_border_color`, '#556B2F'),
                    busy_button_color: Utilities.safeGetValue(`${p}busy_button_color`, '#B00000'),
                    busy_button_border_color: Utilities.safeGetValue(`${p}busy_button_border_color`, '#8D0000'),
                    available_button_color: Utilities.safeGetValue(`${p}available_button_color`, '#FF8C00'),
                    available_button_border_color: Utilities.safeGetValue(`${p}available_button_border_color`, '#DAA520'),
                    button_border_width: parseInt(Utilities.safeGetValue(`${p}button_border_width`, 0), 10),
                    button_corner_radius: parseInt(Utilities.safeGetValue(`${p}button_corner_radius`, 0), 10),
                    button_relx: parseFloat(Utilities.safeGetValue(`${p}button_relx`, null)),
                    button_rely: parseFloat(Utilities.safeGetValue(`${p}button_rely`, null)),
                    preset_label: Utilities.safeGetValue(`${p}preset_label`, '')
                };
            }

            parameters.main_parameters = {
                automatic_mode_text: Utilities.safeGetValue('main-automatic_mode_text', ''),
                manual_mode_text: Utilities.safeGetValue('main-manual_mode_text', ''),
                select_side_text: Utilities.safeGetValue('main-select_side_text', ''),
                refused_card_text: Utilities.safeGetValue('main-refused_card_text', ''),
                selection_timeout_text: Utilities.safeGetValue('main-selection_timeout_text', ''),
                all_sides_selected_text: Utilities.safeGetValue('main-all_sides_selected_text', ''),
                pin_error_text: Utilities.safeGetValue('main-pin_error_text', ''),
                vehicle_not_found_text: Utilities.safeGetValue('main-vehicle_not_found_text', ''),
                km_error_text: Utilities.safeGetValue('main-km_error_text', ''),
                km_error_text_2: Utilities.safeGetValue('main-km_error_text_2', ''),
                pin_keyboard_text: Utilities.safeGetValue('main-pin_keyboard_text', ''),
                vehicle_id_text: Utilities.safeGetValue('main-vehicle_id_text', ''),
                km_prompt_text: Utilities.safeGetValue('main-km_prompt_text', ''),
                selection_time: parseInt(Utilities.safeGetValue('main-selection_time', 0), 10)
            };

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

            if (response === null) {
                await this.loadParameters();
                Toast.showToast('Parametri ripristinati ai valori predefiniti');
                return;
            }

            if (response && response.status === 'success') {
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
