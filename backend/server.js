const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

db.init().then(() => {
  // API routes
  app.use('/api/auth',     require('./routes/auth'));
  app.use('/api/users',    require('./routes/users'));
  app.use('/api/products', require('./routes/products'));
  app.use('/api/compta',   require('./routes/compta'));
  app.use('/api',          require('./routes/operations'));

  // Serve frontend
  const frontendPath = path.join(__dirname, 'frontend');
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎾 Tennis Club App v2 démarrée sur http://0.0.0.0:${PORT}`);
  });
}).catch(err => {
  console.error('❌ Erreur démarrage:', err);
  process.exit(1);
});
