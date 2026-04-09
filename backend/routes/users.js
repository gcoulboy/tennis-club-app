const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

router.get('/', requireAdmin, (req, res) => {
  res.json(db.all('SELECT id, username, full_name, role, active, created_at FROM users ORDER BY created_at DESC'));
});

router.post('/', requireAdmin, (req, res) => {
  const { username, password, full_name, role } = req.body;
  if (!username || !password || !full_name) return res.status(400).json({ error: 'Champs requis' });
  const exists = db.get('SELECT id FROM users WHERE username = ?', [username]);
  if (exists) return res.status(409).json({ error: 'Identifiant déjà utilisé' });
  const hash = bcrypt.hashSync(password, 10);
  const r = db.run('INSERT INTO users (username, password_hash, full_name, role) VALUES (?,?,?,?)', [username, hash, full_name, role || 'caissier']);
  res.status(201).json(db.get('SELECT id, username, full_name, role, created_at FROM users WHERE id = ?', [r.lastInsertRowid]));
});

router.put('/:id', requireAdmin, (req, res) => {
  const { full_name, role, active, password } = req.body;
  const u = db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });
  db.run('UPDATE users SET full_name=?, role=?, active=? WHERE id=?', [full_name ?? u.full_name, role ?? u.role, active !== undefined ? active : u.active, req.params.id]);
  if (password) db.run('UPDATE users SET password_hash=? WHERE id=?', [bcrypt.hashSync(password, 10), req.params.id]);
  res.json(db.get('SELECT id, username, full_name, role, active FROM users WHERE id = ?', [req.params.id]));
});

module.exports = router;
