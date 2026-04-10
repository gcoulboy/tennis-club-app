async function renderDashboard() {
  UI.render('content-area', '<div class="page-header"><div><div class="page-title">📊 Tableau de bord</div><div class="page-sub">Vue d\'ensemble</div></div></div><div id="dash-content">Chargement...</div>');
  try {
    const d = await API.getDashboard();
    const tournaments = await API.getTournaments();
    const openT = tournaments.filter(t => t.status === 'ouvert');
    UI.render('dash-content', `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">🏆 Tournois ouverts</div><div class="stat-value" style="color:var(--green)">${d.open_tournaments}</div></div>
        <div class="stat-card"><div class="stat-label">📦 Produits</div><div class="stat-value">${d.total_products}</div></div>
        <div class="stat-card"><div class="stat-label">⚠️ Stock bas</div><div class="stat-value" style="color:${d.low_stock_count > 0 ? 'var(--red)' : 'var(--green)'}">${d.low_stock_count}</div></div>
        <div class="stat-card"><div class="stat-label">💰 CA Snack</div><div class="stat-value" style="color:var(--green)">${UI.fmt(d.total_revenue)}</div></div>
        <div class="stat-card"><div class="stat-label">🛒 Coût achats</div><div class="stat-value">${UI.fmt(d.total_cost)}</div></div>
        <div class="stat-card"><div class="stat-label">📈 Marge snack</div><div class="stat-value" style="color:${d.margin >= 0 ? 'var(--green)' : 'var(--red)'}">${UI.fmt(d.margin)}</div></div>
      </div>
      ${openT.length > 0 ? `
        <div class="card">
          <h3 style="font-size:16px;font-weight:700;margin-bottom:14px">🏆 Tournois en cours</h3>
          ${openT.map(t => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f5f5f5">
              <div>
                <strong>${UI.escHtml(t.name)}</strong>
                <div style="font-size:12px;color:var(--text-3)">${t.date_start}${t.date_end ? ' → ' + t.date_end : ''} · ${t.nb_joueurs || 0} joueurs</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:13px;color:var(--text-3)">${t.nb_sales} ventes snack</div>
                <div style="font-weight:700;color:var(--green)">${UI.fmt(t.total_sales)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${d.recent_sales.length > 0 ? `
        <div class="card">
          <h3 style="font-size:16px;font-weight:700;margin-bottom:14px">🕐 Dernières ventes snack</h3>
          <table><thead><tr><th>Produit</th><th>Tournoi</th><th>Qté</th><th>Total</th><th>Paiement</th></tr></thead><tbody>
          ${d.recent_sales.map(s => `<tr>
            <td>${UI.escHtml(s.product_name)}</td><td style="font-size:12px;color:var(--text-3)">${UI.escHtml(s.tournament_name)}</td>
            <td>${s.qty}</td><td style="font-weight:600">${UI.fmt(s.total_price)}</td>
            <td>${s.payment_method === 'cb' ? '<span class="badge badge-blue">💳 CB</span>' : '<span class="badge badge-gray">💵 Espèces</span>'}</td>
          </tr>`).join('')}
          </tbody></table>
        </div>
      ` : ''}
    `);
  } catch (err) { UI.render('dash-content', `<div class="card" style="color:var(--red)">Erreur: ${err.message}</div>`); }
}
