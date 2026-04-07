async function renderProducts() {
  UI.render('content-area', `
    <div class="page-header">
      <div><div class="page-title">Produits</div>
      <div class="page-sub">Catalogue et gestion des stocks</div></div>
      ${API.isAdmin() ? '<button class="btn btn-primary" onclick="openProductModal()">+ Nouveau produit</button>' : ''}
    </div>
    <div class="toolbar">
      <div class="search-wrap">
        <input type="text" id="prod-search" placeholder="Rechercher par nom ou code-barres…" oninput="filterProducts()">
      </div>
      <select id="prod-cat" style="width:160px" onchange="filterProducts()">
        <option value="">Toutes catégories</option>
      </select>
      <label style="display:flex;align-items:center;gap:6px;font-size:14px;cursor:pointer;white-space:nowrap">
        <input type="checkbox" id="prod-low" onchange="filterProducts()"> Stock bas
      </label>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Produit</th><th>Code-barres</th><th>Catégorie</th><th>Prix</th><th>Stock</th><th></th></tr></thead>
          <tbody id="prod-body"><tr><td colspan="6" style="text-align:center;color:var(--text-3)">Chargement…</td></tr></tbody>
        </table>
      </div>
    </div>
  `);
  await loadProducts();
  await loadCategories();
}

let _allProducts = [];

async function loadProducts() {
  try {
    _allProducts = await API.get('/products');
    renderProductTable(_allProducts);
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function loadCategories() {
  try {
    const cats = await API.get('/products/categories');
    const sel = document.getElementById('prod-cat');
    if (!sel) return;
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      sel.appendChild(opt);
    });
  } catch {}
}

function filterProducts() {
  const search = document.getElementById('prod-search')?.value.toLowerCase() || '';
  const cat = document.getElementById('prod-cat')?.value || '';
  const lowOnly = document.getElementById('prod-low')?.checked || false;

  const filtered = _allProducts.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search) || (p.barcode && p.barcode.includes(search));
    const matchCat = !cat || p.category === cat;
    const matchLow = !lowOnly || p.stock_qty <= p.stock_alert;
    return matchSearch && matchCat && matchLow;
  });
  renderProductTable(filtered);
}

function renderProductTable(products) {
  const tbody = document.getElementById('prod-body');
  if (!tbody) return;
  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="icon">📦</div><p>Aucun produit trouvé</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = products.map(p => {
    const sClass = UI.stockClass(p.stock_qty, p.stock_alert);
    const stockLabel = p.stock_qty <= 0 ? '⚠️ Rupture' : p.stock_qty <= p.stock_alert ? `⚠️ ${p.stock_qty}` : p.stock_qty;
    return `<tr>
      <td><strong>${UI.escHtml(p.name)}</strong></td>
      <td class="barcode-display">${p.barcode ? `📊 ${UI.escHtml(p.barcode)}` : '<span style="color:var(--text-3)">—</span>'}</td>
      <td><span class="badge badge-gray">${UI.escHtml(p.category)}</span></td>
      <td><strong>${UI.fmt(p.unit_price)}</strong></td>
      <td class="${sClass}">${stockLabel}</td>
      <td>
        ${API.isAdmin() ? `<button class="btn btn-outline btn-sm btn-icon" onclick="openProductModal(${p.id})" title="Modifier">✏️</button>` : ''}
        <button class="btn btn-outline btn-sm btn-icon" onclick="openProductDetail(${p.id})" title="Détail">👁️</button>
      </td>
    </tr>`;
  }).join('');
}

async function openProductModal(id = null) {
  let p = null;
  if (id) {
    try { p = await API.get(`/products/${id}`); } catch {}
  }

  const CATS = ['Boisson', 'Confiserie', 'Snack', 'Barre énergétique', 'Eau', 'Autre'];

  UI.modal(
    id ? 'Modifier le produit' : 'Nouveau produit',
    `<form id="prod-form">
      <div class="form-group">
        <label>Nom du produit *</label>
        <input type="text" id="p-name" value="${UI.escHtml(p?.name || '')}" placeholder="Ex: Coca-Cola 33cl" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Code-barres</label>
          <div class="input-group">
            <input type="text" id="p-barcode" class="mono" value="${UI.escHtml(p?.barcode || '')}" placeholder="Scanner ou saisir…">
            <span class="input-suffix">📊</span>
          </div>
          <div style="font-size:12px;color:var(--text-3);margin-top:4px">Scannez avec un douchette ou la caméra</div>
        </div>
        <div class="form-group">
          <label>Catégorie</label>
          <select id="p-category">
            ${CATS.map(c => `<option value="${c}" ${(p?.category || 'Autre') === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Prix de vente (€) *</label>
          <input type="number" id="p-price" value="${p?.unit_price || ''}" min="0" step="0.10" placeholder="0.00" required>
        </div>
        <div class="form-group">
          <label>Stock initial</label>
          <input type="number" id="p-stock" value="${p?.stock_qty ?? 0}" min="0">
        </div>
      </div>
      <div class="form-group">
        <label>Seuil d'alerte stock</label>
        <input type="number" id="p-alert" value="${p?.stock_alert ?? 5}" min="0">
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
        <button type="button" class="btn btn-outline" onclick="UI.closeModal()">Annuler</button>
        ${id ? `<button type="button" class="btn btn-danger btn-sm" onclick="deleteProduct(${id})">Archiver</button>` : ''}
        <button type="submit" class="btn btn-primary">${id ? 'Enregistrer' : 'Créer'}</button>
      </div>
    </form>`
  );

  document.getElementById('prod-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('p-name').value.trim(),
      barcode: document.getElementById('p-barcode').value.trim() || null,
      category: document.getElementById('p-category').value,
      unit_price: parseFloat(document.getElementById('p-price').value),
      stock_qty: parseInt(document.getElementById('p-stock').value) || 0,
      stock_alert: parseInt(document.getElementById('p-alert').value) || 5,
    };
    try {
      if (id) await API.put(`/products/${id}`, data);
      else await API.post('/products', data);
      UI.closeModal();
      UI.toast(id ? 'Produit mis à jour' : 'Produit créé');
      await loadProducts();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  });
}

async function openProductDetail(id) {
  try {
    const p = await API.get(`/products/${id}`);
    const sClass = UI.stockClass(p.stock_qty, p.stock_alert);
    UI.modal(`Détail — ${p.name}`, `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        ${[
          ['Catégorie', `<span class="badge badge-gray">${UI.escHtml(p.category)}</span>`],
          ['Prix de vente', `<strong>${UI.fmt(p.unit_price)}</strong>`],
          ['Stock actuel', `<span class="${sClass}" style="font-size:18px;font-weight:600">${p.stock_qty}</span>`],
          ['Seuil d\'alerte', p.stock_alert],
          ['Code-barres', p.barcode ? `<span class="barcode-display">${UI.escHtml(p.barcode)}</span>` : '—'],
          ['Dernière MAJ', UI.fmtDate(p.updated_at)],
        ].map(([l,v]) => `<div><div style="font-size:12px;color:var(--text-3);margin-bottom:3px">${l}</div><div>${v}</div></div>`).join('')}
      </div>
    `);
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function deleteProduct(id) {
  UI.closeModal();
  UI.confirm('Archiver ce produit ? Il ne sera plus visible dans le catalogue.', async () => {
    try {
      await API.delete(`/products/${id}`);
      UI.toast('Produit archivé');
      await loadProducts();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  });
}

// Rendu carte mobile pour les produits
function renderProductCards(products) {
  if (!UI.isMobile()) return;
  const cards = products.length === 0
    ? `<div class="empty-state"><div class="icon">📦</div><p>Aucun produit trouvé</p></div>`
    : products.map(p => {
        const sClass = UI.stockClass(p.stock_qty, p.stock_alert);
        return `<div class="mobile-card">
          <div class="mc-title">${UI.escHtml(p.name)}</div>
          <div class="mc-row"><span>Code-barres</span><span class="mc-val barcode-display">${p.barcode || '—'}</span></div>
          <div class="mc-row"><span>Catégorie</span><span class="mc-val"><span class="badge badge-gray">${UI.escHtml(p.category)}</span></span></div>
          <div class="mc-row"><span>Prix de vente</span><span class="mc-val">${UI.fmt(p.unit_price)}</span></div>
          <div class="mc-row"><span>Stock</span><span class="mc-val ${sClass}">${p.stock_qty <= 0 ? '⚠️ Rupture' : p.stock_qty <= p.stock_alert ? '⚠️ ' + p.stock_qty : p.stock_qty}</span></div>
          <div class="mc-actions">
            ${API.isAdmin() ? `<button class="btn btn-outline btn-sm" onclick="openProductModal(${p.id})">✏️ Modifier</button>` : ''}
            <button class="btn btn-outline btn-sm" onclick="openProductDetail(${p.id})">👁️ Détail</button>
          </div>
        </div>`;
      }).join('');
  UI.renderMobileCards('content-area', cards);
}

// Patch renderProductTable pour appeler aussi les cartes
const _origRenderProductTable = renderProductTable;
window.renderProductTable = function(products) {
  _origRenderProductTable(products);
  renderProductCards(products);
};
