const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

// ═══ TOURNAMENTS ═══

router.get('/tournaments', (req, res) => {
  const list = db.all(`
    SELECT t.*,
      COALESCE((SELECT SUM(s.total_price) FROM sales s WHERE s.tournament_id = t.id), 0) as total_sales,
      COALESCE((SELECT COUNT(*) FROM sales s WHERE s.tournament_id = t.id), 0) as nb_sales,
      COALESCE((SELECT COUNT(*) FROM inscriptions i WHERE i.tournament_id = t.id), 0) as nb_joueurs
    FROM tournaments t ORDER BY t.date_start DESC
  `);
  res.json(list);
});

router.get('/tournaments/:id', (req, res) => {
  const t = db.get('SELECT * FROM tournaments WHERE id = ?', [req.params.id]);
  if (!t) return res.status(404).json({ error: 'Tournoi introuvable' });
  res.json(t);
});

router.post('/tournaments', requireAdmin, (req, res) => {
  const { name, date_start, date_end, code_homologation, juge_arbitre, part_ja } = req.body;
  if (!name || !date_start) return res.status(400).json({ error: 'Nom et date requis' });
  const r = db.run('INSERT INTO tournaments (name,date_start,date_end,code_homologation,juge_arbitre,part_ja) VALUES (?,?,?,?,?,?)',
    [name, date_start, date_end || null, code_homologation || null, juge_arbitre || null, part_ja || 75]);
  res.status(201).json(db.get('SELECT * FROM tournaments WHERE id = ?', [r.lastInsertRowid]));
});

router.put('/tournaments/:id', requireAdmin, (req, res) => {
  const t = db.get('SELECT * FROM tournaments WHERE id = ?', [req.params.id]);
  if (!t) return res.status(404).json({ error: 'Tournoi introuvable' });
  const { name, date_start, date_end, status, code_homologation, juge_arbitre, part_ja } = req.body;
  db.run('UPDATE tournaments SET name=?,date_start=?,date_end=?,status=?,code_homologation=?,juge_arbitre=?,part_ja=? WHERE id=?',
    [name ?? t.name, date_start ?? t.date_start, date_end ?? t.date_end, status ?? t.status,
     code_homologation !== undefined ? code_homologation : t.code_homologation,
     juge_arbitre !== undefined ? juge_arbitre : t.juge_arbitre,
     part_ja !== undefined ? part_ja : t.part_ja, req.params.id]);
  res.json(db.get('SELECT * FROM tournaments WHERE id = ?', [req.params.id]));
});

// ═══ PURCHASES ═══

router.get('/purchases', (req, res) => {
  const { product_id } = req.query;
  let sql = `SELECT p.*, pr.name as product_name, u.full_name as user_name
    FROM purchases p JOIN products pr ON pr.id=p.product_id JOIN users u ON u.id=p.user_id`;
  const params = [];
  if (product_id) { sql += ' WHERE p.product_id = ?'; params.push(product_id); }
  sql += ' ORDER BY p.purchased_at DESC';
  res.json(db.all(sql, params));
});

router.post('/purchases', requireAdmin, (req, res) => {
  const { product_id, qty, unit_cost, supplier, notes } = req.body;
  if (!product_id || !qty || !unit_cost) return res.status(400).json({ error: 'Champs requis' });
  const p = db.get('SELECT * FROM products WHERE id = ?', [product_id]);
  if (!p) return res.status(404).json({ error: 'Produit introuvable' });

  const doInsert = db.transaction(() => {
    const r = db.run('INSERT INTO purchases (product_id,user_id,qty,unit_cost,supplier,notes) VALUES (?,?,?,?,?,?)',
      [product_id, req.user.id, parseInt(qty), parseFloat(unit_cost), supplier || null, notes || null]);
    db.run('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?', [parseInt(qty), product_id]);
    return r.lastInsertRowid;
  });
  const id = doInsert();

  res.status(201).json(db.get(`SELECT p.*, pr.name as product_name FROM purchases p JOIN products pr ON pr.id=p.product_id WHERE p.id = ?`, [id]));
});

// ═══ SALES ═══

router.get('/sales', (req, res) => {
  const { tournament_id } = req.query;
  let sql = `SELECT s.*, pr.name as product_name, u.full_name as user_name, t.name as tournament_name
    FROM sales s JOIN products pr ON pr.id=s.product_id JOIN users u ON u.id=s.user_id JOIN tournaments t ON t.id=s.tournament_id`;
  const params = [];
  if (tournament_id) { sql += ' WHERE s.tournament_id = ?'; params.push(tournament_id); }
  sql += ' ORDER BY s.sold_at DESC';
  res.json(db.all(sql, params));
});

router.post('/sales', (req, res) => {
  const { tournament_id, product_id, qty, payment_method } = req.body;
  if (!tournament_id || !product_id || !qty) return res.status(400).json({ error: 'Champs requis' });
  const p = db.get('SELECT * FROM products WHERE id = ? AND active = 1', [product_id]);
  if (!p) return res.status(404).json({ error: 'Produit introuvable' });
  if (p.stock_qty < parseInt(qty)) return res.status(400).json({ error: `Stock insuffisant (reste: ${p.stock_qty})` });

  const doSale = db.transaction(() => {
    const r = db.run('INSERT INTO sales (tournament_id,product_id,user_id,qty,unit_price,payment_method) VALUES (?,?,?,?,?,?)',
      [tournament_id, product_id, req.user.id, parseInt(qty), p.unit_price, payment_method || 'especes']);
    db.run('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?', [parseInt(qty), product_id]);
    return r.lastInsertRowid;
  });
  const id = doSale();

  res.status(201).json(db.get(`SELECT s.*, pr.name as product_name, pr.stock_qty as remaining_stock
    FROM sales s JOIN products pr ON pr.id=s.product_id WHERE s.id = ?`, [id]));
});

// ═══ DASHBOARD ═══

router.get('/dashboard', (req, res) => {
  const totalProducts = db.get('SELECT COUNT(*) as c FROM products WHERE active = 1').c;
  const lowStock = db.get('SELECT COUNT(*) as c FROM products WHERE active=1 AND stock_qty <= stock_alert').c;
  const openTournaments = db.get("SELECT COUNT(*) as c FROM tournaments WHERE status = 'ouvert'").c;
  const totalRevenue = db.get('SELECT COALESCE(SUM(total_price),0) as r FROM sales').r;
  const totalCost = db.get('SELECT COALESCE(SUM(total_cost),0) as c FROM purchases').c;
  const recentSales = db.all(`SELECT s.qty, s.total_price, s.sold_at, s.payment_method, pr.name as product_name, t.name as tournament_name
    FROM sales s JOIN products pr ON pr.id=s.product_id JOIN tournaments t ON t.id=s.tournament_id ORDER BY s.sold_at DESC LIMIT 5`);
  res.json({ total_products: totalProducts, low_stock_count: lowStock, open_tournaments: openTournaments,
    total_revenue: totalRevenue, total_cost: totalCost, margin: totalRevenue - totalCost, recent_sales: recentSales });
});

module.exports = router;
