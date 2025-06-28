import { Toast } from "../ui/toast.js";

/**
 * ApiService provides helper methods for making HTTP requests with retry logic,
 * error parsing, and user notifications via toast messages.
 */
export class ApiService {
    /**
     * Perform a fetch request with automatic retries on failure.
     * @param {string} url - The endpoint to request.
     * @param {object} [options={}] - Fetch options (headers, method, body, etc.).
     * @param {number} [retries=3] - Number of retry attempts on network or server errors.
     * @returns {Promise<any|null>} Parsed JSON, text response, or null for HTTP 204.
     */
static async fetchWithRetry(url, options = {}, retries = 3) {
    try {
        // Execute the network request
        const response = await fetch(url, options);

        // If no content, return null
        if (response.status === 204) {
            return null;
        }

        // Determine response content type
        const contentType = response.headers.get('content-type');
        let data;

        if (contentType?.includes('application/json')) {
            try {
                // Parse JSON body
                data = await response.json();
            } catch (e) {
                // If parsing fails but status is ok, return minimal success
                if (response.ok && response.status !== 204) {
                    return { status: 'success' };
                }
                // Otherwise propagate the parsing error
                throw e;
            }
        } else {
            // Fallback to plain text
            data = await response.text();
        }

        // If HTTP error status, wrap data into Error and throw
        if (!response.ok) {
            const error = new Error(`HTTP error! status: ${response.status}`);
            error.response = { status: response.status, data };
            throw error;
        }

        // Return parsed response data
        return data;
    } catch (error) {
        // Only retry on network errors or 5xx server errors
        const shouldRetry = 
            error.message.includes('Network Error') || 
            (error.response && error.response.status >= 500);
        
        if (retries > 0 && shouldRetry) {
            // Exponential backoff: wait 2^retries * 100 ms
            const delay = Math.pow(2, retries) * 100;
            await new Promise(resolve => setTimeout(resolve, delay));
            
            return this.fetchWithRetry(url, options, retries - 1);
        }
        
        throw error;
    }
}

    /**
     * Convert an Error or response object into a user-friendly message.
     * @param {*} error - The error thrown by fetchWithRetry or other network logic.
     * @returns {string} A readable error description.
     */
    static parseAPIError(error) {
        // If the error is already a string, return as-is
        if (typeof error === 'string') return error;

        // If error contains an HTTP response
        if (error.response) {
            const { status, data } = error.response;

            // Handle validation errors (Unprocessable Entity)
            if (status === 422) {
                if (data && data.errors) {
                    // Flatten nested error arrays into a single string
                    return Object.values(data.errors)
                        .flat()
                        .join('. ');
                }
                // Fallback to a generic validation message
                return data.message || 'Validazione fallita. Controlla i tuoi input.';
            }

            // Map common HTTP status codes to localized messages
            const statusMessages = {
                400: 'Richiesta non valida',
                401: 'Effettua di nuovo il login',
                403: 'Non hai i permessi per questa operazione',
                404: 'Risorsa non trovata',
                500: 'Errore del server',
                503: 'Servizio temporaneamente non disponibile'
            };

            // Default message based on status code
            let message = statusMessages[status] || `Errore del server (${status})`;

            // If the response body contains more detailed information, extract it
            if (data) {
                if (typeof data === 'string') {
                    try {
                        const jsonData = JSON.parse(data);
                        if (jsonData.message) return jsonData.message;
                        if (jsonData.error) return jsonData.error;
                    } catch (e) {
                        // Return truncated string if too long
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

        // Network-level errors (e.g. DNS failure, connection lost)
        if (error.message && error.message.includes('Network Error')) {
            return 'Impossibile connettersi al server. Controlla la tua connessione.';
        }

        // Fallback to the error's message property or a generic notice
        return error.message || 'Si è verificato un errore imprevisto';
    }

    /**
     * Display an error via a toast notification with optional context.
     * Common database constraint messages are translated to user-friendly text.
     * @param {*} error - The raw error to display.
     * @param {string} [context=''] - Optional context to prepend to the message.
     */
    static showDetailedErrorToast(error, context = '') {
        // Parse the error into a human-readable message
        let message = this.parseAPIError(error);

        // Prepend context if provided
        if (context) {
            message = `${context}: ${message}`;
        }

        // Map specific substrings to clearer messages
        const commonErrors = {
            'violates foreign key constraint': 'Impossibile eliminare questo elemento poiché è in uso altrove',
            'duplicate key value violates unique constraint': 'Elemento già esistente',
            'network error': 'Impossibile connettersi al server',
        };

        // If message contains any known substring, override with the friendly version
        Object.entries(commonErrors).forEach(([key, value]) => {
            if (message.toLowerCase().includes(key)) {
                message = value;
            }
        });

        // Show the toast with danger styling
        Toast.showToast(message, 'danger');

        // Log original error for debugging
        console.error(context, error);
    }
}

