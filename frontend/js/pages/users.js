async function renderUsers() {
  UI.render('content-area', `
    <div class="page-header">
      <div><div class="page-title">👥 Utilisateurs</div><div class="page-sub">Gestion des comptes</div></div>
      <button class="btn btn-primary" onclick="showAddUser()">+ Ajouter</button>
    </div>
    <div class="card" id="users-list">Chargement...</div>
  `);
  try {
    const users = await API.getUsers();
    UI.render('users-list', `<table><thead><tr><th>Nom</th><th>Identifiant</th><th>Rôle</th><th>Statut</th><th></th></tr></thead><tbody>
      ${users.map(u => `<tr>
        <td style="font-weight:600">${UI.escHtml(u.full_name)}</td>
        <td><code style="font-family:var(--mono);font-size:13px">${UI.escHtml(u.username)}</code></td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-green' : 'badge-blue'}">${u.role}</span></td>
        <td>${u.active ? '<span class="badge badge-green">Actif</span>' : '<span class="badge badge-red">Inactif</span>'}</td>
        <td><button class="btn btn-ghost sm" onclick="showEditUser(${u.id},'${UI.escHtml(u.full_name)}','${u.role}',${u.active})">Modifier</button></td>
      </tr>`).join('')}
    </tbody></table>`);
  } catch (err) { UI.render('users-list', `<div style="color:var(--red)">Erreur: ${err.message}</div>`); }
}

function showAddUser() {
  UI.modal('Nouvel utilisateur', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div><label class="field-label">Identifiant</label><input id="m-user" style="width:100%"></div>
      <div><label class="field-label">Nom complet</label><input id="m-name" style="width:100%"></div>
      <div><label class="field-label">Mot de passe</label><input type="password" id="m-pass" style="width:100%"></div>
      <div><label class="field-label">Rôle</label><select id="m-role" style="width:100%"><option value="caissier">Caissier</option><option value="admin">Admin</option></select></div>
      <button class="btn btn-primary" onclick="doAddUser()">Créer</button>
    </div>
  `);
}

async function doAddUser() {
  try {
    await API.createUser({ username: UI.$('m-user').value, full_name: UI.$('m-name').value, password: UI.$('m-pass').value, role: UI.$('m-role').value });
    UI.closeModal(); UI.toast('Utilisateur créé'); renderUsers();
  } catch (err) { UI.toast(err.message, 'error'); }
}

function showEditUser(id, name, role, active) {
  UI.modal('Modifier utilisateur', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div><label class="field-label">Nom complet</label><input id="m-name" value="${UI.escHtml(name)}" style="width:100%"></div>
      <div><label class="field-label">Rôle</label><select id="m-role" style="width:100%"><option value="caissier" ${role==='caissier'?'selected':''}>Caissier</option><option value="admin" ${role==='admin'?'selected':''}>Admin</option></select></div>
      <div><label class="field-label">Statut</label><select id="m-active" style="width:100%"><option value="1" ${active?'selected':''}>Actif</option><option value="0" ${!active?'selected':''}>Inactif</option></select></div>
      <div><label class="field-label">Nouveau mot de passe (laisser vide)</label><input type="password" id="m-pass" style="width:100%"></div>
      <button class="btn btn-primary" onclick="doEditUser(${id})">Enregistrer</button>
    </div>
  `);
}

async function doEditUser(id) {
  try {
    const d = { full_name: UI.$('m-name').value, role: UI.$('m-role').value, active: parseInt(UI.$('m-active').value) };
    const p = UI.$('m-pass').value;
    if (p) d.password = p;
    await API.updateUser(id, d);
    UI.closeModal(); UI.toast('Modifié'); renderUsers();
  } catch (err) { UI.toast(err.message, 'error'); }
}
