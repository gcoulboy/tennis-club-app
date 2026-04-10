// ─── App Controller ───
const PAGES = [
  { section: 'GÉNÉRAL' },
  { id: 'dashboard', label: 'Tableau de bord', icon: '📊', render: renderDashboard },
  { section: 'COMPTABILITÉ' },
  { id: 'compta', label: 'Compta tournoi', icon: '📋', render: renderCompta },
  { id: 'bilan', label: 'Bilan', icon: '📈', render: renderBilan },
  { section: 'SNACK' },
  { id: 'caisse', label: 'Caisse', icon: '⚡', render: renderCaisse },
  { id: 'products', label: 'Produits', icon: '📦', render: renderProducts },
  { id: 'purchases', label: 'Achats', icon: '🛒', render: renderPurchases },
  { id: 'sales', label: 'Ventes', icon: '💰', render: renderSales },
  { section: 'ADMIN', adminOnly: true },
  { id: 'users', label: 'Utilisateurs', icon: '👥', render: renderUsers, admin: true },
];

let _currentPage = 'dashboard';

function buildNav() {
  const isAdmin = API.user?.role === 'admin';
  // Desktop sidebar
  let html = '';
  for (const p of PAGES) {
    if (p.section) {
      if (p.adminOnly && !isAdmin) continue;
      html += `<div class="nav-section">${p.section}</div>`;
    } else {
      if (p.admin && !isAdmin) continue;
      html += `<button class="nav-item ${_currentPage === p.id ? 'active' : ''}" onclick="navigateTo('${p.id}')">
        <span class="nav-icon">${p.icon}</span>${p.label}
      </button>`;
    }
  }
  UI.render('nav-menu', html);
  UI.$('user-badge').textContent = `${API.user?.full_name || ''} (${API.user?.role || ''})`;

  // Mobile nav
  const mobilePages = PAGES.filter(p => !p.section && (!p.admin || isAdmin));
  UI.render('mobile-nav', mobilePages.map(p => `
    <button class="mobile-nav-item ${_currentPage === p.id ? 'active' : ''}" onclick="navigateTo('${p.id}')">
      <span class="mnav-icon">${p.icon}</span>${p.label}
    </button>
  `).join(''));

  // Mobile header
  const mUser = UI.$('mobile-user');
  if (mUser) mUser.textContent = API.user?.full_name || '';
}

function navigateTo(pageId) {
  _currentPage = pageId;
  buildNav();
  const page = PAGES.find(p => p.id === pageId);
  if (page?.render) page.render();
}

function showMain() {
  UI.$('login-screen').classList.remove('active');
  UI.$('main-screen').classList.add('active');
  buildNav();
  navigateTo('dashboard');
}

function doLogout() {
  API.logout();
  UI.$('main-screen').classList.remove('active');
  UI.$('login-screen').classList.add('active');
  renderLogin();
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  // Logout buttons
  const logoutBtn = UI.$('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
  const mobileLogout = UI.$('mobile-logout');
  if (mobileLogout) mobileLogout.addEventListener('click', doLogout);

  if (API.token && API.user) {
    showMain();
  } else {
    UI.$('login-screen').classList.add('active');
    renderLogin();
  }
});
