function renderLogin() {
  UI.render('login-screen', `
    <div class="login-box">
      <div style="text-align:center;font-size:40px;margin-bottom:12px">🎾</div>
      <div class="login-title">Tennis Club</div>
      <div class="login-sub">Compta &amp; Snack — Connectez-vous</div>
      <div class="login-field">
        <label class="field-label">Identifiant</label>
        <input type="text" id="login-user" placeholder="admin" autocomplete="username">
      </div>
      <div class="login-field">
        <label class="field-label">Mot de passe</label>
        <input type="password" id="login-pass" placeholder="••••••" autocomplete="current-password">
      </div>
      <button class="btn btn-primary login-btn" onclick="doLogin()">Se connecter</button>
      <div id="login-error" class="login-error"></div>
    </div>
  `);
  // Enter key
  setTimeout(() => {
    const passField = UI.$('login-pass');
    if (passField) passField.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  }, 50);
}

async function doLogin() {
  const u = UI.$('login-user').value.trim();
  const p = UI.$('login-pass').value;
  if (!u || !p) { UI.$('login-error').textContent = 'Remplissez les deux champs'; return; }
  try {
    const data = await API.login(u, p);
    API.token = data.token;
    API.user = data.user;
    showMain();
  } catch (err) {
    UI.$('login-error').textContent = err.message;
  }
}
