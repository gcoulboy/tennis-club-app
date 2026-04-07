async function renderSales() {
  const tournaments = await API.getTournaments();
  UI.render('content-area', `
    <div class="page-header">
      <div><div class="page-title">💰 Ventes</div><div class="page-sub">Historique des ventes snack</div></div>
      <div style="display:flex;gap:8px;align-items:center">
        <select id="sales-filter" onchange="loadSales()" style="font-size:13px">
          <option value="">Tous les tournois</option>
          ${tournaments.map(t => `<option value="${t.id}">${UI.escHtml(t.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="card" id="sales-list">Chargement...</div>
  `);
  loadSales();
}

async function loadSales() {
  const tid = UI.$('sales-filter')?.value;
  try {
    const sales = await API.getSales(tid || undefined);
    UI.render('sales-list', sales.length === 0 ? '<p style="color:var(--text-3)">Aucune vente</p>' : `
      <table><thead><tr><th>Date</th><th>Produit</th><th>Tournoi</th><th>Qté</th><th>Total</th><th>Paiement</th><th>Par</th></tr></thead><tbody>
      ${sales.map(s => `<tr>
        <td style="font-size:12px;color:var(--text-3)">${new Date(s.sold_at).toLocaleString('fr-FR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
        <td style="font-weight:600">${UI.escHtml(s.product_name)}</td>
        <td style="font-size:12px">${UI.escHtml(s.tournament_name)}</td>
        <td>${s.qty}</td><td style="font-weight:700">${UI.fmt(s.total_price)}</td>
        <td>${s.payment_method === 'cb' ? '<span class="badge badge-blue">💳 CB</span>' : '<span class="badge badge-gray">💵</span>'}</td>
        <td style="font-size:12px">${UI.escHtml(s.user_name)}</td>
      </tr>`).join('')}
      </tbody></table>
    `);
  } catch (err) { UI.render('sales-list', `<div style="color:var(--red)">${err.message}</div>`); }
}
