function renderLogin() {
  document.getElementById('login-screen').innerHTML = `
    <div class="login-box">
      <div class="login-logo">🎾</div>
      <div class="login-title">Tennis Club</div>
      <div class="login-sub">Gestion de la boutique</div>
      <div id="login-error"></div>
      <form id="login-form">
        <div class="form-group">
          <label>Identifiant</label>
          <input type="text" id="lUsername" placeholder="Votre identifiant" autocomplete="username" required>
        </div>
        <div class="form-group">
          <label>Mot de passe</label>
          <input type="password" id="lPassword" placeholder="••••••••" autocomplete="current-password" required>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;padding:10px">
          Se connecter
        </button>
      </form>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';
    const btn = e.target.querySelector('button');
    btn.textContent = 'Connexion…';
    btn.disabled = true;

    try {
      const data = await API.post('/auth/login', {
        username: document.getElementById('lUsername').value.trim(),
        password: document.getElementById('lPassword').value
      });
      API.setSession(data.token, data.user);

      // Transition vers l'application principale
      APP.showMain();
      const user = API.getUser();
      document.getElementById('user-badge').innerHTML = `
        <div class="name">${UI.escHtml(user.full_name)}</div>
        <div class="role">${user.role}</div>
      `;
      APP.navigate('dashboard');

      document.getElementById('logout-btn').onclick = () => {
        API.clearSession();
        APP.showLogin();
      };

    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.textContent = 'Se connecter';
      btn.disabled = false;
    }
  });
}
