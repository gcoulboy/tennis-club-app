const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

// ─── TOURNAMENTS ─────────────────────────────────────────────────────────────

// GET /api/tournaments
router.get('/tournaments', (req, res) => {
  const list = db.prepare(`
    SELECT t.*,
      COALESCE(SUM(s.total_price), 0) as total_sales,
      COUNT(DISTINCT s.id) as nb_sales
    FROM tournaments t
    LEFT JOIN sales s ON s.tournament_id = t.id
    GROUP BY t.id
    ORDER BY t.date_start DESC
  `).all();
  res.json(list);
});

router.post('/tournaments', requireAdmin, (req, res) => {
  const { name, date_start, date_end } = req.body;
  if (!name || !date_start) return res.status(400).json({ error: 'Nom et date de début requis' });
  const r = db.prepare('INSERT INTO tournaments (name, date_start, date_end) VALUES (?, ?, ?)').run(name, date_start, date_end || null);
  res.status(201).json(db.prepare('SELECT * FROM tournaments WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/tournaments/:id', requireAdmin, (req, res) => {
  const { name, date_start, date_end, status } = req.body;
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Tournoi introuvable' });
  db.prepare('UPDATE tournaments SET name=?, date_start=?, date_end=?, status=? WHERE id=?')
    .run(name ?? t.name, date_start ?? t.date_start, date_end ?? t.date_end, status ?? t.status, req.params.id);
  res.json(db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id));
});

// ─── PURCHASES ───────────────────────────────────────────────────────────────

// GET /api/purchases
router.get('/purchases', (req, res) => {
  const { product_id, limit = 50 } = req.query;
  let sql = `
    SELECT p.*, pr.name as product_name, pr.barcode, u.full_name as user_name
    FROM purchases p
    JOIN products pr ON pr.id = p.product_id
    JOIN users u ON u.id = p.user_id
  `;
  const params = [];
  if (product_id) { sql += ' WHERE p.product_id = ?'; params.push(product_id); }
  sql += ' ORDER BY p.purchased_at DESC LIMIT ?';
  params.push(parseInt(limit));
  res.json(db.prepare(sql).all(...params));
});


// DELETE /api/purchases/:id — annule l'achat et retire la quantité du stock
router.delete('/purchases/:id', (req, res) => {
  try {
    const purchase = db.get(
      'SELECT p.*, pr.name as product_name FROM purchases p JOIN products pr ON pr.id = p.product_id WHERE p.id = ?',
      [req.params.id]
    );
    if (!purchase) return res.status(404).json({ error: 'Achat introuvable' });

    const product = db.get('SELECT stock_qty FROM products WHERE id = ?', [purchase.product_id]);
    if (product && product.stock_qty < purchase.qty) {
      return res.status(400).json({
        error: 'Impossible d\'annuler : des ventes ont déjà consommé ce stock. Stock actuel : ' + product.stock_qty + ', quantité achetée : ' + purchase.qty
      });
    }

    db.run('DELETE FROM purchases WHERE id = ?', [req.params.id]);
    db.run("UPDATE products SET stock_qty = stock_qty - ?, updated_at = datetime('now') WHERE id = ?",
      [purchase.qty, purchase.product_id]);

    res.json({ message: 'Achat annulé — stock de "' + purchase.product_name + '" réduit de ' + purchase.qty });
  } catch (err) {
    console.error('Erreur DELETE /purchases:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/purchases — adds stock
router.post('/purchases', (req, res) => {
  try {
    const { product_id, qty, unit_cost, supplier, notes } = req.body;
    if (!product_id || !qty || unit_cost === undefined) {
      return res.status(400).json({ error: 'Produit, quantité et coût requis' });
    }
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(product_id);
    if (!product) return res.status(404).json({ error: 'Produit introuvable' });

    const qtyInt = parseInt(qty);
    const costFloat = parseFloat(unit_cost);
    const total = qtyInt * costFloat;

    const r = db.run(
      'INSERT INTO purchases (product_id, user_id, qty, unit_cost, total_cost, supplier, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [product_id, req.user.id, qtyInt, costFloat, total, supplier || null, notes || null]
    );
    db.run(
      "UPDATE products SET stock_qty = stock_qty + ?, updated_at = datetime('now') WHERE id = ?",
      [qtyInt, product_id]
    );

    res.status(201).json({
      id: r.lastInsertRowid,
      product_id,
      user_id: req.user.id,
      qty: qtyInt,
      unit_cost: costFloat,
      total_cost: total,
      supplier: supplier || null,
      notes: notes || null,
      product_name: product.name,
      user_name: req.user.full_name
    });
  } catch (err) {
    console.error('Erreur POST /purchases:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── SALES ───────────────────────────────────────────────────────────────────

// GET /api/sales
router.get('/sales', (req, res) => {
  const { tournament_id, limit = 100 } = req.query;
  let sql = `
    SELECT s.*, pr.name as product_name, pr.barcode, u.full_name as user_name, t.name as tournament_name
    FROM sales s
    JOIN products pr ON pr.id = s.product_id
    JOIN users u ON u.id = s.user_id
    JOIN tournaments t ON t.id = s.tournament_id
  `;
  const params = [];
  if (tournament_id) { sql += ' WHERE s.tournament_id = ?'; params.push(tournament_id); }
  sql += ' ORDER BY s.sold_at DESC LIMIT ?';
  params.push(parseInt(limit));
  res.json(db.prepare(sql).all(...params));
});

// GET /api/sales/summary/:tournament_id
router.get('/sales/summary/:tournament_id', (req, res) => {
  const summary = db.prepare(`
    SELECT pr.name, pr.category, SUM(s.qty) as total_qty,
           SUM(s.total_price) as total_revenue, s.unit_price
    FROM sales s JOIN products pr ON pr.id = s.product_id
    WHERE s.tournament_id = ?
    GROUP BY s.product_id
    ORDER BY total_revenue DESC
  `).all(req.params.tournament_id);
  const total = summary.reduce((acc, r) => acc + r.total_revenue, 0);

  // Répartition par mode de paiement
  const byPayment = db.prepare(`
    SELECT payment_method, SUM(total_price) as total, COUNT(*) as nb
    FROM sales WHERE tournament_id = ? GROUP BY payment_method
  `).all(req.params.tournament_id);

  res.json({ items: summary, total_revenue: total, by_payment: byPayment });
});

// POST /api/sales — deducts stock
router.post('/sales', (req, res) => {
  try {
    const { tournament_id, product_id, qty, unit_price, payment_method } = req.body;
    if (!tournament_id || !product_id || !qty) {
      return res.status(400).json({ error: 'Tournoi, produit et quantité requis' });
    }

    const validPayments = ['especes', 'cb'];
    const payment = validPayments.includes(payment_method) ? payment_method : 'especes';

    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ? AND status = ?').get(tournament_id, 'ouvert');
    if (!tournament) return res.status(400).json({ error: 'Tournoi introuvable ou clôturé' });

    const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(product_id);
    if (!product) return res.status(404).json({ error: 'Produit introuvable' });

    const qtyInt = parseInt(qty);
    if (product.stock_qty < qtyInt) {
      return res.status(400).json({ error: `Stock insuffisant (disponible: ${product.stock_qty})` });
    }

    const price = unit_price !== undefined ? parseFloat(unit_price) : product.unit_price;
    const total = qtyInt * price;

    const r = db.run(
      'INSERT INTO sales (tournament_id, product_id, user_id, qty, unit_price, total_price, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [tournament_id, product_id, req.user.id, qtyInt, price, total, payment]
    );
    db.run(
      "UPDATE products SET stock_qty = stock_qty - ?, updated_at = datetime('now') WHERE id = ?",
      [qtyInt, product_id]
    );

    const newStock = db.get('SELECT stock_qty FROM products WHERE id = ?', [product_id]);

    res.status(201).json({
      id: r.lastInsertRowid,
      tournament_id, product_id,
      user_id: req.user.id,
      qty: qtyInt,
      unit_price: price,
      total_price: total,
      payment_method: payment,
      product_name: product.name,
      tournament_name: tournament.name,
      user_name: req.user.full_name,
      remaining_stock: newStock ? newStock.stock_qty : 0
    });
  } catch (err) {
    console.error('Erreur POST /sales:', err);
    res.status(500).json({ error: err.message });
  }
});


// DELETE /api/sales/:id — annule la vente et restitue la quantité au stock
router.delete('/sales/:id', (req, res) => {
  try {
    const sale = db.get(
      'SELECT s.*, pr.name as product_name FROM sales s JOIN products pr ON pr.id = s.product_id WHERE s.id = ?',
      [req.params.id]
    );
    if (!sale) return res.status(404).json({ error: 'Vente introuvable' });

    db.run('DELETE FROM sales WHERE id = ?', [req.params.id]);
    db.run("UPDATE products SET stock_qty = stock_qty + ?, updated_at = datetime('now') WHERE id = ?",
      [sale.qty, sale.product_id]);

    res.json({ message: 'Vente annulée — stock de "' + sale.product_name + '" restauré de ' + sale.qty });
  } catch (err) {
    console.error('Erreur DELETE /sales:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────

router.get('/dashboard', (req, res) => {
  const totalProducts = db.prepare('SELECT COUNT(*) as c FROM products WHERE active = 1').get().c;
  const lowStock = db.prepare('SELECT COUNT(*) as c FROM products WHERE active=1 AND stock_qty <= stock_alert').get().c;
  const openTournaments = db.prepare("SELECT COUNT(*) as c FROM tournaments WHERE status = 'ouvert'").get().c;
  const totalRevenue = db.prepare('SELECT COALESCE(SUM(total_price),0) as r FROM sales').get().r;
  const totalCost = db.prepare('SELECT COALESCE(SUM(total_cost),0) as c FROM purchases').get().c;
  const recentSales = db.prepare(`
    SELECT s.qty, s.total_price, s.sold_at, pr.name as product_name, t.name as tournament_name
    FROM sales s JOIN products pr ON pr.id=s.product_id JOIN tournaments t ON t.id=s.tournament_id
    ORDER BY s.sold_at DESC LIMIT 5
  `).all();

  res.json({
    total_products: totalProducts,
    low_stock_count: lowStock,
    open_tournaments: openTournaments,
    total_revenue: totalRevenue,
    total_cost: totalCost,
    margin: totalRevenue - totalCost,
    recent_sales: recentSales
  });
});

module.exports = router;
