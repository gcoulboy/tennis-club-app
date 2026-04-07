const UI = (() => {
  function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function modal(title, bodyHtml, onReady) {
    document.getElementById('modal-header').innerHTML =
      `${title} <button class="modal-close" onclick="UI.closeModal()">×</button>`;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-overlay').classList.remove('hidden');
    if (onReady) onReady();
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
  }

  function confirm(msg, onYes) {
    modal('Confirmation',
      `<p style="margin-bottom:20px">${msg}</p>
       <div style="display:flex;gap:10px;justify-content:flex-end">
         <button class="btn btn-outline" onclick="UI.closeModal()">Annuler</button>
         <button class="btn btn-danger" id="confirm-yes">Confirmer</button>
       </div>`
    );
    document.getElementById('confirm-yes').onclick = () => { closeModal(); onYes(); };
  }

  function render(containerId, html) {
    document.getElementById(containerId).innerHTML = html;
  }

  function fmt(n) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n ?? 0);
  }

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function stockClass(qty, alert) {
    if (qty <= 0) return 'stock-empty';
    if (qty <= alert) return 'stock-low';
    return 'stock-ok';
  }

  function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { toast, modal, closeModal, confirm, render, fmt, fmtDate, stockClass, escHtml };
})();

// Close modal when clicking outside
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) UI.closeModal();
});

// Détection mobile
function isMobile() {
  return window.innerWidth <= 768;
}

// Injecte les cartes mobiles dans .table-wrap après le <table>
function renderMobileCards(containerId, cards) {
  const wrap = document.querySelector(`#${containerId} .table-wrap`);
  if (!wrap) return;
  let div = wrap.querySelector('.mobile-cards');
  if (!div) { div = document.createElement('div'); div.className = 'mobile-cards'; wrap.appendChild(div); }
  div.innerHTML = cards;
}

Object.assign(UI, { isMobile, renderMobileCards });
