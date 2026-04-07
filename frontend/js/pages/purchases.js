async function renderPurchases() {
  UI.render('content-area', `
    <div class="page-header">
      <div><div class="page-title">Achats</div>
      <div class="page-sub">Réceptions de marchandises et mise à jour du stock</div></div>
      <button class="btn btn-primary" onclick="openPurchaseModal()">+ Enregistrer un achat</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Produit</th><th>Qté</th><th>P.U. achat</th><th>Total</th><th>Fournisseur</th><th>Par</th><th>Date</th><th></th></tr></thead>
          <tbody id="purchases-body"><tr><td colspan="7" style="text-align:center;color:var(--text-3)">Chargement…</td></tr></tbody>
        </table>
      </div>
    </div>
  `);
  await loadPurchases();
}

async function loadPurchases() {
  try {
    const list = await API.get('/purchases?limit=100');
    const tbody = document.getElementById('purchases-body');
    if (!tbody) return;
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="icon">🛍️</div><p>Aucun achat enregistré</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(p => `<tr>
      <td><strong>${UI.escHtml(p.product_name)}</strong>
        ${p.barcode ? `<br><span class="barcode-display" style="font-size:11px">${UI.escHtml(p.barcode)}</span>` : ''}
      </td>
      <td>${p.qty}</td>
      <td>${UI.fmt(p.unit_cost)}</td>
      <td><strong>${UI.fmt(p.total_cost)}</strong></td>
      <td>${UI.escHtml(p.supplier) || '<span style="color:var(--text-3)">—</span>'}</td>
      <td style="font-size:13px">${UI.escHtml(p.user_name)}</td>
      <td style="color:var(--text-3);font-size:13px">${UI.fmtDate(p.purchased_at)}</td>
      <td>
        <button class="btn btn-outline btn-sm btn-icon" title="Annuler cet achat"
          onclick="deletePurchase(${p.id}, '${UI.escHtml(p.product_name)}', ${p.qty})">🗑️</button>
      </td>
    </tr>`).join('');
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function openPurchaseModal() {
  let products = [];
  try { products = await API.get('/products'); } catch {}

  UI.modal('Enregistrer un achat', `
    <form id="purchase-form">
      <div class="form-group">
        <label>Code-barres (scanner ou saisir)</label>
        <div class="input-group">
          <input type="text" id="pu-barcode" class="mono" placeholder="Scannez ou saisissez le code-barres…" oninput="lookupBarcode(this.value)">
          <span class="input-suffix">📊</span>
        </div>
      </div>
      <div class="form-group">
        <label>Produit *</label>
        <select id="pu-product" required onchange="prefillPurchasePrice()">
          <option value="">— Sélectionner —</option>
          ${products.map(p => `<option value="${p.id}" data-price="${p.unit_price}">${UI.escHtml(p.name)} (stock: ${p.stock_qty})</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Quantité achetée *</label>
          <input type="number" id="pu-qty" min="1" value="1" required>
        </div>
        <div class="form-group">
          <label>Prix unitaire d'achat (€) *</label>
          <input type="number" id="pu-cost" min="0" step="0.01" placeholder="0.00" required>
        </div>
      </div>
      <div class="form-group">
        <label>Fournisseur</label>
        <input type="text" id="pu-supplier" placeholder="Ex: Métro, Costco…">
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" id="pu-notes" placeholder="Observations…">
      </div>
      <div id="pu-total" style="background:var(--green-xpale);border-radius:8px;padding:10px 14px;font-size:14px;margin-bottom:14px;display:none">
        Total : <strong id="pu-total-val"></strong>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button type="button" class="btn btn-outline" onclick="UI.closeModal()">Annuler</button>
        <button type="submit" class="btn btn-primary">Enregistrer l'achat</button>
      </div>
    </form>
  `);

  // Live total
  ['pu-qty', 'pu-cost'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updatePurchaseTotal);
  });

  document.getElementById('purchase-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      product_id: parseInt(document.getElementById('pu-product').value),
      qty: parseInt(document.getElementById('pu-qty').value),
      unit_cost: parseFloat(document.getElementById('pu-cost').value),
      supplier: document.getElementById('pu-supplier').value.trim() || null,
      notes: document.getElementById('pu-notes').value.trim() || null,
    };
    try {
      await API.post('/purchases', data);
      UI.closeModal();
      UI.toast('Achat enregistré — stock mis à jour ✅');
      await loadPurchases();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  });
}

async function lookupBarcode(code) {
  if (code.length < 3) return;
  try {
    const p = await API.get(`/products/barcode/${encodeURIComponent(code)}`);
    const sel = document.getElementById('pu-product');
    if (sel) sel.value = p.id;
    prefillPurchasePrice();
    UI.toast(`Produit trouvé: ${p.name}`, 'success');
  } catch {}
}

function prefillPurchasePrice() {
  const sel = document.getElementById('pu-product');
  const opt = sel?.selectedOptions[0];
  if (opt?.dataset.price) {
    const cost = document.getElementById('pu-cost');
    if (cost && !cost.value) cost.value = (parseFloat(opt.dataset.price) * 0.6).toFixed(2);
    updatePurchaseTotal();
  }
}

function updatePurchaseTotal() {
  const qty = parseFloat(document.getElementById('pu-qty')?.value) || 0;
  const cost = parseFloat(document.getElementById('pu-cost')?.value) || 0;
  const total = qty * cost;
  const el = document.getElementById('pu-total');
  const val = document.getElementById('pu-total-val');
  if (el && val && total > 0) {
    el.style.display = 'block';
    val.textContent = UI.fmt(total);
  }
}

async function deletePurchase(id, productName, qty) {
  UI.confirm(
    `Annuler l'achat de <strong>${UI.escHtml(productName)}</strong> (${qty} unités) ?<br>
     <span style="color:var(--text-3);font-size:13px">Le stock sera réduit de ${qty}.</span>`,
    async () => {
      try {
        const result = await API.delete(`/purchases/${id}`);
        UI.toast(result.message || 'Achat annulé', 'success');
        await loadPurchases();
      } catch (err) {
        UI.toast(err.message, 'error');
      }
    }
  );
}

// Rendu carte mobile pour les achats
function renderPurchaseCards(list) {
  if (!UI.isMobile()) return;
  const cards = list.length === 0
    ? `<div class="empty-state"><div class="icon">🛍️</div><p>Aucun achat enregistré</p></div>`
    : list.map(p => `<div class="mobile-card">
        <div class="mc-title">${UI.escHtml(p.product_name)}</div>
        <div class="mc-row"><span>Quantité</span><span class="mc-val">${p.qty}</span></div>
        <div class="mc-row"><span>Prix unitaire</span><span class="mc-val">${UI.fmt(p.unit_cost)}</span></div>
        <div class="mc-row"><span>Total</span><span class="mc-val"><strong>${UI.fmt(p.total_cost)}</strong></span></div>
        ${p.supplier ? `<div class="mc-row"><span>Fournisseur</span><span class="mc-val">${UI.escHtml(p.supplier)}</span></div>` : ''}
        <div class="mc-row"><span>Par</span><span class="mc-val">${UI.escHtml(p.user_name)}</span></div>
        <div class="mc-row"><span>Date</span><span class="mc-val">${UI.fmtDate(p.purchased_at)}</span></div>
        <div class="mc-actions">
          <button class="btn btn-outline btn-sm" style="color:#dc2626;border-color:#dc2626"
            onclick="deletePurchase(${p.id}, '${UI.escHtml(p.product_name)}', ${p.qty})">🗑️ Annuler</button>
        </div>
      </div>`).join('');
  UI.renderMobileCards('content-area', cards);
}

const _origLoadPurchases = loadPurchases;
window.loadPurchases = async function() {
  await _origLoadPurchases();
  // Récupérer la liste et afficher les cartes
  try {
    const list = await API.get('/purchases?limit=100');
    renderPurchaseCards(list);
  } catch {}
};
