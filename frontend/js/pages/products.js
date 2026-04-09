async function renderProducts() {
  UI.render('content-area', `
    <div class="page-header">
      <div><div class="page-title">📦 Produits</div><div class="page-sub">Snack — articles en stock</div></div>
      <button class="btn btn-primary" onclick="showAddProduct()">+ Ajouter</button>
    </div>
    <div class="card" id="products-list">Chargement...</div>
  `);
  try {
    const products = await API.getProducts();
    UI.render('products-list', `<table><thead><tr><th>Produit</th><th>Code-barres</th><th>Catégorie</th><th>Prix vente</th><th>Stock</th><th></th></tr></thead><tbody>
      ${products.map(p => `<tr>
        <td style="font-weight:600">${UI.escHtml(p.name)}</td>
        <td><code style="font-family:var(--mono);font-size:12px">${p.barcode || '—'}</code></td>
        <td><span class="badge badge-gray">${UI.escHtml(p.category)}</span></td>
        <td style="font-weight:600">${UI.fmt(p.unit_price)}</td>
        <td>${p.stock_qty <= p.stock_alert ? `<span class="badge badge-red">${p.stock_qty}</span>` : `<span class="badge badge-green">${p.stock_qty}</span>`}</td>
        <td>
          <button class="btn btn-ghost sm" onclick='showEditProduct(${JSON.stringify(p).replace(/'/g,"&#39;")})'>Modifier</button>
          <button class="btn sm" style="color:var(--red)" onclick="doDeleteProduct(${p.id})">✕</button>
        </td>
      </tr>`).join('')}
    </tbody></table>`);
  } catch (err) { UI.render('products-list', `<div style="color:var(--red)">${err.message}</div>`); }
}

function _productForm(p = {}) {
  return `<div style="display:flex;flex-direction:column;gap:12px">
    <div><label class="field-label">Nom</label><input id="m-name" value="${UI.escHtml(p.name || '')}" style="width:100%"></div>
    <div><label class="field-label">Code-barres</label><input id="m-barcode" value="${p.barcode || ''}" style="width:100%"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div><label class="field-label">Prix vente (€)</label><input type="number" step="0.1" id="m-price" value="${p.unit_price || 0}" style="width:100%"></div>
      <div><label class="field-label">Catégorie</label><input id="m-cat" value="${UI.escHtml(p.category || 'Autre')}" style="width:100%"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div><label class="field-label">Stock</label><input type="number" id="m-stock" value="${p.stock_qty || 0}" style="width:100%"></div>
      <div><label class="field-label">Alerte stock</label><input type="number" id="m-alert" value="${p.stock_alert || 5}" style="width:100%"></div>
    </div>`;
}

function showAddProduct() {
  UI.modal('Nouveau produit', _productForm() + `<button class="btn btn-primary" style="margin-top:8px" onclick="doAddProduct()">Créer</button></div>`);
}

async function doAddProduct() {
  try {
    await API.createProduct({ name: UI.$('m-name').value, barcode: UI.$('m-barcode').value || null, unit_price: parseFloat(UI.$('m-price').value), category: UI.$('m-cat').value, stock_qty: parseInt(UI.$('m-stock').value), stock_alert: parseInt(UI.$('m-alert').value) });
    UI.closeModal(); UI.toast('Produit créé'); renderProducts();
  } catch (err) { UI.toast(err.message, 'error'); }
}

function showEditProduct(p) {
  UI.modal('Modifier produit', _productForm(p) + `<button class="btn btn-primary" style="margin-top:8px" onclick="doEditProduct(${p.id})">Enregistrer</button></div>`);
}

async function doEditProduct(id) {
  try {
    await API.updateProduct(id, { name: UI.$('m-name').value, barcode: UI.$('m-barcode').value || null, unit_price: parseFloat(UI.$('m-price').value), category: UI.$('m-cat').value, stock_qty: parseInt(UI.$('m-stock').value), stock_alert: parseInt(UI.$('m-alert').value) });
    UI.closeModal(); UI.toast('Modifié'); renderProducts();
  } catch (err) { UI.toast(err.message, 'error'); }
}

async function doDeleteProduct(id) {
  if (!UI.confirm('Archiver ce produit ?')) return;
  try { await API.deleteProduct(id); UI.toast('Archivé'); renderProducts(); } catch (err) { UI.toast(err.message, 'error'); }
}
