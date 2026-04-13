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
let _inscriptionsList = [];

async function loadInscriptions() {
  _inscriptionsList = await API.getInscriptions(_comptaTournoi);
  renderInscriptionsTable('');
}

function renderInscriptionsTable(filter) {
  const list = _inscriptionsList;
  const q = (filter || '').toLowerCase().trim();
  const filtered = q ? list.filter(i =>
    i.nom.toLowerCase().includes(q) || (i.prenom || '').toLowerCase().includes(q) || (i.club || '').toLowerCase().includes(q) || (i.classement || '').toLowerCase().includes(q)
  ) : list;

  const modes = ['Carte bancaire', 'Espèce', 'Paiement en ligne', 'Chèque'];
  const byMode = {};
  modes.forEach(m => byMode[m] = 0);
  list.forEach(i => byMode[i.mode_paiement] = (byMode[i.mode_paiement] || 0) + i.montant);
  const total = list.reduce((a, i) => a + i.montant, 0);
  const nbPaye = list.filter(i => i.montant > 0).length;

  UI.render('compta-tab-content', `
    <div class="stat-grid">
      ${modes.map(m => `<div class="stat-card"><div class="stat-label">${m}</div><div class="stat-value" style="font-size:18px;color:var(--green)">${UI.fmt(byMode[m])}</div></div>`).join('')}
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <strong>Liste des participants (${list.length}) · ${nbPaye} payé${nbPaye > 1 ? 's' : ''}</strong>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <input id="inscriptions-search" placeholder="🔍 Rechercher..." value="${UI.escHtml(q)}" oninput="renderInscriptionsTable(this.value)" style="width:160px;font-size:13px;padding:6px 10px">
          <button class="btn btn-ghost sm" onclick="showImportInscriptions()">📥 Importer XLSX</button>
          <button class="btn btn-primary sm" onclick="showAddInscription()">+ Joueur</button>
        </div>
      </div>
      ${filtered.length === 0 ? (list.length === 0 ? '<p style="color:var(--text-3)">Aucun joueur inscrit — importez un fichier XLSX ou ajoutez manuellement</p>' : '<p style="color:var(--text-3)">Aucun résultat pour "' + UI.escHtml(q) + '"</p>') : `
        <div style="overflow-x:auto">
        <table><thead><tr><th>Nom</th><th>Prénom</th><th>Classement</th><th>Club</th><th>Montant</th><th>Paiement</th><th></th></tr></thead><tbody>
        ${filtered.map(i => `<tr>
          <td style="font-weight:600">${UI.escHtml(i.nom)}</td>
          <td>${UI.escHtml(i.prenom)}</td>
          <td style="font-size:12px">${i.classement ? '<span class="badge badge-gold">' + UI.escHtml(i.classement) + '</span>' : '—'}</td>
          <td style="font-size:12px;color:var(--text-3);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${UI.escHtml(i.club || '')}">${UI.escHtml(i.club || '—')}</td>
          <td style="font-weight:700;color:${i.montant > 0 ? 'var(--green)' : 'var(--red)'}">${UI.fmt(i.montant)}</td>
          <td><select onchange="quickUpdatePaiement(${i.id},this.value)" style="font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:#fff;cursor:pointer">
            ${['Carte bancaire','Espèce','Paiement en ligne','Chèque'].map(m => `<option ${m===i.mode_paiement?'selected':''}>${m}</option>`).join('')}
          </select></td>
          <td>
            <button class="btn btn-ghost sm" onclick="showEditInscription(${i.id},'${UI.escHtml(i.nom).replace(/'/g,"\\'")}','${UI.escHtml(i.prenom).replace(/'/g,"\\'")}',${i.montant},'${i.mode_paiement}','${UI.escHtml(i.classement || '').replace(/'/g,"\\'")}','${UI.escHtml(i.club || '').replace(/'/g,"\\'")}')">✏️</button>
            <button class="btn sm" style="color:var(--red)" onclick="doDeleteInscription(${i.id})">✕</button>
          </td>
        </tr>`).join('')}
        </tbody></table>
        </div>
        ${q && filtered.length < list.length ? '<p style="font-size:12px;color:var(--text-3);margin-top:8px">' + filtered.length + ' / ' + list.length + ' joueurs affichés</p>' : ''}
      `}
      <div class="summary-bar green"><span>Total inscriptions</span><span class="val">${UI.fmt(total)}</span></div>
    </div>
  `);
  // Restore focus on search field
  if (q) {
    const el = UI.$('inscriptions-search');
    if (el) { el.focus(); el.setSelectionRange(q.length, q.length); }
  }
}

function showImportInscriptions() {
  UI.modal('📥 Importer des joueurs (XLSX)', `
    <div style="display:flex;flex-direction:column;gap:14px">
      <p style="font-size:13px;color:var(--text-2);line-height:1.5">
        Importez un fichier Excel (.xlsx) avec les colonnes :<br>
        <strong>Nom, Prénom, Classement, Club, Montant payé</strong> (colonne G)<br>
        Le fichier exporté depuis votre logiciel FFT est directement compatible.
      </p>
      <div>
        <label class="field-label">Fichier Excel</label>
        <input type="file" id="m-import-file" accept=".xlsx,.xls" style="width:100%;font-size:14px;padding:10px;border:2px dashed var(--border);border-radius:10px;cursor:pointer">
      </div>
      <div>
        <label class="field-label">Mode d'import</label>
        <div style="display:flex;gap:8px">
          <label style="flex:1;display:flex;align-items:center;gap:8px;padding:12px;border:2px solid var(--green);border-radius:10px;cursor:pointer;background:var(--green-bg)">
            <input type="radio" name="import-mode" value="sync" checked> 
            <div><strong style="font-size:13px">Synchroniser</strong><br><span style="font-size:11px;color:var(--text-3)">Met à jour les joueurs existants (nom+prénom), ajoute les nouveaux</span></div>
          </label>
          <label style="flex:1;display:flex;align-items:center;gap:8px;padding:12px;border:2px solid var(--border);border-radius:10px;cursor:pointer">
            <input type="radio" name="import-mode" value="replace"> 
            <div><strong style="font-size:13px">Remplacer tout</strong><br><span style="font-size:11px;color:var(--text-3)">Supprime tous les joueurs actuels et réimporte</span></div>
          </label>
        </div>
      </div>
      <div id="import-preview" style="display:none"></div>
      <button class="btn btn-primary" style="padding:14px;font-size:15px" onclick="doImportInscriptions()" id="btn-import" disabled>📥 Importer</button>
    </div>
  `);
  // Preview on file select
  setTimeout(() => {
    const fileInput = UI.$('m-import-file');
    if (fileInput) fileInput.addEventListener('change', previewImportFile);
  }, 50);
}

function previewImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      // Quick preview using SheetJS in browser (we'll send base64 to server for actual import)
      const data = new Uint8Array(evt.target.result);
      // Just show file info
      const sizeKB = (file.size / 1024).toFixed(1);
      UI.$('import-preview').style.display = 'block';
      UI.$('import-preview').innerHTML = `
        <div style="padding:12px;background:var(--green-bg);border-radius:8px;font-size:13px">
          ✅ <strong>${UI.escHtml(file.name)}</strong> (${sizeKB} Ko) prêt à importer
        </div>
      `;
      UI.$('btn-import').disabled = false;
    } catch (err) {
      UI.$('import-preview').style.display = 'block';
      UI.$('import-preview').innerHTML = `<div style="padding:12px;background:var(--red-bg);border-radius:8px;font-size:13px;color:var(--red)">❌ Erreur lecture: ${err.message}</div>`;
    }
  };
  reader.readAsArrayBuffer(file);
}

async function doImportInscriptions() {
  const fileInput = UI.$('m-import-file');
  const file = fileInput?.files[0];
  if (!file) { UI.toast('Sélectionnez un fichier', 'error'); return; }

  const mode = document.querySelector('input[name="import-mode"]:checked')?.value || 'sync';

  // Read as base64
  const reader = new FileReader();
  reader.onload = async function(evt) {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(evt.target.result)));
    UI.$('btn-import').disabled = true;
    UI.$('btn-import').textContent = '⏳ Import en cours...';

    try {
      const result = await API.importInscriptions(parseInt(_comptaTournoi), base64, mode);
      UI.closeModal();
      UI.toast(result.message);
      loadInscriptions();
    } catch (err) {
      UI.toast(err.message, 'error');
      UI.$('btn-import').disabled = false;
      UI.$('btn-import').textContent = '📥 Importer';
    }
  };
  reader.readAsArrayBuffer(file);
}

function showAddInscription() {
  UI.modal('Ajouter un joueur', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label class="field-label">Nom</label><input id="m-nom" style="width:100%"></div>
        <div><label class="field-label">Prénom</label><input id="m-prenom" style="width:100%"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label class="field-label">Classement</label><input id="m-classement" placeholder="ex: 15/2" style="width:100%"></div>
        <div><label class="field-label">Club</label><input id="m-club" style="width:100%"></div>
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
    await API.createInscription({ tournament_id: parseInt(_comptaTournoi), nom: UI.$('m-nom').value, prenom: UI.$('m-prenom').value, montant: parseFloat(UI.$('m-montant').value), mode_paiement: UI.$('m-mode').value, classement: UI.$('m-classement').value || null, club: UI.$('m-club').value || null });
    UI.closeModal(); UI.toast('Joueur ajouté'); loadInscriptions();
  } catch (err) { UI.toast(err.message, 'error'); }
}

function showEditInscription(id, nom, prenom, montant, mode, classement, club) {
  UI.modal('Modifier inscription', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label class="field-label">Nom</label><input id="m-nom" value="${nom}" style="width:100%"></div>
        <div><label class="field-label">Prénom</label><input id="m-prenom" value="${prenom}" style="width:100%"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label class="field-label">Classement</label><input id="m-classement" value="${classement || ''}" style="width:100%"></div>
        <div><label class="field-label">Club</label><input id="m-club" value="${club || ''}" style="width:100%"></div>
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

async function quickUpdatePaiement(id, mode) {
  try {
    await API.updateInscription(id, { mode_paiement: mode });
    // Refresh stats without full reload (silent update)
    loadInscriptions();
  } catch (err) { UI.toast(err.message, 'error'); }
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
  '1/4 finaliste homme','1/4 finaliste homme','1/4 finaliste homme','1/4 finaliste homme',
  '1/2 finaliste homme','1/2 finaliste homme',
  'Finaliste homme','Vainqueur homme',
  '1/4 finaliste femme','1/4 finaliste femme','1/4 finaliste femme','1/4 finaliste femme',
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
