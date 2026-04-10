const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  const user = db.get('SELECT * FROM users WHERE username = ? AND active = 1', [username]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role, full_name: user.full_name }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name } });
});

router.get('/me', authenticate, (req, res) => {
  res.json(db.get('SELECT id, username, full_name, role, created_at FROM users WHERE id = ?', [req.user.id]));
});

router.post('/change-password', authenticate, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password || new_password.length < 6) return res.status(400).json({ error: 'Min 6 caractères' });
  const user = db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!bcrypt.compareSync(current_password, user.password_hash)) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
  db.run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(new_password, 10), req.user.id]);
  res.json({ message: 'Mot de passe modifié' });
});

module.exports = router;
