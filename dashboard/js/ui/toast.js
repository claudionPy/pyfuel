/**
 * Toast provides a simple interface to display transient Bootstrap toasts
 * for user notifications, automatically sizing and timing messages.
 */
export class Toast {
    /**
     * Display a toast message with a given type and auto-hide after a duration
     * based on message length.
     * @param {string} message - Text to show inside the toast body.
     * @param {string} [type='success'] - Bootstrap contextual color (e.g. 'success', 'danger', 'warning').
     */
    static showToast(message, type = 'success') {
        // Select the toast container and its body element
        const toastEl = document.getElementById('toast');
        const toastBody = toastEl.querySelector('.toast-body');

        // Adjust max width to accommodate longer messages
        toastEl.style.maxWidth = message.length > 100 ? '400px' : '350px';

        // Apply Bootstrap classes for alignment, text color, and background
        toastEl.className = `toast align-items-center text-white bg-${type}`;
        // Set the message text
        toastBody.textContent = message;

        // Instantiate (or retrieve) the Bootstrap toast and show it
        const toastInstance = bootstrap.Toast.getOrCreateInstance(toastEl);
        toastInstance.show();

        // Calculate display duration: 50ms per character, clamped between 3s and 10s
        const duration = Math.min(10000, Math.max(3000, message.length * 50));
        // Hide the toast after the calculated duration
        setTimeout(() => toastInstance.hide(), duration);
    }
}

