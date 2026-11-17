/* ===================================================================
   Fast, non-blocking toast notifications.
   =================================================================== */

export function showToast(message, opts = {}) {
  const { type = 'info', duration = 2400, icon = null } = opts;

  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = (icon ? `<span class="toast-icon">${icon}</span>` : '') +
                 `<span class="toast-text">${message}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 300);
  }, duration);
}