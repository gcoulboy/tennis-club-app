async function renderUsers() {
  if (!API.isAdmin()) {
    UI.render('content-area', `<div class="empty-state"><div class="icon">🔒</div><p>Accès réservé aux administrateurs</p></div>`);
    return;
  }

  UI.render('content-area', `
    <div class="page-header">
      <div><div class="page-title">Utilisateurs</div>
      <div class="page-sub">Gestion des comptes et des rôles</div></div>
      <button class="btn btn-primary" onclick="openUserModal()">+ Nouvel utilisateur</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table id="users-table">
          <thead><tr><th>Nom</th><th>Identifiant</th><th>Rôle</th><th>Statut</th><th>Créé le</th><th></th></tr></thead>
          <tbody id="users-body"><tr><td colspan="6" style="text-align:center;color:var(--text-3)">Chargement…</td></tr></tbody>
        </table>
      </div>
    </div>
  `);
  await loadUsers();
}

async function loadUsers() {
  try {
    const users = await API.get('/users');
    const me = API.getUser();
    document.getElementById('users-body').innerHTML = users.map(u => `
      <tr>
        <td><strong>${UI.escHtml(u.full_name)}</strong>${u.id === me.id ? ' <span class="badge badge-gray" style="font-size:10px">vous</span>' : ''}</td>
        <td class="barcode-display">${UI.escHtml(u.username)}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-clay' : 'badge-green'}">${u.role}</span></td>
        <td><span class="badge ${u.active ? 'badge-green' : 'badge-gray'}">${u.active ? 'Actif' : 'Inactif'}</span></td>
        <td style="color:var(--text-3);font-size:13px">${UI.fmtDate(u.created_at)}</td>
        <td>
          <button class="btn btn-outline btn-sm btn-icon" onclick="openUserModal(${u.id})" title="Modifier">✏️</button>
          ${u.id !== me.id ? `<button class="btn btn-outline btn-sm btn-icon" onclick="toggleUser(${u.id}, ${u.active})" title="${u.active ? 'Désactiver' : 'Réactiver'}">${u.active ? '🚫' : '✅'}</button>` : ''}
        </td>
      </tr>
    `).join('') || `<tr><td colspan="6"><div class="empty-state"><p>Aucun utilisateur</p></div></td></tr>`;
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function openUserModal(id = null) {
  let user = null;
  if (id) {
    try { user = (await API.get('/users')).find(u => u.id === id); } catch {}
  }

  UI.modal(
    id ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur',
    `<form id="user-form">
      <div class="form-row">
        <div class="form-group">
          <label>Nom complet *</label>
          <input type="text" id="u-fullname" value="${UI.escHtml(user?.full_name || '')}" placeholder="Jean Dupont" required>
        </div>
        <div class="form-group">
          <label>Identifiant *</label>
          <input type="text" id="u-username" value="${UI.escHtml(user?.username || '')}" placeholder="jdupont" ${id ? 'readonly style="background:#f5f5f5"' : ''} required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Rôle *</label>
          <select id="u-role">
            <option value="caissier" ${user?.role === 'caissier' ? 'selected' : ''}>Caissier</option>
            <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>Administrateur</option>
          </select>
        </div>
        <div class="form-group">
          <label>${id ? 'Nouveau mot de passe' : 'Mot de passe *'}</label>
          <input type="password" id="u-password" placeholder="${id ? 'Laisser vide pour ne pas changer' : 'Min. 6 caractères'}" ${!id ? 'required' : ''} minlength="6">
        </div>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
        <button type="button" class="btn btn-outline" onclick="UI.closeModal()">Annuler</button>
        <button type="submit" class="btn btn-primary">${id ? 'Enregistrer' : 'Créer'}</button>
      </div>
    </form>`
  );

  document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      full_name: document.getElementById('u-fullname').value.trim(),
      username: document.getElementById('u-username').value.trim(),
      role: document.getElementById('u-role').value,
    };
    const pwd = document.getElementById('u-password').value;
    if (pwd) data.password = pwd;
    if (!id) data.password = pwd;

    try {
      if (id) await API.put(`/users/${id}`, data);
      else await API.post('/users', data);
      UI.closeModal();
      UI.toast(id ? 'Utilisateur mis à jour' : 'Utilisateur créé');
      await loadUsers();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  });
}

async function toggleUser(id, currentActive) {
  const action = currentActive ? 'désactiver' : 'réactiver';
  UI.confirm(`Voulez-vous vraiment ${action} cet utilisateur ?`, async () => {
    try {
      await API.put(`/users/${id}`, { active: currentActive ? 0 : 1 });
      UI.toast(`Utilisateur ${currentActive ? 'désactivé' : 'réactivé'}`);
      await loadUsers();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  });
}

// Rendu carte mobile pour les utilisateurs
function renderUserCards(users) {
  if (!UI.isMobile()) return;
  const me = API.getUser();
  const cards = users.length === 0
    ? `<div class="empty-state"><p>Aucun utilisateur</p></div>`
    : users.map(u => `<div class="mobile-card">
        <div class="mc-title">${UI.escHtml(u.full_name)} ${u.id === me.id ? '<span class="badge badge-gray" style="font-size:10px">vous</span>' : ''}</div>
        <div class="mc-row"><span>Identifiant</span><span class="mc-val barcode-display">${UI.escHtml(u.username)}</span></div>
        <div class="mc-row"><span>Rôle</span><span class="mc-val"><span class="badge ${u.role === 'admin' ? 'badge-clay' : 'badge-green'}">${u.role}</span></span></div>
        <div class="mc-row"><span>Statut</span><span class="mc-val"><span class="badge ${u.active ? 'badge-green' : 'badge-gray'}">${u.active ? 'Actif' : 'Inactif'}</span></span></div>
        <div class="mc-actions">
          <button class="btn btn-outline btn-sm" onclick="openUserModal(${u.id})">✏️ Modifier</button>
          ${u.id !== me.id ? `<button class="btn btn-outline btn-sm" onclick="toggleUser(${u.id}, ${u.active})">${u.active ? '🚫 Désactiver' : '✅ Réactiver'}</button>` : ''}
        </div>
      </div>`).join('');
  UI.renderMobileCards('content-area', cards);
}

const _origLoadUsers = loadUsers;
window.loadUsers = async function() {
  await _origLoadUsers();
  try {
    const users = await API.get('/users');
    renderUserCards(users);
  } catch {}
};
