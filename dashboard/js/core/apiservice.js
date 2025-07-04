import { Toast } from "../ui/toast.js";

export class ApiService {
    static async fetchWithRetry(url, options = {}, retries = 3) {
        try {
            const response = await fetch(url, options);

            if (response.status === 204) {  // No Content
                return null;
            }

            const contentType = response.headers.get('content-type');
            let data;

            if (contentType?.includes('application/json')) {
                try {
                    data = await response.json();
                } catch (e) {
                    if (response.ok && response.status !== 204) {
                        return { status: 'success' };
                    }
                    throw e;
                }
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                const error = new Error(`HTTP error! status: ${response.status}`);
                error.response = { status: response.status, data };
                throw error;
            }

            return data;
        } catch (error) {
            // ... rest of error handling
        }
    }

    static parseAPIError(error) {
        if (typeof error === 'string') return error;

        if (error.response) {
            const { status, data } = error.response;

            if (status === 422) {
                if (data && data.errors) {
                    return Object.values(data.errors)
                        .flat()
                        .join('. ');
                }
                return data.message || 'Validazione fallita. Controlla i tuoi input.';
            }

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

        if (error.message && error.message.includes('Network Error')) {
            return 'Impossibile connettersi al server. Controlla la tua connessione.';
        }

        return error.message || 'Si è verificato un errore imprevisto';
    }

    static showDetailedErrorToast(error, context = '') {
        let message = this.parseAPIError(error);

        if (context) {
            message = `${context}: ${message}`;
        }

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

        Toast.showToast(message, 'danger');

        console.error(context, error);
    }
}
