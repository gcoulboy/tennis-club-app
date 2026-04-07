async function renderDashboard() {
  UI.render('content-area', `
    <div class="page-header">
      <div><div class="page-title">Tableau de bord</div>
      <div class="page-sub">Vue d'ensemble de la boutique</div></div>
    </div>
    <div class="stat-grid" id="stats-grid">
      <div class="stat-card"><div class="stat-label">Chargement…</div></div>
    </div>
    <div class="card" style="margin-top:8px">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:14px">Dernières ventes</h3>
      <div id="recent-sales"><p style="color:var(--text-3)">Chargement…</p></div>
    </div>
  `);

  try {
    const d = await API.get('/dashboard');

    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Produits actifs</div>
        <div class="stat-value green">${d.total_products}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Stock bas / vide</div>
        <div class="stat-value ${d.low_stock_count > 0 ? 'clay' : 'green'}">${d.low_stock_count}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Tournois ouverts</div>
        <div class="stat-value amber">${d.open_tournaments}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">CA total</div>
        <div class="stat-value green">${UI.fmt(d.total_revenue)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Achats total</div>
        <div class="stat-value">${UI.fmt(d.total_cost)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Marge brute</div>
        <div class="stat-value ${d.margin >= 0 ? 'green' : 'clay'}">${UI.fmt(d.margin)}</div>
      </div>
    `;

    if (d.recent_sales.length === 0) {
      document.getElementById('recent-sales').innerHTML = `
        <div class="empty-state"><div class="icon">🛒</div><p>Aucune vente enregistrée</p></div>`;
    } else {
      document.getElementById('recent-sales').innerHTML = `
        <div class="table-wrap"><table>
          <thead><tr><th>Produit</th><th>Tournoi</th><th>Qté</th><th>Montant</th><th>Date</th></tr></thead>
          <tbody>${d.recent_sales.map(s => `
            <tr>
              <td>${UI.escHtml(s.product_name)}</td>
              <td><span class="badge badge-green">${UI.escHtml(s.tournament_name)}</span></td>
              <td>${s.qty}</td>
              <td><strong>${UI.fmt(s.total_price)}</strong></td>
              <td style="color:var(--text-3);font-size:13px">${UI.fmtDate(s.sold_at)}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>`;
    }
  } catch (err) {
    UI.toast(err.message, 'error');
    document.getElementById('stats-grid').innerHTML = `
      <div style="color:var(--text-3);font-size:14px;padding:8px">
        Impossible de charger les statistiques : ${UI.escHtml(err.message)}
      </div>`;
  }
}