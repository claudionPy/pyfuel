import bootstrap from 'bootstrap';

/**
 * Modals provides methods to show and hide Bootstrap modals,
 * and manage focus on their first input element.
 */
export class Modals {
    /**
     * Display a modal by its ID and set focus to its first input.
     * @param {string} modalId - The ID of the modal container element.
     */
    static showModal(modalId) {
        // Initialize Bootstrap modal instance
        const modalElement = document.getElementById(modalId);
        if (!modalElement) return;

        const modal = new bootstrap.Modal(modalElement);
        modal.show();

        // After showing, focus the first input inside the modal
        const firstInput = modalElement.querySelector('input');
        if (firstInput) firstInput.focus();
    }

    /**
     * Hide a modal by its ID. Uses existing instance if available.
     * @param {string} modalId - The ID of the modal container element.
     */
    static hideModal(modalId) {
        const modalElement = document.getElementById(modalId);
        if (!modalElement) return;

        // Try to get existing Bootstrap modal instance
        let modal = bootstrap.Modal.getInstance(modalElement);
        if (!modal) {
            // If none exists, create one to hide immediately
            modal = new bootstrap.Modal(modalElement);
        }
        modal.hide();
    }
}

