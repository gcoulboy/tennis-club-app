// ─── Mode Caisse Rapide ───
let _caisseStream = null, _caisseTournoi = null, _currentProduct = null, _currentQty = 1;
let _caisseCart = [], _barcodeDetector = null, _scanLoop = null, _caissePayment = 'especes';
let _caisseProducts = [];

async function renderCaisse() {
  stopCamera();
  const tournaments = await API.getTournaments();
  const open = tournaments.filter(t => t.status === 'ouvert');

  UI.render('content-area', `
    <div class="page-header"><div><div class="page-title">⚡ Caisse rapide</div><div class="page-sub">Sélection produit &amp; vente</div></div></div>
    <div class="card" style="margin-bottom:14px">
      <label class="field-label">Tournoi</label>
      <select id="caisse-tournoi" onchange="selectTournoi(this.value)" style="width:100%;font-size:16px">
        <option value="">— Sélectionner —</option>
        ${open.map(t => `<option value="${t.id}">${UI.escHtml(t.name)}</option>`).join('')}
      </select>
    </div>
    <div id="caisse-main" style="display:none">
      <!-- Grille produits -->
      <div class="card" style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <strong>📦 Produits</strong>
          <input id="caisse-search" placeholder="🔍 Rechercher..." oninput="filterCaisseProducts(this.value)" style="width:180px;font-size:13px">
        </div>
        <div id="caisse-product-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px"></div>
      </div>

      <!-- Scanner (optionnel) -->
      <details class="card" style="margin-bottom:14px;cursor:pointer">
        <summary style="font-weight:600;font-size:14px;padding:4px 0">📷 Scanner un code-barres</summary>
        <div style="margin-top:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:13px;color:var(--text-3)">Caméra ou saisie manuelle</span>
            <button class="btn btn-primary sm" id="btn-cam" onclick="toggleCamera()">Démarrer caméra</button>
          </div>
          <video id="caisse-video" autoplay playsinline style="display:none"></video>
          <input id="barcode-manual" placeholder="Saisir code-barres + Entrée" style="width:100%;margin-top:8px" onkeydown="if(event.key==='Enter')lookupBarcode(this.value)">
        </div>
      </details>

      <!-- Produit sélectionné -->
      <div id="caisse-product" class="card" style="display:none;margin-bottom:14px"></div>

      <!-- Panier session -->
      <div id="caisse-cart-wrap" class="card" style="display:none"></div>
    </div>
  `);
  if (open.length === 1) { UI.$('caisse-tournoi').value = open[0].id; selectTournoi(open[0].id); }
}

async function selectTournoi(id) {
  _caisseTournoi = id || null;
  const main = UI.$('caisse-main');
  if (!_caisseTournoi) { if (main) main.style.display = 'none'; return; }
  if (main) main.style.display = 'block';
  try {
    _caisseProducts = await API.getProducts();
    renderProductGrid(_caisseProducts);
  } catch (err) { UI.toast('Erreur chargement produits', 'error'); }
}

function renderProductGrid(products) {
  const grid = UI.$('caisse-product-grid');
  if (!grid) return;
  if (products.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-3);grid-column:1/-1;text-align:center;padding:20px">Aucun produit trouvé</p>';
    return;
  }
  grid.innerHTML = products.map(p => `
    <button onclick="selectCaisseProduct(${p.id})" style="
      display:flex;flex-direction:column;align-items:center;gap:6px;
      padding:14px 8px;border-radius:10px;
      border:2px solid ${_currentProduct && _currentProduct.id === p.id ? 'var(--green)' : (p.stock_qty <= 0 ? '#eee' : 'var(--border)')};
      background:${_currentProduct && _currentProduct.id === p.id ? 'var(--green-bg)' : (p.stock_qty <= 0 ? '#fafafa' : '#fff')};
      cursor:${p.stock_qty <= 0 ? 'not-allowed' : 'pointer'};
      transition:all 0.15s;font-family:var(--font);
      opacity:${p.stock_qty <= 0 ? '0.4' : '1'};
    " ${p.stock_qty <= 0 ? 'disabled' : ''}>
      <span style="font-size:24px">${productEmoji(p.category)}</span>
      <span style="font-size:13px;font-weight:700;text-align:center;line-height:1.2">${UI.escHtml(p.name)}</span>
      <span style="font-size:15px;font-weight:800;color:var(--green)">${UI.fmt(p.unit_price)}</span>
      <span style="font-size:11px;color:${p.stock_qty <= p.stock_alert ? 'var(--red)' : 'var(--text-3)'};font-weight:${p.stock_qty <= p.stock_alert ? '700' : '400'}">
        ${p.stock_qty <= 0 ? '❌ Rupture' : (p.stock_qty <= p.stock_alert ? '⚠️ ' + p.stock_qty + ' restant' + (p.stock_qty > 1 ? 's' : '') : p.stock_qty + ' en stock')}
      </span>
    </button>
  `).join('');
}

function productEmoji(category) {
  const cat = (category || '').toLowerCase();
  if (cat.includes('boisson') || cat.includes('soda') || cat.includes('eau')) return '🥤';
  if (cat.includes('chocolat') || cat.includes('barre') || cat.includes('confiserie')) return '🍫';
  if (cat.includes('chips') || cat.includes('biscuit') || cat.includes('gâteau')) return '🍪';
  if (cat.includes('sandwich') || cat.includes('pain')) return '🥪';
  if (cat.includes('fruit') || cat.includes('compote')) return '🍎';
  if (cat.includes('café') || cat.includes('thé')) return '☕';
  if (cat.includes('glace')) return '🍦';
  return '🛒';
}

function filterCaisseProducts(query) {
  const q = query.toLowerCase().trim();
  if (!q) { renderProductGrid(_caisseProducts); return; }
  renderProductGrid(_caisseProducts.filter(p =>
    p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q) || (p.barcode || '').includes(q)
  ));
}

function selectCaisseProduct(productId) {
  const p = _caisseProducts.find(x => x.id === productId);
  if (!p || p.stock_qty <= 0) return;
  _currentProduct = p;
  _currentQty = 1;
  _caissePayment = 'especes';
  renderProductGrid(_caisseProducts);
  showProduct();
  setTimeout(() => {
    const el = UI.$('caisse-product');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
}

async function lookupBarcode(code) {
  if (!code) return;
  try {
    _currentProduct = await API.getProductByBarcode(code.trim());
    _currentQty = 1;
    _caissePayment = 'especes';
    renderProductGrid(_caisseProducts);
    showProduct();
  } catch { UI.toast('Produit non trouvé', 'error'); }
}

function showProduct() {
  const p = _currentProduct;
  UI.$('caisse-product').style.display = 'block';
  UI.$('caisse-product').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:18px;font-weight:700">${productEmoji(p.category)} ${UI.escHtml(p.name)}</div>
        <div style="font-size:13px;color:var(--text-3)">Stock: ${p.stock_qty} · ${UI.fmt(p.unit_price)}/unité</div>
      </div>
      <button class="btn btn-ghost sm" onclick="clearSelection()" style="font-size:16px">✕</button>
    </div>
    <div style="display:flex;align-items:center;gap:12px;margin-top:14px">
      <button class="btn btn-ghost sm" onclick="_currentQty=Math.max(1,_currentQty-1);showProduct()" style="width:44px;height:44px;font-size:22px;display:flex;align-items:center;justify-content:center">−</button>
      <span style="font-size:28px;font-weight:800;min-width:50px;text-align:center">${_currentQty}</span>
      <button class="btn btn-ghost sm" onclick="_currentQty=Math.min(_currentProduct.stock_qty,_currentQty+1);showProduct()" style="width:44px;height:44px;font-size:22px;display:flex;align-items:center;justify-content:center">+</button>
      <div style="flex:1;text-align:right;font-size:24px;font-weight:800;color:var(--green)">${UI.fmt(_currentQty * p.unit_price)}</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button id="pay-especes" class="btn sm" style="flex:1;padding:12px;font-size:15px;background:var(--green);color:#fff" onclick="selectPayment('especes')">💵 Espèces</button>
      <button id="pay-cb" class="btn btn-ghost sm" style="flex:1;padding:12px;font-size:15px" onclick="selectPayment('cb')">💳 CB</button>
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:12px;padding:16px;font-size:17px;font-weight:800" onclick="doVente()">✓ Valider la vente</button>
  `;
}

function clearSelection() {
  _currentProduct = null;
  UI.$('caisse-product').style.display = 'none';
  renderProductGrid(_caisseProducts);
}

function selectPayment(mode) {
  _caissePayment = mode;
  const esp = UI.$('pay-especes'), cb = UI.$('pay-cb');
  if (!esp || !cb) return;
  if (mode === 'especes') {
    esp.style.background = 'var(--green)'; esp.style.color = '#fff'; esp.style.borderColor = 'transparent';
    cb.style.background = ''; cb.style.color = ''; cb.style.borderColor = '';
    esp.className = 'btn sm'; cb.className = 'btn btn-ghost sm';
  } else {
    cb.style.background = 'var(--blue)'; cb.style.color = '#fff'; cb.style.borderColor = 'transparent';
    esp.style.background = ''; esp.style.color = ''; esp.style.borderColor = '';
    cb.className = 'btn sm'; esp.className = 'btn btn-ghost sm';
  }
}

async function doVente() {
  if (!_currentProduct || !_caisseTournoi) return;
  try {
    await API.createSale({ tournament_id: parseInt(_caisseTournoi), product_id: _currentProduct.id, qty: _currentQty, payment_method: _caissePayment });
    _caisseCart.push({ name: _currentProduct.name, qty: _currentQty, total: _currentQty * _currentProduct.unit_price, payment: _caissePayment });

    // Update local stock
    const idx = _caisseProducts.findIndex(p => p.id === _currentProduct.id);
    if (idx !== -1) _caisseProducts[idx].stock_qty -= _currentQty;

    _currentProduct = null;
    UI.$('caisse-product').style.display = 'none';
    const manual = UI.$('barcode-manual');
    if (manual) manual.value = '';
    renderProductGrid(_caisseProducts);
    renderCaisseCart();
    UI.toast('Vente enregistrée ✓');
  } catch (err) { UI.toast(err.message, 'error'); }
}

function renderCaisseCart() {
  if (_caisseCart.length === 0) { UI.$('caisse-cart-wrap').style.display = 'none'; return; }
  UI.$('caisse-cart-wrap').style.display = 'block';
  const total = _caisseCart.reduce((a, c) => a + c.total, 0);
  const espTotal = _caisseCart.filter(c => c.payment === 'especes').reduce((a, c) => a + c.total, 0);
  const cbTotal = _caisseCart.filter(c => c.payment === 'cb').reduce((a, c) => a + c.total, 0);
  UI.$('caisse-cart-wrap').innerHTML = `
    <strong style="display:block;margin-bottom:10px">🧾 Session (${_caisseCart.length} vente${_caisseCart.length > 1 ? 's' : ''})</strong>
    ${_caisseCart.map(c => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f5f5f5;font-size:14px">
      <span>${UI.escHtml(c.name)} <span style="color:var(--text-3)">×${c.qty}</span>
        ${c.payment === 'cb' ? '<span class="badge badge-blue" style="font-size:10px;margin-left:4px">💳</span>' : '<span class="badge badge-gray" style="font-size:10px;margin-left:4px">💵</span>'}
      </span>
      <strong>${UI.fmt(c.total)}</strong>
    </div>`).join('')}
    <div style="display:flex;gap:10px;margin-top:12px;font-size:13px;color:var(--text-2)">
      <span>💵 ${UI.fmt(espTotal)}</span>
      <span>💳 ${UI.fmt(cbTotal)}</span>
    </div>
    <div class="summary-bar green" style="margin-top:8px"><span>Total session</span><span class="val">${UI.fmt(total)}</span></div>
  `;
}

// ── Camera (BarcodeDetector) ──
async function toggleCamera() {
  if (_caisseStream) { stopCamera(); return; }
  try {
    _caisseStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = UI.$('caisse-video');
    video.srcObject = _caisseStream; video.style.display = 'block';
    UI.$('btn-cam').textContent = 'Arrêter';
    if ('BarcodeDetector' in window) {
      _barcodeDetector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a'] });
      scanFrame();
    }
  } catch { UI.toast('Caméra non disponible', 'error'); }
}

function scanFrame() {
  if (!_caisseStream) return;
  const video = UI.$('caisse-video');
  _barcodeDetector.detect(video).then(codes => {
    if (codes.length > 0) { lookupBarcode(codes[0].rawValue); stopCamera(); return; }
    _scanLoop = requestAnimationFrame(scanFrame);
  }).catch(() => {});
}

function stopCamera() {
  if (_caisseStream) { _caisseStream.getTracks().forEach(t => t.stop()); _caisseStream = null; }
  if (_scanLoop) { cancelAnimationFrame(_scanLoop); _scanLoop = null; }
  const video = UI.$('caisse-video');
  if (video) { video.srcObject = null; video.style.display = 'none'; }
  const btn = UI.$('btn-cam');
  if (btn) btn.textContent = 'Démarrer caméra';
}
