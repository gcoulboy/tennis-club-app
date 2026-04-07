const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

// GET /api/products - list all products (with optional search)
router.get('/', (req, res) => {
  const { search, category, low_stock } = req.query;
  let sql = 'SELECT * FROM products WHERE active = 1';
  const params = [];

  if (search) {
    sql += ' AND (name LIKE ? OR barcode LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (low_stock === '1') {
    sql += ' AND stock_qty <= stock_alert';
  }

  sql += ' ORDER BY category, name';
  res.json(db.prepare(sql).all(...params));
});

// GET /api/products/barcode/:code
router.get('/barcode/:code', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE barcode = ? AND active = 1').get(req.params.code);
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });
  res.json(product);
});

// GET /api/products/categories
router.get('/categories', (req, res) => {
  const cats = db.prepare('SELECT DISTINCT category FROM products WHERE active = 1 ORDER BY category').all();
  res.json(cats.map(r => r.category));
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Produit introuvable' });
  res.json(p);
});

// POST /api/products (admin only)
router.post('/', requireAdmin, (req, res) => {
  const { barcode, name, category, unit_price, stock_qty, stock_alert } = req.body;
  if (!name || unit_price === undefined) {
    return res.status(400).json({ error: 'Nom et prix sont requis' });
  }
  if (barcode) {
    const exists = db.prepare('SELECT id FROM products WHERE barcode = ?').get(barcode);
    if (exists) return res.status(409).json({ error: 'Ce code-barres est déjà utilisé' });
  }

  const result = db.prepare(`
    INSERT INTO products (barcode, name, category, unit_price, stock_qty, stock_alert)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    barcode || null,
    name,
    category || 'Autre',
    parseFloat(unit_price),
    parseInt(stock_qty) || 0,
    parseInt(stock_alert) || 5
  );

  res.status(201).json(db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/products/:id (admin only)
router.put('/:id', requireAdmin, (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Produit introuvable' });

  const { barcode, name, category, unit_price, stock_qty, stock_alert } = req.body;

  if (barcode && barcode !== p.barcode) {
    const exists = db.prepare('SELECT id FROM products WHERE barcode = ? AND id != ?').get(barcode, req.params.id);
    if (exists) return res.status(409).json({ error: 'Ce code-barres est déjà utilisé' });
  }

  db.prepare(`
    UPDATE products SET
      barcode = ?, name = ?, category = ?, unit_price = ?,
      stock_qty = ?, stock_alert = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    barcode !== undefined ? (barcode || null) : p.barcode,
    name ?? p.name,
    category ?? p.category,
    unit_price !== undefined ? parseFloat(unit_price) : p.unit_price,
    stock_qty !== undefined ? parseInt(stock_qty) : p.stock_qty,
    stock_alert !== undefined ? parseInt(stock_alert) : p.stock_alert,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id));
});

// DELETE /api/products/:id (admin only) - soft delete
router.delete('/:id', requireAdmin, (req, res) => {
  const result = db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Produit introuvable' });
  res.json({ message: 'Produit archivé' });
});

module.exports = router;
