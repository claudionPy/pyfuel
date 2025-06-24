import { Utilities } from "../core/utils.js";
import { Toast } from "./toast.js";

export class TableRenderer {
    static renderDispenses(data) {
        const tbody = document.querySelector('#dispense-table tbody');

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
            <td>${Utilities.formatTimestamp(item.erogation_timestamp)}</td>
        `;
            fragment.appendChild(row);
        });

        tbody.innerHTML = '';
        tbody.appendChild(fragment);
    }

    static renderVehicles(data) {
        const tbody = document.querySelector('#vehicles-table tbody');
        const fragment = document.createDocumentFragment();

        data.forEach(v => {
            const tr = document.createElement('tr');
            const vehicleId = v.vehicle_id !== undefined && v.vehicle_id !== null ? String(v.vehicle_id) : '-';
            tr.innerHTML = `
                <td>${vehicleId}</td>
                <td>${v.company_vehicle || '-'}</td>
                <td>${v.vehicle_total_km || '0'}</td>
                <td>${v.plate || '-'}</td>
                <td>${v.request_vehicle_km ? 'Sì' : 'No'}</td>
                <td>
                    <button class="btn btn-sm btn-primary me-1"
                            onclick="VehiclesModule.editVehicle('${vehicleId}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-danger"
                            onclick="VehiclesModule.deleteVehicle('${vehicleId}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            fragment.appendChild(tr);
        });

        tbody.innerHTML = '';
        tbody.appendChild(fragment);
    }

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
                            onclick="DriversModule.editDriver('${u.card}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-danger"
                            onclick="DriversModule.deleteDriver('${u.card}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            fragment.appendChild(tr);
        });

        tbody.innerHTML = '';
        tbody.appendChild(fragment);
    }

    static exportCurrentPageTable(tableId, filename) {
        try {
            const rows = Array.from(document.querySelectorAll(`#${tableId} tr`));
            const csv = rows.map(row => {
                const cols = Array.from(row.querySelectorAll('th, td'));
                return cols.map(col => `"${col.textContent.replace(/"/g, '""')}"`).join(',');
            }).join('\n');

            Dashboard.downloadCSV(csv, filename);
            Toast.showToast(`Esportazione ${filename} completata con successo`);
        } catch (error) {
            console.error('Errore esportazione:', error);
            Toast.showToast(`Errore durante l'esportazione: ${error.message}`, 'danger');
        }
    }
}
