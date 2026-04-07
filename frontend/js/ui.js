// ─── UI Utilities ───
const UI = {
  render(id, html) { document.getElementById(id).innerHTML = html; },
  $(id) { return document.getElementById(id); },
  escHtml(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; },
  fmt(n) { return (n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }); },

  toast(msg, type = 'success') {
    const c = UI.$('toast-container');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  },

  modal(title, html) {
    UI.render('modal-header', title);
    UI.render('modal-body', html);
    UI.$('modal-overlay').classList.remove('hidden');
  },

  closeModal() {
    UI.$('modal-overlay').classList.add('hidden');
  },

  confirm(msg) { return window.confirm(msg); },
};

document.addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') UI.closeModal();
});
