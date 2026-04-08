// ─── Compta Tournoi ───
let _comptaTournoi = null, _comptaTab = 'inscriptions';

async function renderCompta() {
  const tournaments = await API.getTournaments();
  UI.render('content-area', `
    <div class="page-header">
      <div><div class="page-title">📋 Comptabilité tournoi</div><div class="page-sub">Inscriptions, dépenses, dotations</div></div>
      <div style="display:flex;gap:8px;align-items:center">
        <select id="compta-tournoi" onchange="selectComptaTournoi(this.value)" style="font-size:14px">
          <option value="">— Sélectionner un tournoi —</option>
          ${tournaments.map(t => `<option value="${t.id}">${UI.escHtml(t.name)} (${t.date_start})</option>`).join('')}
        </select>
        <button class="btn btn-primary sm" onclick="showAddTournament()">+ Tournoi</button>
      </div>
    </div>
    <div id="compta-content"></div>
  `);
  if (_comptaTournoi) { UI.$('compta-tournoi').value = _comptaTournoi; loadComptaContent(); }
}

function selectComptaTournoi(id) {
  _comptaTournoi = id || null;
  if (_comptaTournoi) loadComptaContent(); else UI.render('compta-content', '');
}

async function loadComptaContent() {
  if (!_comptaTournoi) return;
  const t = await API.getTournament(_comptaTournoi);
  UI.render('compta-content', `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;font-size:14px">
        <strong style="font-size:16px">${UI.escHtml(t.name)}</strong>
        <span class="badge ${t.status === 'ouvert' ? 'badge-green' : 'badge-red'}">${t.status}</span>
        <span>📅 ${t.date_start}${t.date_end ? ' → ' + t.date_end : ''}</span>
        ${t.juge_arbitre ? `<span>⚖️ ${UI.escHtml(t.juge_arbitre)}</span>` : ''}
        ${t.code_homologation ? `<span style="font-family:var(--mono);font-size:12px">${UI.escHtml(t.code_homologation)}</span>` : ''}
        <button class="btn btn-ghost sm" onclick="showEditTournament(${t.id})">✏️ Modifier</button>
      </div>
    </div>
    <div class="tabs">
      <button class="tab-btn ${_comptaTab==='inscriptions'?'active':''}" onclick="_comptaTab='inscriptions';loadComptaContent()">👥 Joueurs</button>
      <button class="tab-btn ${_comptaTab==='depenses'?'active':''}" onclick="_comptaTab='depenses';loadComptaContent()">💸 Dépenses</button>
      <button class="tab-btn ${_comptaTab==='dotations'?'active':''}" onclick="_comptaTab='dotations';loadComptaContent()">🏆 Dotations</button>
    </div>
    <div id="compta-tab-content">Chargement...</div>
  `);
  if (_comptaTab === 'inscriptions') loadInscriptions();
  else if (_comptaTab === 'depenses') loadDepenses();
  else loadDotations();
}

// ── INSCRIPTIONS ──
async function loadInscriptions() {
  const list = await API.getInscriptions(_comptaTournoi);
  const modes = ['Carte bancaire', 'Espèce', 'Paiement en ligne', 'Chèque'];
  const byMode = {};
  modes.forEach(m => byMode[m] = 0);
  list.forEach(i => byMode[i.mode_paiement] = (byMode[i.mode_paiement] || 0) + i.montant);
  const total = list.reduce((a, i) => a + i.montant, 0);

  UI.render('compta-tab-content', `
    <div class="stat-grid">
      ${modes.map(m => `<div class="stat-card"><div class="stat-label">${m}</div><div class="stat-value" style="font-size:18px;color:var(--green)">${UI.fmt(byMode[m])}</div></div>`).join('')}
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <strong>Liste des participants (${list.length})</strong>
        <button class="btn btn-primary sm" onclick="showAddInscription()">+ Joueur</button>
      </div>
      ${list.length === 0 ? '<p style="color:var(--text-3)">Aucun joueur inscrit</p>' : `
        <table><thead><tr><th>Nom</th><th>Prénom</th><th>Montant</th><th>Paiement</th><th></th></tr></thead><tbody>
        ${list.map(i => `<tr>
          <td style="font-weight:600">${UI.escHtml(i.nom)}</td>
          <td>${UI.escHtml(i.prenom)}</td>
          <td style="font-weight:700">${UI.fmt(i.montant)}</td>
          <td><span class="badge badge-blue">${i.mode_paiement}</span></td>
          <td>
            <button class="btn btn-ghost sm" onclick="showEditInscription(${i.id},'${UI.escHtml(i.nom)}','${UI.escHtml(i.prenom)}',${i.montant},'${i.mode_paiement}')">✏️</button>
            <button class="btn sm" style="color:var(--red)" onclick="doDeleteInscription(${i.id})">✕</button>
          </td>
        </tr>`).join('')}
        </tbody></table>
      `}
      <div class="summary-bar green"><span>Total inscriptions</span><span class="val">${UI.fmt(total)}</span></div>
    </div>
  `);
}

function showAddInscription() {
  UI.modal('Ajouter un joueur', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label class="field-label">Nom</label><input id="m-nom" style="width:100%"></div>
        <div><label class="field-label">Prénom</label><input id="m-prenom" style="width:100%"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label class="field-label">Montant (€)</label><input type="number" id="m-montant" value="50" style="width:100%"></div>
        <div><label class="field-label">Mode de paiement</label><select id="m-mode" style="width:100%">
          <option>Carte bancaire</option><option>Espèce</option><option selected>Paiement en ligne</option><option>Chèque</option>
        </select></div>
      </div>
      <button class="btn btn-primary" onclick="doAddInscription()">Ajouter</button>
    </div>
  `);
}

async function doAddInscription() {
  try {
    await API.createInscription({ tournament_id: parseInt(_comptaTournoi), nom: UI.$('m-nom').value, prenom: UI.$('m-prenom').value, montant: parseFloat(UI.$('m-montant').value), mode_paiement: UI.$('m-mode').value });
    UI.closeModal(); UI.toast('Joueur ajouté'); loadInscriptions();
  } catch (err) { UI.toast(err.message, 'error'); }
}

function showEditInscription(id, nom, prenom, montant, mode) {
  UI.modal('Modifier inscription', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label class="field-label">Nom</label><input id="m-nom" value="${nom}" style="width:100%"></div>
        <div><label class="field-label">Prénom</label><input id="m-prenom" value="${prenom}" style="width:100%"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label class="field-label">Montant (€)</label><input type="number" id="m-montant" value="${montant}" style="width:100%"></div>
        <div><label class="field-label">Mode</label><select id="m-mode" style="width:100%">
          ${['Carte bancaire','Espèce','Paiement en ligne','Chèque'].map(m => `<option ${m===mode?'selected':''}>${m}</option>`).join('')}
        </select></div>
      </div>
      <button class="btn btn-primary" onclick="doEditInscription(${id})">Enregistrer</button>
    </div>
  `);
}

async function doEditInscription(id) {
  try {
    await API.updateInscription(id, { nom: UI.$('m-nom').value, prenom: UI.$('m-prenom').value, montant: parseFloat(UI.$('m-montant').value), mode_paiement: UI.$('m-mode').value });
    UI.closeModal(); UI.toast('Modifié'); loadInscriptions();
  } catch (err) { UI.toast(err.message, 'error'); }
}

async function doDeleteInscription(id) {
  if (!UI.confirm('Supprimer ce joueur ?')) return;
  try { await API.deleteInscription(id); UI.toast('Supprimé'); loadInscriptions(); } catch (err) { UI.toast(err.message, 'error'); }
}

// ── DEPENSES ──
async function loadDepenses() {
  const list = await API.getDepenses(_comptaTournoi);
  const total = list.reduce((a, d) => a + d.montant, 0);
  UI.render('compta-tab-content', `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <strong>Dépenses</strong>
        <button class="btn btn-primary sm" onclick="showAddDepense()">+ Dépense</button>
      </div>
      ${list.length === 0 ? '<p style="color:var(--text-3)">Aucune dépense</p>' : `
        <table><thead><tr><th>Libellé</th><th>Catégorie</th><th>Montant</th><th></th></tr></thead><tbody>
        ${list.map(d => `<tr>
          <td style="font-weight:600">${UI.escHtml(d.label)}</td>
          <td><span class="badge badge-gray">${UI.escHtml(d.category)}</span></td>
          <td style="font-weight:700">${UI.fmt(d.montant)}</td>
          <td><button class="btn sm" style="color:var(--red)" onclick="doDeleteDepense(${d.id})">✕</button></td>
        </tr>`).join('')}
        </tbody></table>
      `}
      <div class="summary-bar red"><span>Total dépenses</span><span class="val">${UI.fmt(total)}</span></div>
    </div>
  `);
}

function showAddDepense() {
  UI.modal('Ajouter une dépense', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div><label class="field-label">Libellé</label><input id="m-label" style="width:100%" list="depense-presets">
        <datalist id="depense-presets"><option value="Taxe comité"><option value="Balles"><option value="Bons d'achat"><option value="Buffet finale"><option value="Stock snack"><option value="Remboursement"></datalist>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label class="field-label">Montant (€)</label><input type="number" id="m-montant" style="width:100%"></div>
        <div><label class="field-label">Catégorie</label><input id="m-cat" value="autre" style="width:100%"></div>
      </div>
      <button class="btn btn-primary" onclick="doAddDepense()">Ajouter</button>
    </div>
  `);
}

async function doAddDepense() {
  try {
    await API.createDepense({ tournament_id: parseInt(_comptaTournoi), label: UI.$('m-label').value, montant: parseFloat(UI.$('m-montant').value), category: UI.$('m-cat').value });
    UI.closeModal(); UI.toast('Dépense ajoutée'); loadDepenses();
  } catch (err) { UI.toast(err.message, 'error'); }
}

async function doDeleteDepense(id) {
  if (!UI.confirm('Supprimer ?')) return;
  try { await API.deleteDepense(id); UI.toast('Supprimé'); loadDepenses(); } catch (err) { UI.toast(err.message, 'error'); }
}

// ── DOTATIONS ──
const DOTATION_CATS = [
  '1/4 finaliste homme','1/4 finaliste homme','1/4 finaliste homme',
  '1/2 finaliste homme','1/2 finaliste homme',
  'Finaliste homme','Vainqueur homme',
  '1/4 finaliste femme','1/4 finaliste femme','1/4 finaliste femme',
  '1/2 finaliste femme','1/2 finaliste femme',
  'Finaliste femme','Vainqueur femme'
];

let _dotationsData = [];

async function loadDotations() {
  const existing = await API.getDotations(_comptaTournoi);
  _dotationsData = DOTATION_CATS.map((cat, i) => {
    const match = existing[i];
    return { category: cat, nom_joueur: match?.nom_joueur || '', montant: match?.montant || '' };
  });
  renderDotationsForm();
}

function renderDotationsForm() {
  const totalH = _dotationsData.filter(d => d.category.includes('homme')).reduce((a, d) => a + (parseFloat(d.montant) || 0), 0);
  const totalF = _dotationsData.filter(d => d.category.includes('femme')).reduce((a, d) => a + (parseFloat(d.montant) || 0), 0);

  UI.render('compta-tab-content', `
    <div class="card" style="margin-bottom:14px">
      <strong style="display:block;margin-bottom:14px">🏆 Dotations Hommes</strong>
      <table><thead><tr><th>Classement</th><th>Joueur</th><th>Montant</th></tr></thead><tbody>
      ${_dotationsData.map((d, i) => d.category.includes('homme') ? `<tr>
        <td><span class="badge badge-blue">${d.category.replace(' homme','')}</span></td>
        <td><input class="sm" value="${UI.escHtml(d.nom_joueur)}" onchange="_dotationsData[${i}].nom_joueur=this.value" style="width:100%"></td>
        <td><input class="sm" type="number" value="${d.montant}" onchange="_dotationsData[${i}].montant=this.value" style="width:80px"></td>
      </tr>` : '').join('')}
      </tbody></table>
      <div style="text-align:right;font-weight:700;color:var(--blue);margin-top:8px">Total Hommes: ${UI.fmt(totalH)}</div>
    </div>
    <div class="card" style="margin-bottom:14px">
      <strong style="display:block;margin-bottom:14px">🏆 Dotations Femmes</strong>
      <table><thead><tr><th>Classement</th><th>Joueur</th><th>Montant</th></tr></thead><tbody>
      ${_dotationsData.map((d, i) => d.category.includes('femme') ? `<tr>
        <td><span class="badge badge-pink">${d.category.replace(' femme','')}</span></td>
        <td><input class="sm" value="${UI.escHtml(d.nom_joueur)}" onchange="_dotationsData[${i}].nom_joueur=this.value" style="width:100%"></td>
        <td><input class="sm" type="number" value="${d.montant}" onchange="_dotationsData[${i}].montant=this.value" style="width:80px"></td>
      </tr>` : '').join('')}
      </tbody></table>
      <div style="text-align:right;font-weight:700;color:var(--pink);margin-top:8px">Total Femmes: ${UI.fmt(totalF)}</div>
    </div>
    <div class="summary-bar dark"><span>Total dotations</span><span class="val">${UI.fmt(totalH + totalF)}</span></div>
    <button class="btn btn-primary" style="width:100%;margin-top:14px;padding:14px" onclick="saveDotations()">💾 Enregistrer les dotations</button>
  `);
}

async function saveDotations() {
  try {
    await API.saveDotations(parseInt(_comptaTournoi), _dotationsData);
    UI.toast('Dotations enregistrées ✓');
  } catch (err) { UI.toast(err.message, 'error'); }
}

// ── TOURNAMENT CRUD ──
function showAddTournament() {
  UI.modal('Nouveau tournoi', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div><label class="field-label">Nom</label><input id="m-name" style="width:100%" placeholder="TMC HOMMES 15 à 4/6"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label class="field-label">Date début</label><input type="date" id="m-start" style="width:100%"></div>
        <div><label class="field-label">Date fin</label><input type="date" id="m-end" style="width:100%"></div>
      </div>
      <div><label class="field-label">Code homologation</label><input id="m-code" style="width:100%"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label class="field-label">Juge arbitre</label><input id="m-ja" style="width:100%"></div>
        <div><label class="field-label">Part JA (%)</label><input type="number" id="m-partja" value="75" style="width:100%"></div>
      </div>
      <button class="btn btn-primary" onclick="doAddTournament()">Créer</button>
    </div>
  `);
}

async function doAddTournament() {
  try {
    const t = await API.createTournament({ name: UI.$('m-name').value, date_start: UI.$('m-start').value, date_end: UI.$('m-end').value, code_homologation: UI.$('m-code').value, juge_arbitre: UI.$('m-ja').value, part_ja: parseFloat(UI.$('m-partja').value) });
    _comptaTournoi = t.id;
    UI.closeModal(); UI.toast('Tournoi créé'); renderCompta();
  } catch (err) { UI.toast(err.message, 'error'); }
}

async function showEditTournament(id) {
  const t = await API.getTournament(id);
  UI.modal('Modifier tournoi', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div><label class="field-label">Nom</label><input id="m-name" value="${UI.escHtml(t.name)}" style="width:100%"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label class="field-label">Date début</label><input type="date" id="m-start" value="${t.date_start}" style="width:100%"></div>
        <div><label class="field-label">Date fin</label><input type="date" id="m-end" value="${t.date_end || ''}" style="width:100%"></div>
      </div>
      <div><label class="field-label">Code homologation</label><input id="m-code" value="${t.code_homologation || ''}" style="width:100%"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label class="field-label">Juge arbitre</label><input id="m-ja" value="${t.juge_arbitre || ''}" style="width:100%"></div>
        <div><label class="field-label">Part JA (%)</label><input type="number" id="m-partja" value="${t.part_ja || 75}" style="width:100%"></div>
      </div>
      <div><label class="field-label">Statut</label><select id="m-status" style="width:100%"><option value="ouvert" ${t.status==='ouvert'?'selected':''}>Ouvert</option><option value="clos" ${t.status==='clos'?'selected':''}>Clos</option></select></div>
      <button class="btn btn-primary" onclick="doEditTournament(${id})">Enregistrer</button>
      <div style="border-top:1px solid var(--border);margin-top:8px;padding-top:12px">
        <button class="btn btn-danger" style="width:100%" onclick="doDeleteTournament(${id},'${UI.escHtml(t.name).replace(/'/g,"\\'")}')">🗑️ Supprimer ce tournoi</button>
        <p style="font-size:11px;color:var(--text-3);margin-top:6px;text-align:center">Supprime le tournoi et toutes ses données (inscriptions, dépenses, dotations, ventes snack)</p>
      </div>
    </div>
  `);
}

async function doDeleteTournament(id, name) {
  if (!UI.confirm('Supprimer le tournoi "' + name + '" et TOUTES ses données (inscriptions, dépenses, dotations, ventes) ?\n\nCette action est irréversible.')) return;
  try {
    await API.deleteTournament(id);
    _comptaTournoi = null;
    UI.closeModal();
    UI.toast('Tournoi supprimé');
    renderCompta();
  } catch (err) { UI.toast(err.message, 'error'); }
}

async function doEditTournament(id) {
  try {
    await API.updateTournament(id, { name: UI.$('m-name').value, date_start: UI.$('m-start').value, date_end: UI.$('m-end').value, code_homologation: UI.$('m-code').value, juge_arbitre: UI.$('m-ja').value, part_ja: parseFloat(UI.$('m-partja').value), status: UI.$('m-status').value });
    UI.closeModal(); UI.toast('Tournoi modifié'); loadComptaContent();
  } catch (err) { UI.toast(err.message, 'error'); }
}
