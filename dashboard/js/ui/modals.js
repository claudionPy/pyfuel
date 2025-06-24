export class Modals {
    static showModal(modalId) {
        const modal = new bootstrap.Modal(document.getElementById(modalId));
        modal.show();
        const input = document.querySelector(`#${modalId} input`);
        if (input) input.focus();
    }

    static hideModal(modalId) {
        const modalElement = document.getElementById(modalId);
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            } else {
                new bootstrap.Modal(modalElement).hide();
            }
        }
    }
}
