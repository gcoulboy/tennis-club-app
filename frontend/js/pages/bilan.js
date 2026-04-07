// ─── Bilan Complet ───
async function renderBilan() {
  const tournaments = await API.getTournaments();
  UI.render('content-area', `
    <div class="page-header">
      <div><div class="page-title">📊 Bilan tournoi</div><div class="page-sub">Vue complète : compta + snack</div></div>
      <select id="bilan-tournoi" onchange="loadBilan(this.value)" style="font-size:14px">
        <option value="">— Sélectionner un tournoi —</option>
        ${tournaments.map(t => `<option value="${t.id}">${UI.escHtml(t.name)} (${t.date_start})</option>`).join('')}
      </select>
    </div>
    <div id="bilan-content"></div>
  `);
}

async function loadBilan(tid) {
  if (!tid) { UI.render('bilan-content', ''); return; }
  UI.render('bilan-content', '<p>Chargement du bilan...</p>');
  try {
    const b = await API.getBilan(tid);
    const t = b.tournament;
    const partJaPct = t.part_ja || 75;

    UI.render('bilan-content', `
      <!-- En-tête tournoi -->
      <div class="card" style="margin-bottom:16px;background:linear-gradient(135deg,#2d6a4f,#0d3d24);color:#fff;border:none">
        <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center">
          <span style="font-size:32px">🎾</span>
          <div>
            <div style="font-size:20px;font-weight:800">${UI.escHtml(t.name)}</div>
            <div style="opacity:0.7;font-size:13px">
              ${t.date_start}${t.date_end ? ' → ' + t.date_end : ''}
              ${t.juge_arbitre ? ' · JA: ' + UI.escHtml(t.juge_arbitre) : ''}
              ${t.code_homologation ? ' · ' + UI.escHtml(t.code_homologation) : ''}
            </div>
          </div>
        </div>
        <div class="stat-grid" style="margin-top:16px">
          <div style="background:rgba(255,255,255,0.12);border-radius:10px;padding:14px;text-align:center;border:none">
            <div style="font-size:11px;opacity:0.6">JOUEURS</div><div style="font-size:22px;font-weight:800">${b.inscriptions.list.length}</div>
          </div>
          <div style="background:rgba(255,255,255,0.12);border-radius:10px;padding:14px;text-align:center;border:none">
            <div style="font-size:11px;opacity:0.6">RECETTES</div><div style="font-size:22px;font-weight:800">${UI.fmt(b.bilan.total_recettes)}</div>
          </div>
          <div style="background:rgba(255,255,255,0.12);border-radius:10px;padding:14px;text-align:center;border:none">
            <div style="font-size:11px;opacity:0.6">DÉPENSES</div><div style="font-size:22px;font-weight:800">${UI.fmt(b.bilan.total_depenses)}</div>
          </div>
          <div style="background:rgba(255,255,255,0.15);border-radius:10px;padding:14px;text-align:center;border:none">
            <div style="font-size:11px;opacity:0.6">BÉNÉFICE</div><div style="font-size:22px;font-weight:800">${UI.fmt(b.bilan.benefice)}</div>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <!-- Recettes -->
        <div class="card">
          <h3 style="font-size:16px;font-weight:700;margin-bottom:14px;color:var(--green)">📈 Recettes</h3>
          <div style="font-size:13px;font-weight:700;color:var(--text-3);margin-bottom:8px">INSCRIPTIONS</div>
          ${Object.entries(b.inscriptions.by_mode).map(([m, v]) => `
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f5f5f5">
              <span style="color:var(--text-2);font-size:14px">${m}</span><span style="font-weight:600">${UI.fmt(v)}</span>
            </div>
          `).join('')}
          <div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:700;color:var(--green)">
            <span>Sous-total inscriptions</span><span>${UI.fmt(b.inscriptions.total)}</span>
          </div>
          <div style="font-size:13px;font-weight:700;color:var(--text-3);margin:14px 0 8px">SNACK</div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f5f5f5">
            <span style="color:var(--text-2);font-size:14px">💵 Espèces</span><span style="font-weight:600">${UI.fmt(b.snack.especes)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f5f5f5">
            <span style="color:var(--text-2);font-size:14px">💳 CB</span><span style="font-weight:600">${UI.fmt(b.snack.cb)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:700;color:var(--green)">
            <span>Sous-total snack</span><span>${UI.fmt(b.snack.total)}</span>
          </div>
          <div class="summary-bar green"><span>Total recettes</span><span class="val">${UI.fmt(b.bilan.total_recettes)}</span></div>
        </div>

        <!-- Dépenses -->
        <div class="card">
          <h3 style="font-size:16px;font-weight:700;margin-bottom:14px;color:var(--red)">📉 Dépenses</h3>
          ${b.depenses.list.map(d => `
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f5f5f5">
              <span style="color:var(--text-2);font-size:14px">${UI.escHtml(d.label)}</span><span style="font-weight:600">${UI.fmt(d.montant)}</span>
            </div>
          `).join('')}
          ${b.depenses.list.length > 0 ? `<div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:700;color:var(--red)">
            <span>Sous-total dépenses</span><span>${UI.fmt(b.depenses.total)}</span>
          </div>` : '<p style="color:var(--text-3)">Aucune dépense</p>'}
          <div style="font-size:13px;font-weight:700;color:var(--text-3);margin:14px 0 8px">DOTATIONS</div>
          ${b.dotations.list.filter(d => d.montant > 0).map(d => `
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f5f5f5">
              <span style="font-size:14px"><span class="badge ${d.category.includes('homme') ? 'badge-blue' : 'badge-pink'}" style="font-size:10px">${UI.escHtml(d.category)}</span> ${UI.escHtml(d.nom_joueur)}</span>
              <span style="font-weight:600">${UI.fmt(d.montant)}</span>
            </div>
          `).join('')}
          ${b.dotations.total > 0 ? `<div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:700;color:var(--gold)">
            <span>Sous-total dotations</span><span>${UI.fmt(b.dotations.total)}</span>
          </div>` : ''}
          <div class="summary-bar red"><span>Total dépenses</span><span class="val">${UI.fmt(b.bilan.total_depenses)}</span></div>
        </div>
      </div>

      <!-- Bénéfice -->
      <div class="card" style="margin-top:16px;background:${b.bilan.benefice >= 0 ? 'linear-gradient(135deg,#2d6a4f,#0d3d24)' : 'linear-gradient(135deg,#c43e3e,#8b2020)'};color:#fff;border:none;text-align:center">
        <div style="font-size:13px;opacity:0.6;text-transform:uppercase;letter-spacing:1px">Bénéfice du tournoi</div>
        <div style="font-size:42px;font-weight:900;margin:8px 0">${UI.fmt(b.bilan.benefice)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px">
          <div style="background:rgba(255,255,255,0.12);border-radius:10px;padding:16px">
            <div style="font-size:12px;opacity:0.6">Part JA (${partJaPct}%) ${t.juge_arbitre ? '— ' + UI.escHtml(t.juge_arbitre) : ''}</div>
            <div style="font-size:24px;font-weight:800;margin-top:4px">${UI.fmt(b.bilan.part_ja)}</div>
          </div>
          <div style="background:rgba(255,255,255,0.12);border-radius:10px;padding:16px">
            <div style="font-size:12px;opacity:0.6">Part club (${100 - partJaPct}%)</div>
            <div style="font-size:24px;font-weight:800;margin-top:4px">${UI.fmt(b.bilan.part_club)}</div>
          </div>
        </div>
      </div>

      <!-- Détail snack -->
      ${b.snack.detail.length > 0 ? `
        <div class="card" style="margin-top:16px">
          <h3 style="font-size:16px;font-weight:700;margin-bottom:14px">🍫 Détail ventes snack</h3>
          <table><thead><tr><th>Produit</th><th>Qté vendue</th><th>CA</th><th>Paiement</th></tr></thead><tbody>
          ${b.snack.detail.map(s => `<tr>
            <td style="font-weight:600">${UI.escHtml(s.name)}</td><td>${s.qty}</td>
            <td style="font-weight:700">${UI.fmt(s.total)}</td>
            <td>${s.payment_method === 'cb' ? '<span class="badge badge-blue">💳 CB</span>' : '<span class="badge badge-gray">💵</span>'}</td>
          </tr>`).join('')}
          </tbody></table>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:14px">
            <div class="stat-card"><div class="stat-label">CA Snack</div><div class="stat-value" style="font-size:18px;color:var(--green)">${UI.fmt(b.snack.total)}</div></div>
            <div class="stat-card"><div class="stat-label">Coût marchandises</div><div class="stat-value" style="font-size:18px;color:var(--red)">${UI.fmt(b.snack.cost)}</div></div>
            <div class="stat-card"><div class="stat-label">Marge snack</div><div class="stat-value" style="font-size:18px;color:${b.snack.marge >= 0 ? 'var(--green)' : 'var(--red)'}">${UI.fmt(b.snack.marge)}</div></div>
          </div>
        </div>
      ` : ''}

      <!-- Stock actuel -->
      <div class="card" style="margin-top:16px">
        <h3 style="font-size:16px;font-weight:700;margin-bottom:14px">📦 État du stock</h3>
        <table><thead><tr><th>Produit</th><th>Stock</th><th>Alerte</th><th>Statut</th></tr></thead><tbody>
        ${b.stock.map(p => `<tr>
          <td style="font-weight:600">${UI.escHtml(p.name)}</td>
          <td>${p.stock_qty}</td><td>${p.stock_alert}</td>
          <td>${p.stock_qty <= p.stock_alert ? '<span class="badge badge-red">⚠️ Bas</span>' : '<span class="badge badge-green">OK</span>'}</td>
        </tr>`).join('')}
        </tbody></table>
      </div>
    `);
  } catch (err) { UI.render('bilan-content', `<div class="card" style="color:var(--red)">Erreur: ${err.message}</div>`); }
}
