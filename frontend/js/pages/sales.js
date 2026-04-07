async function renderSales() {
  UI.render('content-area', `
    <div class="page-header">
      <div><div class="page-title">Ventes</div>
      <div class="page-sub">Caisse par tournoi</div></div>
      <div style="display:flex;gap:10px">
        ${API.isAdmin() ? '<button class="btn btn-outline" onclick="openTournamentModal()">🏆 Tournois</button>' : ''}
        <button class="btn btn-primary" onclick="openSaleModal()">+ Enregistrer une vente</button>
      </div>
    </div>
    <div class="form-group" style="max-width:320px;margin-bottom:20px">
      <label>Filtrer par tournoi</label>
      <select id="sales-tournament" onchange="loadSales()">
        <option value="">Tous les tournois</option>
      </select>
    </div>
    <div id="sales-summary-box"></div>
    <div class="card" style="margin-top:14px">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Produit</th><th>Tournoi</th><th>Qté</th><th>P.U.</th><th>Total</th><th>Paiement</th><th>Par</th><th>Date</th><th></th></tr></thead>
          <tbody id="sales-body"><tr><td colspan="7" style="text-align:center;color:var(--text-3)">Chargement…</td></tr></tbody>
        </table>
      </div>
    </div>
  `);
  await loadTournamentFilter();
  await loadSales();
}

async function loadTournamentFilter() {
  try {
    const tournaments = await API.get('/tournaments');
    const sel = document.getElementById('sales-tournament');
    if (!sel) return;
    tournaments.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.name} (${UI.fmtDate(t.date_start)})`;
      sel.appendChild(opt);
    });
  } catch {}
}

async function loadSales() {
  const tid = document.getElementById('sales-tournament')?.value;
  const url = tid ? `/sales?tournament_id=${tid}` : '/sales?limit=100';

  // Show summary if tournament selected
  if (tid) {
    try {
      const summary = await API.get(`/sales/summary/${tid}`);
      document.getElementById('sales-summary-box').innerHTML = `
        <div class="card" style="background:var(--green-xpale);border-color:var(--green-pale)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <strong style="font-size:16px">Bilan du tournoi</strong>
            <span style="font-size:22px;font-weight:700;color:var(--green)">${UI.fmt(summary.total_revenue)}</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${summary.items.slice(0,6).map(i => `
              <div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:13px">
                <div style="font-weight:600">${UI.escHtml(i.name)}</div>
                <div style="color:var(--text-3)">${i.total_qty} vendus — ${UI.fmt(i.total_revenue)}</div>
              </div>
            `).join('')}
          </div>
          ${summary.by_payment ? summary.by_payment.map(p => `
            <div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:13px">
              <div style="font-weight:600">${p.payment_method === 'cb' ? '💳 CB' : '💵 Espèces'}</div>
              <div style="color:var(--text-3)">${p.nb} vente${p.nb > 1 ? 's' : ''} — ${UI.fmt(p.total)}</div>
            </div>
          `).join('') : ''}
        </div>
        </div>`;
    } catch {}
  } else {
    document.getElementById('sales-summary-box').innerHTML = '';
  }

  try {
    const list = await API.get(url);
    const tbody = document.getElementById('sales-body');
    if (!tbody) return;
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="icon">🛒</div><p>Aucune vente enregistrée</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(s => `<tr>
      <td><strong>${UI.escHtml(s.product_name)}</strong>
        ${s.barcode ? `<br><span class="barcode-display" style="font-size:11px">${UI.escHtml(s.barcode)}</span>` : ''}
      </td>
      <td><span class="badge badge-green">${UI.escHtml(s.tournament_name)}</span></td>
      <td>${s.qty}</td>
      <td>${UI.fmt(s.unit_price)}</td>
      <td><strong>${UI.fmt(s.total_price)}</strong></td>
      <td>${s.payment_method === 'cb'
          ? '<span class="badge badge-blue">💳 CB</span>'
          : '<span class="badge badge-gray">💵 Espèces</span>'}</td>
      <td style="font-size:13px">${UI.escHtml(s.user_name)}</td>
      <td style="color:var(--text-3);font-size:13px">${UI.fmtDate(s.sold_at)}</td>
      <td>
        <button class="btn btn-outline btn-sm btn-icon" title="Annuler cette vente"
          onclick="deleteSale(${s.id}, '${UI.escHtml(s.product_name)}', ${s.qty}, ${s.total_price})">🗑️</button>
      </td>
    </tr>`).join('');
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function openSaleModal() {
  let products = [], tournaments = [];
  try {
    [products, tournaments] = await Promise.all([API.get('/products'), API.get('/tournaments')]);
  } catch {}
  const openT = tournaments.filter(t => t.status === 'ouvert');

  UI.modal('Enregistrer une vente', `
    <form id="sale-form">
      <div class="form-group">
        <label>Code-barres (scanner ou saisir)</label>
        <div class="input-group">
          <input type="text" id="s-barcode" class="mono" placeholder="Scannez le produit…" oninput="lookupBarcodeForSale(this.value)">
          <span class="input-suffix">📊</span>
        </div>
      </div>
      <div class="form-group">
        <label>Tournoi *</label>
        <select id="s-tournament" required>
          <option value="">— Sélectionner —</option>
          ${openT.map(t => `<option value="${t.id}">${UI.escHtml(t.name)}</option>`).join('')}
        </select>
        ${openT.length === 0 ? '<div style="color:var(--clay);font-size:12px;margin-top:4px">⚠️ Aucun tournoi ouvert. Créez-en un d\'abord.</div>' : ''}
      </div>
      <div class="form-group">
        <label>Produit *</label>
        <select id="s-product" required onchange="prefillSalePrice()">
          <option value="">— Sélectionner —</option>
          ${products.map(p => `<option value="${p.id}" data-price="${p.unit_price}" data-stock="${p.stock_qty}">${UI.escHtml(p.name)} — ${UI.fmt(p.unit_price)} (stock: ${p.stock_qty})</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Quantité *</label>
          <input type="number" id="s-qty" min="1" value="1" required oninput="updateSaleTotal()">
        </div>
        <div class="form-group">
          <label>Prix unitaire (€)</label>
          <input type="number" id="s-price" min="0" step="0.10" placeholder="Prix catalogue" oninput="updateSaleTotal()">
        </div>
      </div>
      <div id="s-total" style="background:var(--green-xpale);border-radius:8px;padding:10px 14px;font-size:14px;margin-bottom:14px;display:none">
        Total : <strong id="s-total-val"></strong>
      </div>
      <div class="form-group">
        <label>Mode de paiement</label>
        <div style="display:flex;gap:8px">
          <label style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 14px;
            border:1.5px solid var(--border);border-radius:8px;cursor:pointer;font-weight:400">
            <input type="radio" name="s-payment" value="especes" checked style="width:auto"> 💵 Espèces
          </label>
          <label style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 14px;
            border:1.5px solid var(--border);border-radius:8px;cursor:pointer;font-weight:400">
            <input type="radio" name="s-payment" value="cb" style="width:auto"> 💳 CB
          </label>
        </div>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button type="button" class="btn btn-outline" onclick="UI.closeModal()">Annuler</button>
        <button type="submit" class="btn btn-clay">Enregistrer la vente</button>
      </div>
    </form>
  `);

  document.getElementById('sale-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const qty = parseInt(document.getElementById('s-qty').value);
    const sel = document.getElementById('s-product');
    const stock = parseInt(sel.selectedOptions[0]?.dataset.stock || '0');
    if (qty > stock) {
      UI.toast(`Stock insuffisant (disponible: ${stock})`, 'error'); return;
    }
    const payment = document.querySelector('input[name="s-payment"]:checked')?.value || 'especes';
    const data = {
      tournament_id: parseInt(document.getElementById('s-tournament').value),
      product_id: parseInt(sel.value),
      qty,
      unit_price: parseFloat(document.getElementById('s-price').value) || undefined,
      payment_method: payment,
    };
    try {
      const result = await API.post('/sales', data);
      UI.closeModal();
      UI.toast(`Vente enregistrée — stock restant: ${result.remaining_stock} ✅`);
      await loadSales();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  });
}

async function lookupBarcodeForSale(code) {
  if (code.length < 3) return;
  try {
    const p = await API.get(`/products/barcode/${encodeURIComponent(code)}`);
    const sel = document.getElementById('s-product');
    if (sel) sel.value = p.id;
    prefillSalePrice();
    UI.toast(`Produit: ${p.name}`, 'success');
  } catch {}
}

function prefillSalePrice() {
  const sel = document.getElementById('s-product');
  const opt = sel?.selectedOptions[0];
  if (opt?.dataset.price) {
    const priceInput = document.getElementById('s-price');
    if (priceInput) priceInput.value = opt.dataset.price;
    updateSaleTotal();
  }
}

function updateSaleTotal() {
  const qty = parseFloat(document.getElementById('s-qty')?.value) || 0;
  const price = parseFloat(document.getElementById('s-price')?.value) || 0;
  const total = qty * price;
  const el = document.getElementById('s-total');
  const val = document.getElementById('s-total-val');
  if (el && val && total > 0) {
    el.style.display = 'block';
    val.textContent = UI.fmt(total);
  }
}

async function openTournamentModal() {
  let tournaments = [];
  try { tournaments = await API.get('/tournaments'); } catch {}

  UI.modal('Gestion des tournois', `
    <div style="margin-bottom:18px">
      <h4 style="font-size:14px;font-weight:600;margin-bottom:10px">Créer un tournoi</h4>
      <form id="tournament-form" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <div style="flex:1;min-width:140px">
          <label>Nom</label><input type="text" id="t-name" placeholder="Open Été 2025" required>
        </div>
        <div style="flex:1;min-width:120px">
          <label>Date début</label><input type="date" id="t-start" required>
        </div>
        <div style="flex:1;min-width:120px">
          <label>Date fin</label><input type="date" id="t-end">
        </div>
        <button type="submit" class="btn btn-primary btn-sm" style="margin-top:18px">Créer</button>
      </form>
    </div>
    <div class="table-wrap">
      <table id="tournaments-list">
        <thead><tr><th>Tournoi</th><th>Dates</th><th>CA</th><th>Statut</th><th></th></tr></thead>
        <tbody>${tournaments.map(t => `<tr>
          <td><strong>${UI.escHtml(t.name)}</strong></td>
          <td style="font-size:13px">${UI.fmtDate(t.date_start)}${t.date_end ? ' → ' + UI.fmtDate(t.date_end) : ''}</td>
          <td><strong>${UI.fmt(t.total_sales)}</strong></td>
          <td><span class="badge ${t.status === 'ouvert' ? 'badge-green' : 'badge-gray'}">${t.status}</span></td>
          <td>
            ${t.status === 'ouvert'
              ? `<button class="btn btn-outline btn-sm" onclick="closeTournament(${t.id})">Clôturer</button>`
              : `<button class="btn btn-outline btn-sm" onclick="reopenTournament(${t.id})">Rouvrir</button>`
            }
          </td>
        </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-3)">Aucun tournoi</td></tr>'}
        </tbody>
      </table>
    </div>
  `);

  document.getElementById('tournament-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await API.post('/tournaments', {
        name: document.getElementById('t-name').value.trim(),
        date_start: document.getElementById('t-start').value,
        date_end: document.getElementById('t-end').value || null,
      });
      UI.closeModal();
      UI.toast('Tournoi créé !');
      await loadTournamentFilter();
      await loadSales();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  });
}

async function closeTournament(id) {
  try {
    await API.put(`/tournaments/${id}`, { status: 'clos' });
    UI.toast('Tournoi clôturé');
    UI.closeModal();
    await renderSales();
  } catch (err) { UI.toast(err.message, 'error'); }
}

async function reopenTournament(id) {
  try {
    await API.put(`/tournaments/${id}`, { status: 'ouvert' });
    UI.toast('Tournoi rouvert');
    UI.closeModal();
    await renderSales();
  } catch (err) { UI.toast(err.message, 'error'); }
}

async function deleteSale(id, productName, qty, total) {
  UI.confirm(
    `Annuler la vente de <strong>${UI.escHtml(productName)}</strong> (${qty} unité${qty > 1 ? 's' : ''} — ${UI.fmt(total)}) ?<br>
     <span style="color:var(--text-3);font-size:13px">Le stock sera restitué de ${qty}.</span>`,
    async () => {
      try {
        const result = await API.delete(`/sales/${id}`);
        UI.toast(result.message || 'Vente annulée', 'success');
        await loadSales();
      } catch (err) {
        UI.toast(err.message, 'error');
      }
    }
  );
}

// Rendu carte mobile pour les ventes
function renderSaleCards(list) {
  if (!UI.isMobile()) return;
  const cards = list.length === 0
    ? `<div class="empty-state"><div class="icon">🛒</div><p>Aucune vente enregistrée</p></div>`
    : list.map(s => `<div class="mobile-card">
        <div class="mc-title">${UI.escHtml(s.product_name)}</div>
        <div class="mc-row"><span>Tournoi</span><span class="mc-val"><span class="badge badge-green">${UI.escHtml(s.tournament_name)}</span></span></div>
        <div class="mc-row"><span>Quantité</span><span class="mc-val">${s.qty}</span></div>
        <div class="mc-row"><span>Prix unitaire</span><span class="mc-val">${UI.fmt(s.unit_price)}</span></div>
        <div class="mc-row"><span>Total</span><span class="mc-val"><strong>${UI.fmt(s.total_price)}</strong></span></div>
        <div class="mc-row"><span>Paiement</span><span class="mc-val">${s.payment_method === 'cb' ? '💳 CB' : '💵 Espèces'}</span></div>
        <div class="mc-row"><span>Par</span><span class="mc-val">${UI.escHtml(s.user_name)}</span></div>
        <div class="mc-row"><span>Date</span><span class="mc-val">${UI.fmtDate(s.sold_at)}</span></div>
        <div class="mc-actions">
          <button class="btn btn-outline btn-sm" style="color:#dc2626;border-color:#dc2626"
            onclick="deleteSale(${s.id}, '${UI.escHtml(s.product_name)}', ${s.qty}, ${s.total_price})">🗑️ Annuler</button>
        </div>
      </div>`).join('');
  UI.renderMobileCards('content-area', cards);
}

const _origLoadSales = loadSales;
window.loadSales = async function() {
  await _origLoadSales();
  try {
    const tid = document.getElementById('sales-tournament')?.value;
    const url = tid ? `/sales?tournament_id=${tid}` : '/sales?limit=100';
    const list = await API.get(url);
    renderSaleCards(list);
  } catch {}
};
