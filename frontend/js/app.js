window.APP = (() => {
  let currentPage = 'dashboard';

  const NAV_ITEMS = [
    { id: 'dashboard',  label: 'Accueil',      icon: '📊' },
    { id: 'caisse',     label: 'Caisse',        icon: '⚡' },
    { id: 'products',   label: 'Produits',      icon: '📦' },
    { id: 'purchases',  label: 'Achats',        icon: '🛍️'  },
    { id: 'sales',      label: 'Ventes',        icon: '🛒' },
    { id: 'users',      label: 'Utilisateurs',  icon: '👥', adminOnly: true },
  ];

  const NAV_SECTIONS = {
    caisse:    'Opérations',
    products:  'Catalogue',
    purchases: null,
    sales:     null,
    users:     'Administration',
  };

  function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('main-screen').style.display  = 'none';
    renderLogin();
  }

  function showMain() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-screen').style.display  = 'flex';
  }

  function buildNav() {
    const isAdmin = API.isAdmin();
    const items = NAV_ITEMS.filter(i => !i.adminOnly || isAdmin);

    // ── Sidebar desktop ──
    let html = '';
    let lastSection = null;
    items.forEach(item => {
      const section = NAV_SECTIONS[item.id];
      if (section && section !== lastSection) {
        html += `<div class="nav-section">${section}</div>`;
        lastSection = section;
      }
      html += `<div class="nav-item ${item.id === currentPage ? 'active' : ''}" data-page="${item.id}">
        <span class="icon">${item.icon}</span>${item.label}
      </div>`;
    });
    document.getElementById('nav-menu').innerHTML = html;
    document.querySelectorAll('#nav-menu .nav-item').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.page));
    });

    // ── Barre mobile ──
    document.getElementById('mobile-nav').innerHTML = items.map(item => `
      <button class="mobile-nav-item ${item.id === currentPage ? 'active' : ''}" data-page="${item.id}">
        <span class="mnav-icon">${item.icon}</span>
        <span>${item.label}</span>
      </button>
    `).join('');
    document.querySelectorAll('.mobile-nav-item').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.page));
    });
  }

  function updateUserBadge() {
    const user = API.getUser();
    if (!user) return;
    // Desktop
    document.getElementById('user-badge').innerHTML = `
      <div class="name">${UI.escHtml(user.full_name)}</div>
      <div class="role">${user.role}</div>`;
    // Mobile
    const mu = document.getElementById('mobile-user');
    if (mu) mu.innerHTML = UI.escHtml(user.full_name);
  }

  async function navigate(page) {
    // Arrêter la caméra si on quitte la caisse
    if (currentPage === 'caisse' && page !== 'caisse') {
      if (typeof stopCamera === 'function') stopCamera();
    }
    currentPage = page;
    buildNav();
    const area = document.getElementById('content-area');
    area.style.opacity = '0';
    setTimeout(async () => {
      area.style.opacity = '1';
      switch (page) {
        case 'dashboard': await renderDashboard(); break;
        case 'caisse':    await renderCaisse();    break;
        case 'products':  await renderProducts();  break;
        case 'purchases': await renderPurchases(); break;
        case 'sales':     await renderSales();     break;
        case 'users':     await renderUsers();     break;
      }
    }, 80);
  }

  function doLogout() {
    API.clearSession();
    showLogin();
  }

  function init() {
    if (!API.hasSession()) { showLogin(); return; }

    showMain();
    updateUserBadge();
    buildNav();
    navigate('dashboard');

    document.getElementById('logout-btn').onclick = doLogout;
    const ml = document.getElementById('mobile-logout');
    if (ml) ml.onclick = doLogout;
  }

  return { init, navigate, showMain, showLogin, doLogout };
})();

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-screen').style.display  = 'none';
  document.getElementById('content-area').style.transition = 'opacity .08s';
  APP.init();
});
