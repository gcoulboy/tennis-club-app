async function renderPurchases() {
  UI.render('content-area', `
    <div class="page-header">
      <div><div class="page-title">🛒 Achats</div><div class="page-sub">Approvisionnement snack</div></div>
      <button class="btn btn-primary" onclick="showAddPurchase()">+ Nouvel achat</button>
    </div>
    <div class="card" id="purchases-list">Chargement...</div>
  `);
  try {
    const purchases = await API.getPurchases();
    UI.render('purchases-list', purchases.length === 0 ? '<p style="color:var(--text-3)">Aucun achat enregistré</p>' : `
      <table><thead><tr><th>Date</th><th>Produit</th><th>Qté</th><th>Coût unit.</th><th>Total</th><th>Par</th></tr></thead><tbody>
      ${purchases.map(p => `<tr>
        <td style="font-size:12px;color:var(--text-3)">${new Date(p.purchased_at).toLocaleDateString('fr-FR')}</td>
        <td style="font-weight:600">${UI.escHtml(p.product_name)}</td>
        <td>${p.qty}</td><td>${UI.fmt(p.unit_cost)}</td>
        <td style="font-weight:700">${UI.fmt(p.total_cost)}</td>
        <td style="font-size:12px">${UI.escHtml(p.user_name)}</td>
      </tr>`).join('')}
      </tbody></table>
    `);
  } catch (err) { UI.render('purchases-list', `<div style="color:var(--red)">${err.message}</div>`); }
}

async function showAddPurchase() {
  const products = await API.getProducts();
  UI.modal('Nouvel achat', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div><label class="field-label">Produit</label><select id="m-product" style="width:100%">${products.map(p => `<option value="${p.id}">${UI.escHtml(p.name)} (stock: ${p.stock_qty})</option>`).join('')}</select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label class="field-label">Quantité</label><input type="number" id="m-qty" value="1" min="1" style="width:100%"></div>
        <div><label class="field-label">Coût unitaire (€)</label><input type="number" step="0.01" id="m-cost" style="width:100%"></div>
      </div>
      <div><label class="field-label">Fournisseur</label><input id="m-supplier" style="width:100%"></div>
      <div><label class="field-label">Notes</label><textarea id="m-notes" rows="2" style="width:100%"></textarea></div>
      <button class="btn btn-primary" onclick="doAddPurchase()">Enregistrer</button>
    </div>
  `);
}

async function doAddPurchase() {
  try {
    await API.createPurchase({ product_id: parseInt(UI.$('m-product').value), qty: parseInt(UI.$('m-qty').value), unit_cost: parseFloat(UI.$('m-cost').value), supplier: UI.$('m-supplier').value, notes: UI.$('m-notes').value });
    UI.closeModal(); UI.toast('Achat enregistré'); renderPurchases();
  } catch (err) { UI.toast(err.message, 'error'); }
}
