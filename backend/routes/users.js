const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

// All user routes require authentication + admin
router.use(authenticate, requireAdmin);

// GET /api/users
router.get('/', (req, res) => {
  const users = db.prepare(
    'SELECT id, username, full_name, role, active, created_at FROM users ORDER BY full_name'
  ).all();
  res.json(users);
});

// POST /api/users
router.post('/', (req, res) => {
  const { username, password, full_name, role } = req.body;
  if (!username || !password || !full_name || !role) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }
  if (!['admin', 'caissier'].includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Mot de passe trop court (min. 6 caractères)' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Cet identifiant est déjà utilisé' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
  ).run(username, hash, full_name, role);

  res.status(201).json({ id: result.lastInsertRowid, username, full_name, role, active: 1 });
});

// PUT /api/users/:id
router.put('/:id', (req, res) => {
  const { full_name, role, active, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  // Prevent deactivating own account
  if (Number(req.params.id) === req.user.id && active === 0) {
    return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte' });
  }

  let hash = user.password_hash;
  if (password) {
    if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court' });
    hash = bcrypt.hashSync(password, 10);
  }

  db.prepare(`
    UPDATE users SET full_name = ?, role = ?, active = ?, password_hash = ? WHERE id = ?
  `).run(
    full_name ?? user.full_name,
    role ?? user.role,
    active !== undefined ? active : user.active,
    hash,
    req.params.id
  );

  const updated = db.prepare('SELECT id, username, full_name, role, active FROM users WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/users/:id
router.delete('/:id', (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
  }
  const result = db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json({ message: 'Utilisateur désactivé' });
});

module.exports = router;
