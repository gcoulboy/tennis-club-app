/**
 * database.js — sql.js wrapper (SQLite in WebAssembly)
 * Merged schema: snack (products, purchases, sales) + compta (inscriptions, depenses, dotations)
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'tennis.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let _db = null;

function _save() {
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function run(sql, params = []) {
  _db.run(sql, params);
  const changes = _db.getRowsModified();
  let lastInsertRowid = 0;
  try {
    const stmt = _db.prepare('SELECT last_insert_rowid() as id');
    stmt.step();
    lastInsertRowid = stmt.getAsObject().id;
    stmt.free();
  } catch {}
  _save();
  return { changes, lastInsertRowid };
}

function all(sql, params = []) {
  const stmt = _db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  return all(sql, params)[0];
}

function exec(sql) {
  _db.exec(sql);
  _save();
}

function transaction(fn) {
  return (...args) => {
    _db.run('BEGIN');
    try {
      const result = fn(...args);
      _db.run('COMMIT');
      _save();
      return result;
    } catch (err) {
      _db.run('ROLLBACK');
      throw err;
    }
  };
}

function prepare(sql) {
  return {
    run: (...params) => run(sql, params),
    get: (...params) => get(sql, params),
    all: (...params) => all(sql, params),
  };
}

async function init() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(buf);
  } else {
    _db = new SQL.Database();
  }

  _db.exec(`
    -- ═══ USERS ═══
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'caissier')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══ PRODUCTS (snack) ═══
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'Autre',
      unit_price REAL NOT NULL DEFAULT 0,
      stock_qty INTEGER NOT NULL DEFAULT 0,
      stock_alert INTEGER NOT NULL DEFAULT 5,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══ TOURNAMENTS ═══
    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code_homologation TEXT,
      date_start TEXT NOT NULL,
      date_end TEXT,
      juge_arbitre TEXT,
      part_ja REAL DEFAULT 75,
      status TEXT NOT NULL DEFAULT 'ouvert' CHECK(status IN ('ouvert', 'clos')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══ PURCHASES (achats snack) ═══
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      qty INTEGER NOT NULL,
      unit_cost REAL NOT NULL,
      total_cost REAL,
      supplier TEXT,
      notes TEXT,
      purchased_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══ SALES (ventes snack) ═══
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      qty INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL,
      payment_method TEXT DEFAULT 'especes' CHECK(payment_method IN ('especes', 'cb')),
      sold_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══ INSCRIPTIONS (joueurs compta) ═══
    CREATE TABLE IF NOT EXISTS inscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      nom TEXT NOT NULL,
      prenom TEXT,
      montant REAL NOT NULL DEFAULT 0,
      mode_paiement TEXT DEFAULT 'Espèce' CHECK(mode_paiement IN ('Carte bancaire', 'Espèce', 'Paiement en ligne', 'Chèque')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ═══ DEPENSES (compta) ═══
    CREATE TABLE IF NOT EXISTS depenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      label TEXT NOT NULL,
      montant REAL NOT NULL DEFAULT 0,
      category TEXT DEFAULT 'autre'
    );

    -- ═══ DOTATIONS (compta) ═══
    CREATE TABLE IF NOT EXISTS dotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      category TEXT NOT NULL,
      nom_joueur TEXT,
      montant REAL NOT NULL DEFAULT 0
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_sales_tournament ON sales(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_product ON purchases(product_id);
    CREATE INDEX IF NOT EXISTS idx_inscriptions_tournament ON inscriptions(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_depenses_tournament ON depenses(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_dotations_tournament ON dotations(tournament_id);

    -- Triggers
    CREATE TRIGGER IF NOT EXISTS calc_purchase_total
      AFTER INSERT ON purchases BEGIN
        UPDATE purchases SET total_cost = NEW.qty * NEW.unit_cost WHERE id = NEW.id;
      END;
    CREATE TRIGGER IF NOT EXISTS calc_sale_total
      AFTER INSERT ON sales BEGIN
        UPDATE sales SET total_price = NEW.qty * NEW.unit_price WHERE id = NEW.id;
      END;
  `);

  // Migration: add new columns to existing tournaments table
  try { _db.run("ALTER TABLE tournaments ADD COLUMN code_homologation TEXT"); } catch {}
  try { _db.run("ALTER TABLE tournaments ADD COLUMN juge_arbitre TEXT"); } catch {}
  try { _db.run("ALTER TABLE tournaments ADD COLUMN part_ja REAL DEFAULT 75"); } catch {}
  try { _db.run("ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT 'especes'"); } catch {}

  _save();

  // Seed admin
  const userCount = get('SELECT COUNT(*) as c FROM users');
  if (!userCount || userCount.c === 0) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    run("INSERT INTO users (username, password_hash, full_name, role) VALUES ('admin', ?, 'Administrateur', 'admin')", [hash]);
    console.log('👤 Compte admin créé (admin / admin123)');
  }

  console.log('🗄️  Base de données prête (v2 - compta + snack)');
}

module.exports = { init, run, get, all, exec, prepare, transaction };
