const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

// ═══ INSCRIPTIONS ═══

router.get('/inscriptions', (req, res) => {
  const { tournament_id } = req.query;
  if (!tournament_id) return res.status(400).json({ error: 'tournament_id requis' });
  res.json(db.all('SELECT * FROM inscriptions WHERE tournament_id = ? ORDER BY nom, prenom', [tournament_id]));
});

router.post('/inscriptions', (req, res) => {
  const { tournament_id, nom, prenom, montant, mode_paiement } = req.body;
  if (!tournament_id || !nom) return res.status(400).json({ error: 'Tournoi et nom requis' });
  const r = db.run('INSERT INTO inscriptions (tournament_id,nom,prenom,montant,mode_paiement) VALUES (?,?,?,?,?)',
    [tournament_id, nom, prenom || '', parseFloat(montant) || 0, mode_paiement || 'Espèce']);
  res.status(201).json(db.get('SELECT * FROM inscriptions WHERE id = ?', [r.lastInsertRowid]));
});

router.put('/inscriptions/:id', (req, res) => {
  const i = db.get('SELECT * FROM inscriptions WHERE id = ?', [req.params.id]);
  if (!i) return res.status(404).json({ error: 'Inscription introuvable' });
  const { nom, prenom, montant, mode_paiement } = req.body;
  db.run('UPDATE inscriptions SET nom=?,prenom=?,montant=?,mode_paiement=? WHERE id=?',
    [nom ?? i.nom, prenom ?? i.prenom, montant !== undefined ? parseFloat(montant) : i.montant, mode_paiement ?? i.mode_paiement, req.params.id]);
  res.json(db.get('SELECT * FROM inscriptions WHERE id = ?', [req.params.id]));
});

router.delete('/inscriptions/:id', (req, res) => {
  const r = db.run('DELETE FROM inscriptions WHERE id = ?', [req.params.id]);
  if (r.changes === 0) return res.status(404).json({ error: 'Introuvable' });
  res.json({ message: 'Supprimé' });
});

// ═══ DEPENSES ═══

router.get('/depenses', (req, res) => {
  const { tournament_id } = req.query;
  if (!tournament_id) return res.status(400).json({ error: 'tournament_id requis' });
  res.json(db.all('SELECT * FROM depenses WHERE tournament_id = ? ORDER BY id', [tournament_id]));
});

router.post('/depenses', requireAdmin, (req, res) => {
  const { tournament_id, label, montant, category } = req.body;
  if (!tournament_id || !label) return res.status(400).json({ error: 'Tournoi et libellé requis' });
  const r = db.run('INSERT INTO depenses (tournament_id,label,montant,category) VALUES (?,?,?,?)',
    [tournament_id, label, parseFloat(montant) || 0, category || 'autre']);
  res.status(201).json(db.get('SELECT * FROM depenses WHERE id = ?', [r.lastInsertRowid]));
});

router.put('/depenses/:id', requireAdmin, (req, res) => {
  const d = db.get('SELECT * FROM depenses WHERE id = ?', [req.params.id]);
  if (!d) return res.status(404).json({ error: 'Dépense introuvable' });
  const { label, montant, category } = req.body;
  db.run('UPDATE depenses SET label=?,montant=?,category=? WHERE id=?',
    [label ?? d.label, montant !== undefined ? parseFloat(montant) : d.montant, category ?? d.category, req.params.id]);
  res.json(db.get('SELECT * FROM depenses WHERE id = ?', [req.params.id]));
});

router.delete('/depenses/:id', requireAdmin, (req, res) => {
  const r = db.run('DELETE FROM depenses WHERE id = ?', [req.params.id]);
  if (r.changes === 0) return res.status(404).json({ error: 'Introuvable' });
  res.json({ message: 'Supprimé' });
});

// ═══ DOTATIONS ═══

router.get('/dotations', (req, res) => {
  const { tournament_id } = req.query;
  if (!tournament_id) return res.status(400).json({ error: 'tournament_id requis' });
  res.json(db.all('SELECT * FROM dotations WHERE tournament_id = ? ORDER BY id', [tournament_id]));
});

router.post('/dotations/batch', requireAdmin, (req, res) => {
  const { tournament_id, dotations } = req.body;
  if (!tournament_id || !dotations) return res.status(400).json({ error: 'Champs requis' });
  try {
    // Delete existing dotations for this tournament
    db.run('DELETE FROM dotations WHERE tournament_id = ?', [tournament_id]);
    // Insert new ones
    for (const d of dotations) {
      db.run('INSERT INTO dotations (tournament_id,category,nom_joueur,montant) VALUES (?,?,?,?)',
        [tournament_id, d.category, d.nom_joueur || '', parseFloat(d.montant) || 0]);
    }
    res.json(db.all('SELECT * FROM dotations WHERE tournament_id = ?', [tournament_id]));
  } catch (err) {
    console.error('Erreur sauvegarde dotations:', err);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde: ' + err.message });
  }
});

// ═══ BILAN COMPLET D'UN TOURNOI ═══

router.get('/bilan/:tournament_id', (req, res) => {
  const tid = req.params.tournament_id;
  const tournament = db.get('SELECT * FROM tournaments WHERE id = ?', [tid]);
  if (!tournament) return res.status(404).json({ error: 'Tournoi introuvable' });

  // Inscriptions by payment mode
  const inscriptions = db.all('SELECT * FROM inscriptions WHERE tournament_id = ?', [tid]);
  const inscriptionsByMode = {};
  let totalInscriptions = 0;
  for (const i of inscriptions) {
    inscriptionsByMode[i.mode_paiement] = (inscriptionsByMode[i.mode_paiement] || 0) + i.montant;
    totalInscriptions += i.montant;
  }

  // Snack sales
  const salesByPayment = db.all(`SELECT payment_method, SUM(total_price) as total FROM sales WHERE tournament_id = ? GROUP BY payment_method`, [tid]);
  const snackEspeces = salesByPayment.find(s => s.payment_method === 'especes')?.total || 0;
  const snackCB = salesByPayment.find(s => s.payment_method === 'cb')?.total || 0;
  const totalSnack = snackEspeces + snackCB;

  // Sales detail
  const salesDetail = db.all(`SELECT pr.name, SUM(s.qty) as qty, SUM(s.total_price) as total, s.payment_method
    FROM sales s JOIN products pr ON pr.id=s.product_id WHERE s.tournament_id = ?
    GROUP BY pr.id, s.payment_method ORDER BY total DESC`, [tid]);

  // Cost of goods sold for this tournament
  const snackCost = db.get(`SELECT COALESCE(SUM(p.unit_cost * s.qty), 0) as cost
    FROM sales s JOIN (SELECT product_id, AVG(unit_cost) as unit_cost FROM purchases GROUP BY product_id) p
    ON p.product_id = s.product_id WHERE s.tournament_id = ?`, [tid])?.cost || 0;

  // Depenses
  const depenses = db.all('SELECT * FROM depenses WHERE tournament_id = ?', [tid]);
  const totalDepenses = depenses.reduce((a, d) => a + d.montant, 0);

  // Dotations
  const dotations = db.all('SELECT * FROM dotations WHERE tournament_id = ?', [tid]);
  const totalDotations = dotations.reduce((a, d) => a + d.montant, 0);

  // Stock snapshot
  const stock = db.all('SELECT id, name, stock_qty, stock_alert FROM products WHERE active = 1 ORDER BY name');

  // Totals
  const totalRecettes = totalInscriptions + totalSnack;
  const totalDepensesGlobal = totalDepenses + totalDotations;
  const benefice = totalRecettes - totalDepensesGlobal;
  const partJA = benefice * ((tournament.part_ja || 75) / 100);
  const partClub = benefice - partJA;
  const margeSnack = totalSnack - snackCost;

  res.json({
    tournament,
    inscriptions: { list: inscriptions, by_mode: inscriptionsByMode, total: totalInscriptions },
    snack: { especes: snackEspeces, cb: snackCB, total: totalSnack, cost: snackCost, marge: margeSnack, detail: salesDetail },
    depenses: { list: depenses, total: totalDepenses },
    dotations: { list: dotations, total: totalDotations },
    stock,
    bilan: { total_recettes: totalRecettes, total_depenses: totalDepensesGlobal, benefice, part_ja: partJA, part_club: partClub }
  });
});

module.exports = router;
