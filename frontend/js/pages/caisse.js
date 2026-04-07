// ─── Mode Caisse Rapide ───────────────────────────────────────────────────────
// Utilise l'API BarcodeDetector (Chrome/Safari iOS 16+) ou fallback saisie manuelle

let _caisseStream = null;      // flux caméra actif
let _caisseTournoi = null;     // tournoi sélectionné
let _caisseProducts = [];      // cache produits
let _caisseCart = [];          // panier en cours
let _caissePayment = 'especes'; // mode de paiement actif
let _barcodeDetector = null;   // BarcodeDetector instance
let _scanLoop = null;          // requestAnimationFrame loop

async function renderCaisse() {
  // Arrêter la caméra si on quitte la page
  stopCamera();

  UI.render('content-area', `
    <div class="page-header">
      <div>
        <div class="page-title">🛒 Caisse rapide</div>
        <div class="page-sub">Scan &amp; vente en 2 taps</div>
      </div>
    </div>

    <!-- Sélection tournoi -->
    <div id="caisse-tournoi-wrap" class="card" style="margin-bottom:14px">
      <label style="font-size:13px;font-weight:500;color:var(--text-2);display:block;margin-bottom:8px">Tournoi en cours</label>
      <select id="caisse-tournoi" onchange="selectTournoi(this.value)" style="font-size:16px">
        <option value="">— Sélectionner un tournoi —</option>
      </select>
    </div>

    <!-- Zone principale (cachée jusqu'à ce qu'un tournoi soit sélectionné) -->
    <div id="caisse-main" style="display:none">

      <!-- Viewfinder caméra -->
      <div class="card" style="margin-bottom:14px;padding:0;overflow:hidden;position:relative">
        <video id="caisse-video" autoplay playsinline muted
          style="width:100%;max-height:220px;object-fit:cover;display:block;background:#111"></video>
        <canvas id="caisse-canvas" style="display:none"></canvas>

        <!-- Overlay viseur -->
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
          <div style="width:220px;height:110px;border:2px solid rgba(255,255,255,.7);border-radius:10px;box-shadow:0 0 0 2000px rgba(0,0,0,.35)"></div>
        </div>

        <!-- Statut scan -->
        <div id="scan-status" style="position:absolute;bottom:10px;left:0;right:0;text-align:center;
          color:#fff;font-size:13px;font-weight:500;text-shadow:0 1px 3px rgba(0,0,0,.8)">
          Pointez la caméra vers un code-barres
        </div>

        <!-- Bouton caméra ON/OFF -->
        <button id="cam-toggle" onclick="toggleCamera()"
          style="position:absolute;top:10px;right:10px;background:rgba(0,0,0,.5);
          border:none;color:#fff;border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer">
          📷 Démarrer
        </button>
      </div>

      <!-- Saisie manuelle code-barres -->
      <div class="card" style="margin-bottom:14px">
        <div style="display:flex;gap:8px;align-items:center">
          <input type="text" id="caisse-barcode-input" placeholder="Ou saisir le code-barres manuellement…"
            class="mono" inputmode="numeric"
            style="flex:1;font-size:15px"
            onkeydown="if(event.key==='Enter') searchBarcode(this.value)">
          <button class="btn btn-primary" onclick="searchBarcode(document.getElementById('caisse-barcode-input').value)">
            Chercher
          </button>
        </div>
      </div>

      <!-- Produit trouvé -->
      <div id="caisse-product-found" style="display:none" class="card" style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
          <div>
            <div id="cpf-name" style="font-size:18px;font-weight:600"></div>
            <div id="cpf-cat" style="font-size:13px;color:var(--text-3);margin-top:2px"></div>
          </div>
          <div id="cpf-stock" style="font-size:13px;font-weight:500;text-align:right"></div>
        </div>

        <!-- Quantité + prix -->
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px">
          <button class="btn btn-outline" style="font-size:20px;padding:6px 14px;line-height:1"
            onclick="changeQty(-1)">−</button>
          <div style="flex:1;text-align:center">
            <div id="cpf-qty" style="font-size:32px;font-weight:700;line-height:1">1</div>
            <div style="font-size:12px;color:var(--text-3)">quantité</div>
          </div>
          <button class="btn btn-outline" style="font-size:20px;padding:6px 14px;line-height:1"
            onclick="changeQty(+1)">+</button>
        </div>

        <!-- Total -->
        <div style="background:var(--green-xpale);border-radius:10px;padding:12px 16px;
          display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <span style="font-size:14px;color:var(--text-2)">Total</span>
          <span id="cpf-total" style="font-size:22px;font-weight:700;color:var(--green)"></span>
        </div>

        <!-- Mode de paiement -->
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <button id="pay-especes" class="btn pay-btn active-pay"
            style="flex:1;justify-content:center;padding:12px;border-radius:10px;font-size:15px"
            onclick="selectPayment('especes')">💵 Espèces</button>
          <button id="pay-cb" class="btn pay-btn"
            style="flex:1;justify-content:center;padding:12px;border-radius:10px;font-size:15px"
            onclick="selectPayment('cb')">💳 CB</button>
        </div>

        <!-- Bouton vendre -->
        <button id="btn-vendre" class="btn btn-clay"
          style="width:100%;justify-content:center;padding:14px;font-size:16px;border-radius:12px"
          onclick="confirmerVente()">
          ✅ Valider la vente
        </button>

        <!-- Nouveau scan -->
        <button class="btn btn-outline"
          style="width:100%;justify-content:center;margin-top:10px"
          onclick="resetScan()">
          Nouveau scan
        </button>
      </div>

      <!-- Panier de la session -->
      <div id="caisse-panier-wrap" style="display:none" class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <strong style="font-size:15px">Ventes de la session</strong>
          <span id="panier-total" style="font-weight:700;color:var(--green)"></span>
        </div>
        <div id="caisse-panier-list"></div>
      </div>

    </div>
  `);

  // Charger les tournois ouverts
  try {
    const tournaments = await API.get('/tournaments');
    const sel = document.getElementById('caisse-tournoi');
    const open = tournaments.filter(t => t.status === 'ouvert');
    open.forEach(t => {
      const o = document.createElement('option');
      o.value = t.id; o.textContent = t.name;
      sel.appendChild(o);
    });
    // Auto-sélectionner si un seul tournoi ouvert
    if (open.length === 1) {
      sel.value = open[0].id;
      selectTournoi(open[0].id);
    }
    if (open.length === 0) {
      sel.innerHTML = '<option value="">⚠️ Aucun tournoi ouvert</option>';
    }
  } catch (err) {
    UI.toast(err.message, 'error');
  }

  // Charger le cache produits
  try { _caisseProducts = await API.get('/products'); } catch {}
}

function selectTournoi(id) {
  _caisseTournoi = id ? parseInt(id) : null;
  document.getElementById('caisse-main').style.display = _caisseTournoi ? 'block' : 'none';
  _caisseCart = [];
  renderPanier();
}

// ── Caméra & Scan ────────────────────────────────────────────────────────────

async function toggleCamera() {
  if (_caisseStream) { stopCamera(); return; }
  await startCamera();
}

async function startCamera() {
  const btn = document.getElementById('cam-toggle');
  const status = document.getElementById('scan-status');
  if (btn) { btn.textContent = '⏳ Démarrage…'; btn.disabled = true; }

  try {
    _caisseStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    const video = document.getElementById('caisse-video');
    video.srcObject = _caisseStream;
    await video.play();

    if (btn) { btn.textContent = '⏹ Arrêter'; btn.disabled = false; }
    if (status) status.textContent = 'Pointez vers un code-barres…';

    // Utiliser BarcodeDetector si disponible (Chrome Android, Safari iOS 16+)
    if ('BarcodeDetector' in window) {
      _barcodeDetector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'] });
      scanLoop();
    } else {
      if (status) status.textContent = '📷 Caméra active — saisir le code manuellement';
    }
  } catch (err) {
    if (btn) { btn.textContent = '📷 Démarrer'; btn.disabled = false; }
    if (status) status.textContent = '❌ Accès caméra refusé';
    UI.toast('Accès à la caméra refusé. Vérifiez les permissions Safari.', 'error');
  }
}

function stopCamera() {
  if (_scanLoop) { cancelAnimationFrame(_scanLoop); _scanLoop = null; }
  if (_caisseStream) {
    _caisseStream.getTracks().forEach(t => t.stop());
    _caisseStream = null;
  }
  const btn = document.getElementById('cam-toggle');
  if (btn) { btn.textContent = '📷 Démarrer'; btn.disabled = false; }
}

let _lastScannedCode = null;
let _lastScanTime = 0;

async function scanLoop() {
  const video = document.getElementById('caisse-video');
  if (!video || !_caisseStream || !_barcodeDetector) return;

  try {
    const barcodes = await _barcodeDetector.detect(video);
    if (barcodes.length > 0) {
      const code = barcodes[0].rawValue;
      const now = Date.now();
      // Anti-doublon : même code → attendre 3s avant de rescanner
      if (code !== _lastScannedCode || now - _lastScanTime > 3000) {
        _lastScannedCode = code;
        _lastScanTime = now;
        const status = document.getElementById('scan-status');
        if (status) status.textContent = `✅ Code détecté : ${code}`;
        await searchBarcode(code);
      }
    }
  } catch {}

  if (_caisseStream) _scanLoop = requestAnimationFrame(scanLoop);
}

// ── Recherche produit ────────────────────────────────────────────────────────

let _currentProduct = null;
let _currentQty = 1;

async function searchBarcode(code) {
  if (!code || !code.trim()) return;
  code = code.trim();

  // Chercher dans le cache d'abord
  let product = _caisseProducts.find(p => p.barcode === code);

  // Sinon appel API
  if (!product) {
    try {
      product = await API.get(`/products/barcode/${encodeURIComponent(code)}`);
      _caisseProducts.push(product);
    } catch {
      UI.toast(`Produit introuvable : ${code}`, 'error');
      document.getElementById('caisse-barcode-input').value = '';
      return;
    }
  }

  showProduct(product);
  // Vider le champ de saisie
  const inp = document.getElementById('caisse-barcode-input');
  if (inp) inp.value = '';
}

function showProduct(product) {
  _currentProduct = product;
  _currentQty = 1;

  const wrap = document.getElementById('caisse-product-found');
  wrap.style.display = 'block';

  document.getElementById('cpf-name').textContent = product.name;
  document.getElementById('cpf-cat').textContent = product.category;

  const stockEl = document.getElementById('cpf-stock');
  if (product.stock_qty <= 0) {
    stockEl.innerHTML = `<span style="color:#dc2626">⚠️ Rupture de stock</span>`;
    document.getElementById('btn-vendre').disabled = true;
  } else {
    stockEl.innerHTML = `<span style="color:var(--green)">Stock : ${product.stock_qty}</span>`;
    document.getElementById('btn-vendre').disabled = false;
  }

  updateQtyDisplay();

  // Scroll vers le produit
  wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function changeQty(delta) {
  if (!_currentProduct) return;
  const max = _currentProduct.stock_qty;
  _currentQty = Math.max(1, Math.min(max, _currentQty + delta));
  updateQtyDisplay();
}

function updateQtyDisplay() {
  if (!_currentProduct) return;
  document.getElementById('cpf-qty').textContent = _currentQty;
  const total = _currentQty * _currentProduct.unit_price;
  document.getElementById('cpf-total').textContent = UI.fmt(total);
}

async function confirmerVente() {
  if (!_currentProduct || !_caisseTournoi) return;
  const btn = document.getElementById('btn-vendre');
  btn.disabled = true;
  btn.textContent = '⏳ Enregistrement…';

  try {
    const result = await API.post('/sales', {
      tournament_id: _caisseTournoi,
      product_id: _currentProduct.id,
      qty: _currentQty,
      unit_price: _currentProduct.unit_price,
      payment_method: _caissePayment
    });

    // Mettre à jour le stock dans le cache local
    const cached = _caisseProducts.find(p => p.id === _currentProduct.id);
    if (cached) cached.stock_qty = result.remaining_stock;

    // Ajouter au panier session
    _caisseCart.push({
      name: _currentProduct.name,
      qty: _currentQty,
      unit_price: _currentProduct.unit_price,
      total: _currentQty * _currentProduct.unit_price,
      payment: _caissePayment
    });
    renderPanier();

    UI.toast(`✅ ${_currentProduct.name} × ${_currentQty} — ${UI.fmt(_currentQty * _currentProduct.unit_price)}`, 'success');
    resetScan();

  } catch (err) {
    UI.toast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = '✅ Valider la vente';
  }
}

function resetScan() {
  _currentProduct = null;
  _currentQty = 1;
  _lastScannedCode = null;
  selectPayment('especes');
  document.getElementById('caisse-product-found').style.display = 'none';
  const status = document.getElementById('scan-status');
  if (status) status.textContent = 'Pointez la caméra vers un code-barres';
  // Refocus sur le champ de saisie
  const inp = document.getElementById('caisse-barcode-input');
  if (inp) { inp.value = ''; inp.focus(); }
}

function renderPanier() {
  const wrap = document.getElementById('caisse-panier-wrap');
  if (!wrap) return;
  if (_caisseCart.length === 0) { wrap.style.display = 'none'; return; }

  wrap.style.display = 'block';
  const total = _caisseCart.reduce((s, i) => s + i.total, 0);
  document.getElementById('panier-total').textContent = UI.fmt(total);
  document.getElementById('caisse-panier-list').innerHTML = [..._caisseCart].reverse().map(item => `
    <div style="display:flex;justify-content:space-between;align-items:center;
      padding:8px 0;border-bottom:1px solid var(--border);font-size:14px">
      <span>${UI.escHtml(item.name)} <span style="color:var(--text-3)">×${item.qty}</span>
        ${item.payment === 'cb' ? '<span class="badge badge-blue" style="font-size:10px;margin-left:4px">💳 CB</span>' : '<span class="badge badge-gray" style="font-size:10px;margin-left:4px">💵</span>'}
      </span>
      <strong>${UI.fmt(item.total)}</strong>
    </div>
  `).join('');
}

function selectPayment(mode) {
  _caissePayment = mode;
  ['especes', 'cb'].forEach(m => {
    const btn = document.getElementById('pay-' + m);
    if (!btn) return;
    if (m === mode) {
      btn.classList.add('active-pay');
      btn.style.background = m === 'cb' ? 'var(--green)' : '#1a56a0';
      btn.style.color = '#fff';
      btn.style.borderColor = 'transparent';
    } else {
      btn.classList.remove('active-pay');
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    }
  });
}
