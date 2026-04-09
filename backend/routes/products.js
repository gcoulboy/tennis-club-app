const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

router.get('/', (req, res) => {
  res.json(db.all('SELECT * FROM products WHERE active = 1 ORDER BY name'));
});

router.get('/:id', (req, res) => {
  const p = db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Produit introuvable' });
  res.json(p);
});

router.get('/barcode/:code', (req, res) => {
  const p = db.get('SELECT * FROM products WHERE barcode = ? AND active = 1', [req.params.code]);
  if (!p) return res.status(404).json({ error: 'Code-barres inconnu' });
  res.json(p);
});

router.post('/', requireAdmin, (req, res) => {
  const { barcode, name, category, unit_price, stock_qty, stock_alert } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  if (barcode) {
    const exists = db.get('SELECT id FROM products WHERE barcode = ?', [barcode]);
    if (exists) return res.status(409).json({ error: 'Code-barres déjà utilisé' });
  }
  const r = db.run('INSERT INTO products (barcode,name,category,unit_price,stock_qty,stock_alert) VALUES (?,?,?,?,?,?)',
    [barcode || null, name, category || 'Autre', parseFloat(unit_price) || 0, parseInt(stock_qty) || 0, parseInt(stock_alert) || 5]);
  res.status(201).json(db.get('SELECT * FROM products WHERE id = ?', [r.lastInsertRowid]));
});

router.put('/:id', requireAdmin, (req, res) => {
  const p = db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Produit introuvable' });
  const { barcode, name, category, unit_price, stock_qty, stock_alert } = req.body;
  if (barcode && barcode !== p.barcode) {
    const exists = db.get('SELECT id FROM products WHERE barcode = ? AND id != ?', [barcode, req.params.id]);
    if (exists) return res.status(409).json({ error: 'Code-barres déjà utilisé' });
  }
  db.run('UPDATE products SET barcode=?,name=?,category=?,unit_price=?,stock_qty=?,stock_alert=?,updated_at=datetime(\'now\') WHERE id=?',
    [barcode !== undefined ? (barcode || null) : p.barcode, name ?? p.name, category ?? p.category,
     unit_price !== undefined ? parseFloat(unit_price) : p.unit_price,
     stock_qty !== undefined ? parseInt(stock_qty) : p.stock_qty,
     stock_alert !== undefined ? parseInt(stock_alert) : p.stock_alert, req.params.id]);
  res.json(db.get('SELECT * FROM products WHERE id = ?', [req.params.id]));
});

router.delete('/:id', requireAdmin, (req, res) => {
  const r = db.run('UPDATE products SET active = 0 WHERE id = ?', [req.params.id]);
  if (r.changes === 0) return res.status(404).json({ error: 'Produit introuvable' });
  res.json({ message: 'Produit archivé' });
});

module.exports = router;
