// ─── Mode Caisse Rapide ───
let _caisseStream = null, _caisseTournoi = null, _currentProduct = null, _currentQty = 1;
let _caisseCart = [], _barcodeDetector = null, _scanLoop = null, _caissePayment = 'especes';

async function renderCaisse() {
  stopCamera();
  const tournaments = await API.getTournaments();
  const open = tournaments.filter(t => t.status === 'ouvert');

  UI.render('content-area', `
    <div class="page-header"><div><div class="page-title">⚡ Caisse rapide</div><div class="page-sub">Scan &amp; vente</div></div></div>
    <div class="card" style="margin-bottom:14px">
      <label class="field-label">Tournoi</label>
      <select id="caisse-tournoi" onchange="selectTournoi(this.value)" style="width:100%;font-size:16px">
        <option value="">— Sélectionner —</option>
        ${open.map(t => `<option value="${t.id}">${UI.escHtml(t.name)}</option>`).join('')}
      </select>
    </div>
    <div id="caisse-main" style="display:none">
      <div class="card" style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <strong>📷 Scanner</strong>
          <button class="btn btn-primary sm" id="btn-cam" onclick="toggleCamera()">Démarrer</button>
        </div>
        <video id="caisse-video" autoplay playsinline style="display:none"></video>
        <div style="margin-top:10px"><input id="barcode-manual" placeholder="Saisir code-barres manuellement" style="width:100%" onkeydown="if(event.key==='Enter')lookupBarcode(this.value)"></div>
      </div>
      <div id="caisse-product" class="card" style="display:none;margin-bottom:14px"></div>
      <div id="caisse-cart-wrap" class="card" style="display:none"></div>
    </div>
  `);
  if (open.length === 1) { UI.$('caisse-tournoi').value = open[0].id; selectTournoi(open[0].id); }
}

function selectTournoi(id) {
  _caisseTournoi = id || null;
  const main = UI.$('caisse-main');
  if (main) main.style.display = _caisseTournoi ? 'block' : 'none';
}

async function lookupBarcode(code) {
  if (!code) return;
  try {
    _currentProduct = await API.getProductByBarcode(code.trim());
    _currentQty = 1;
    _caissePayment = 'especes';
    showProduct();
  } catch { UI.toast('Produit non trouvé', 'error'); }
}

function showProduct() {
  const p = _currentProduct;
  UI.$('caisse-product').style.display = 'block';
  UI.$('caisse-product').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-size:18px;font-weight:700">${UI.escHtml(p.name)}</div><div style="font-size:13px;color:var(--text-3)">Stock: ${p.stock_qty} · ${UI.fmt(p.unit_price)}/unité</div></div>
    </div>
    <div style="display:flex;align-items:center;gap:12px;margin-top:14px">
      <button class="btn btn-ghost sm" onclick="_currentQty=Math.max(1,_currentQty-1);showProduct()">−</button>
      <span style="font-size:24px;font-weight:800;min-width:40px;text-align:center">${_currentQty}</span>
      <button class="btn btn-ghost sm" onclick="_currentQty++;showProduct()">+</button>
      <div style="flex:1;text-align:right;font-size:22px;font-weight:800;color:var(--green)">${UI.fmt(_currentQty * p.unit_price)}</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button id="pay-especes" class="btn sm" style="flex:1;background:var(--green);color:#fff" onclick="selectPayment('especes')">💵 Espèces</button>
      <button id="pay-cb" class="btn btn-ghost sm" style="flex:1" onclick="selectPayment('cb')">💳 CB</button>
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:12px;padding:14px;font-size:16px" onclick="doVente()">Valider la vente</button>
  `;
}

function selectPayment(mode) {
  _caissePayment = mode;
  const esp = UI.$('pay-especes'), cb = UI.$('pay-cb');
  if (!esp || !cb) return;
  if (mode === 'especes') {
    esp.style.background = 'var(--green)'; esp.style.color = '#fff'; esp.style.borderColor = 'transparent';
    cb.style.background = ''; cb.style.color = ''; cb.style.borderColor = '';
  } else {
    cb.style.background = 'var(--blue)'; cb.style.color = '#fff'; cb.style.borderColor = 'transparent';
    esp.style.background = ''; esp.style.color = ''; esp.style.borderColor = '';
  }
}

async function doVente() {
  if (!_currentProduct || !_caisseTournoi) return;
  try {
    await API.createSale({ tournament_id: parseInt(_caisseTournoi), product_id: _currentProduct.id, qty: _currentQty, payment_method: _caissePayment });
    _caisseCart.push({ name: _currentProduct.name, qty: _currentQty, total: _currentQty * _currentProduct.unit_price, payment: _caissePayment });
    _currentProduct = null;
    UI.$('caisse-product').style.display = 'none';
    UI.$('barcode-manual').value = '';
    renderCaisseCart();
    UI.toast('Vente enregistrée ✓');
  } catch (err) { UI.toast(err.message, 'error'); }
}

function renderCaisseCart() {
  if (_caisseCart.length === 0) { UI.$('caisse-cart-wrap').style.display = 'none'; return; }
  UI.$('caisse-cart-wrap').style.display = 'block';
  const total = _caisseCart.reduce((a, c) => a + c.total, 0);
  UI.$('caisse-cart-wrap').innerHTML = `
    <strong style="display:block;margin-bottom:10px">🧾 Session (${_caisseCart.length} ventes)</strong>
    ${_caisseCart.map(c => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f5f5f5;font-size:14px">
      <span>${UI.escHtml(c.name)} ×${c.qty} ${c.payment === 'cb' ? '<span class="badge badge-blue" style="font-size:10px">💳</span>' : '<span class="badge badge-gray" style="font-size:10px">💵</span>'}</span>
      <strong>${UI.fmt(c.total)}</strong>
    </div>`).join('')}
    <div class="summary-bar green" style="margin-top:12px"><span>Total session</span><span class="val">${UI.fmt(total)}</span></div>
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
  if (btn) btn.textContent = 'Démarrer';
}
