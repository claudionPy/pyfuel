export class Utilities {
    static safeGetValue(id, def = '') {
        const el = document.getElementById(id);
        if (!el) {
            console.warn(`Elemento mancante: ${id}`);
            return def;
        }
        return el.value;
    }

    static safeGetChecked(id, def = false) {
        const el = document.getElementById(id);
        if (!el) {
            console.warn(`Elemento mancante: ${id}`);
            return def;
        }
        return el.checked;
    }

    static debounce(fn, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    static formatTimestamp(timestamp) {
        if (!timestamp) return '-';
        try {
            const date = new Date(timestamp.endsWith('Z') ? timestamp : `${timestamp}Z`);
            return isNaN(date) ? '-' : date.toLocaleString('it-IT');
        } catch {
            return '-';
        }
    }

    static normalizeTimestamp(timestamp) {
        if (!timestamp) return null;

        // If it's already a Date object
        if (timestamp instanceof Date) return timestamp;

        // If it's a number (epoch time)
        if (!isNaN(timestamp)) return new Date(Number(timestamp));

        // If it's an ISO string without Z (UTC indicator)
        if (typeof timestamp === 'string' && !timestamp.endsWith('Z')) {
            // Try adding Z if it looks like an ISO string without timezone
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(timestamp)) {
                return new Date(timestamp + 'Z');
            }
        }

        // Default case - let Date constructor handle it
        return new Date(timestamp);
    }
}