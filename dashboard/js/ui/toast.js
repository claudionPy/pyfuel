export class Toast {
    static showToast(message, type = 'success') {
        const toastEl = document.getElementById('toast');
        const toastBody = toastEl.querySelector('.toast-body');

        toastEl.style.maxWidth = message.length > 100 ? '400px' : '350px';

        toastEl.className = `toast align-items-center text-white bg-${type}`;
        toastBody.textContent = message;

        const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
        toast.show();

        const duration = Math.min(10000, Math.max(3000, message.length * 50));
        setTimeout(() => toast.hide(), duration);
    }
}
