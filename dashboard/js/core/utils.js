/**
 * Utilities provides common helper functions for DOM access, debouncing,
 * and timestamp formatting/normalization throughout the app.
 */
export class Utilities {
    /**
     * Safely retrieve the value of an input element by ID, with a default fallback.
     * @param {string} id - The DOM element ID to query.
     * @param {*} [def=''] - Default value to return if element is not found.
     * @returns {*} The element's value or the default.
     */
    static safeGetValue(id, def = '') {
        const el = document.getElementById(id);
        if (!el) {
            console.warn(`Elemento mancante: ${id}`);
            return def;
        }
        return el.value;
    }

    /**
     * Safely check the "checked" state of a checkbox/radio by ID, with default fallback.
     * @param {string} id - The DOM element ID to query.
     * @param {boolean} [def=false] - Default checked state if element is not found.
     * @returns {boolean} The element's checked state or the default.
     */
    static safeGetChecked(id, def = false) {
        const el = document.getElementById(id);
        if (!el) {
            console.warn(`Elemento mancante: ${id}`);
            return def;
        }
        return el.checked;
    }

    /**
     * Create a debounced version of a function, delaying its invocation.
     * @param {Function} fn - Function to debounce.
     * @param {number} delay - Delay in milliseconds.
     * @returns {Function} Debounced function.
     */
    static debounce(fn, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    /**
     * Format an ISO timestamp (with or without trailing Z) into localized string.
     * @param {string|Date|number} timestamp - Input timestamp.
     * @returns {string} Localized date-time string or '-' if invalid.
     */
    static formatTimestamp(timestamp) {
        if (!timestamp) return '-';
        try {
            const date = new Date(
                typeof timestamp === 'string' && !timestamp.endsWith('Z')
                    ? `${timestamp}Z`
                    : timestamp
            );
            if (isNaN(date)) return '-';
            return date.toLocaleString('it-IT');
        } catch {
            return '-';
        }
    }

    /**
     * Normalize various timestamp inputs into a Date object.
     * @param {string|Date|number} timestamp - Input timestamp or Date.
     * @returns {Date|null} Parsed Date or null if input is falsy.
     */
    static normalizeTimestamp(timestamp) {
        if (!timestamp) return null;

        if (timestamp instanceof Date) return timestamp;

        if (!isNaN(timestamp)) return new Date(Number(timestamp));

        if (
            typeof timestamp === 'string' &&
            !timestamp.endsWith('Z') &&
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(timestamp)
        ) {
            return new Date(timestamp + 'Z');
        }

        return new Date(timestamp);
    }
}

