import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { localIso } from './util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'biznex.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('owner','admin','manager','cashier')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  sku                TEXT,
  barcode            TEXT,
  name               TEXT NOT NULL,
  category_id        INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  unit               TEXT NOT NULL DEFAULT 'pcs',
  cost_price         REAL NOT NULL DEFAULT 0,
  sale_price         REAL NOT NULL DEFAULT 0,
  stock_qty          REAL NOT NULL DEFAULT 0,
  reorder_threshold  REAL NOT NULL DEFAULT 5,
  tax_rate           REAL NOT NULL DEFAULT 0,
  is_active          INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL CHECK (action IN ('SALE','PURCHASE','DAMAGE','THEFT','CORRECTION','RETURN')),
  qty_delta   REAL NOT NULL,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number    TEXT UNIQUE NOT NULL,
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  order_type      TEXT NOT NULL DEFAULT 'dine_in' CHECK (order_type IN ('dine_in','takeaway','delivery','wholesale')),
  status          TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','preparing','ready','completed','cancelled','refunded')),
  subtotal        REAL NOT NULL DEFAULT 0,
  tax_amount      REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  total_amount    REAL NOT NULL DEFAULT 0,
  payment_method  TEXT NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH','UPI','CARD','QR')),
  payment_status  TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('unpaid','partial','paid','refunded')),
  customer_name   TEXT,
  customer_phone  TEXT,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name  TEXT NOT NULL,
  sku           TEXT,
  quantity      REAL NOT NULL,
  unit_price    REAL NOT NULL,
  tax_rate      REAL NOT NULL DEFAULT 0,
  tax_amount    REAL NOT NULL DEFAULT 0,
  line_total    REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS discounts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT UNIQUE NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('percentage','fixed')),
  value      REAL NOT NULL,
  is_active  INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS complaints (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'Normal' CHECK (severity IN ('Low','Normal','High')),
  status      TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted','In Progress','Resolved')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS shifts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clock_in_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  clock_out_at TEXT,
  sales_count  INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','CLOSED'))
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
`;

// ─────────────────────────────────────────────────────────────────────────────
// Database handle
// ─────────────────────────────────────────────────────────────────────────────

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(SCHEMA);

// ─────────────────────────────────────────────────────────────────────────────
// Settings helpers
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS = {
  shop_name: 'My Shop',
  shop_address: '',
  shop_phone: '',
  gstin: '',
  receipt_footer: 'Thank you for visiting!',
  currency: '₹',
  default_tax_rate: '18',
  low_stock_threshold: '5',
  auto_print_receipt: 'true',
  require_customer_phone: 'false',
};

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export function updateSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
  return getSettings();
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed
// ─────────────────────────────────────────────────────────────────────────────

export function seedIfEmpty() {
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(
      'INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run('Store Owner', 'admin', hash, 'owner');
    db.prepare(
      'INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run('Manager', 'manager', bcrypt.hashSync('manager123', 10), 'manager');
    db.prepare(
      'INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run('Cashier', 'cashier', bcrypt.hashSync('cashier123', 10), 'cashier');
    console.log('  ✓ Seeded users: admin/admin123, manager/manager123, cashier/cashier123');
  }

  const catCount = db.prepare('SELECT COUNT(*) AS c FROM categories').get().c;
  if (catCount === 0) {
    const cats = [
      ['Snacks', '#f59e0b', 1],
      ['Beverages', '#06b6d4', 2],
      ['Dairy', '#22c97a', 3],
      ['Grocery', '#6366f1', 4],
      ['Home Care', '#a855f7', 5],
      ['Personal Care', '#ef4444', 6],
    ];
    const ins = db.prepare('INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)');
    for (const c of cats) ins.run(...c);
    console.log('  ✓ Seeded 6 categories');
  }

  const productCount = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (productCount === 0) {
    const catId = (name) => db.prepare('SELECT id FROM categories WHERE name = ?').get(name)?.id ?? null;
    const prods = [
      ['POTATO-CHIPS', 'Potato Chips 52g', 'Snacks', 18, 25, 60, 15, 18],
      ['PARLE-G', 'Parle-G Biscuit 250g', 'Snacks', 22, 30, 80, 20, 18],
      ['SAMOSA', 'Samosa (2 pcs)', 'Snacks', 15, 25, 50, 10, 5],
      ['COLD-DRINK', 'Cold Drink 750ml', 'Beverages', 35, 45, 48, 12, 18],
      ['WATER-1L', 'Water Bottle 1L', 'Beverages', 12, 20, 120, 24, 5],
      ['MILK-500', 'Fresh Milk 500ml', 'Dairy', 24, 30, 40, 10, 0],
      ['CURD-200', 'Curd 200g', 'Dairy', 20, 28, 35, 8, 0],
      ['RICE-1KG', 'Rice 1kg', 'Grocery', 65, 78, 60, 12, 5],
      ['DAL-1KG', 'Toor Dal 1kg', 'Grocery', 120, 145, 40, 8, 5],
      ['SOAP-75', 'Bath Soap 75g', 'Home Care', 25, 35, 90, 20, 18],
      ['DETERGENT-1KG', 'Detergent 1kg', 'Home Care', 90, 110, 30, 6, 18],
      ['SHAMPOO-180', 'Shampoo 180ml', 'Personal Care', 85, 110, 25, 6, 18],
      ['TOOTHPASTE', 'Toothpaste 100g', 'Personal Care', 45, 60, 40, 10, 18],
      ['BREAD', 'Brown Bread 400g', 'Snacks', 30, 40, 25, 6, 5],
      ['TEA-250', 'Tea Powder 250g', 'Grocery', 110, 135, 20, 5, 5],
      ['NOODLES', 'Instant Noodles (pack of 5)', 'Snacks', 60, 75, 45, 10, 18],
    ];
    const ins = db.prepare(`
      INSERT INTO products (sku, name, category_id, cost_price, sale_price, stock_qty, reorder_threshold, tax_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const [sku, name, cat, cost, price, stock, threshold, tax] of prods) {
      ins.run(sku, name, catId(cat), cost, price, stock, threshold, tax);
    }
    console.log('  ✓ Seeded 16 sample products');
  }

  const discountCount = db.prepare('SELECT COUNT(*) AS c FROM discounts').get().c;
  if (discountCount === 0) {
    const ins = db.prepare('INSERT INTO discounts (code, type, value) VALUES (?, ?, ?)');
    ins.run('SAVE10', 'percentage', 10);
    ins.run('FLAT50', 'fixed', 50);
    console.log('  ✓ Seeded discount codes SAVE10, FLAT50');
  }

  const orderCount = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
  if (orderCount === 0) {
    seedDemoOrders();
    console.log('  ✓ Seeded demo orders for the last 7 days');
  }

  const settingsCount = db.prepare('SELECT COUNT(*) AS c FROM settings').get().c;
  if (settingsCount === 0) {
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(k, v);
    }
    console.log('  ✓ Seeded default settings');
  }
}

function seedDemoOrders() {
  const products = db.prepare('SELECT id, name, sku, sale_price, tax_rate, stock_qty FROM products').all();
  const methods = ['CASH', 'UPI', 'CARD', 'QR'];
  let counter = 0;

  for (let day = 6; day >= 0; day--) {
    const count = 5 + Math.floor(Math.random() * 6); // 5–10 orders per day
    for (let i = 0; i < count; i++) {
      const hour = 10 + Math.floor(Math.random() * 10);
      const minute = Math.floor(Math.random() * 60);
      const ts = new Date();
      ts.setDate(ts.getDate() - day);
      ts.setHours(hour, minute, 0, 0);
      const iso = localIso(ts);

      const itemCount = 1 + Math.floor(Math.random() * 4);
      const chosen = [...products].sort(() => Math.random() - 0.5).slice(0, itemCount);
      let subtotal = 0;
      let tax = 0;
      const items = chosen.map((p) => {
        const qty = 1 + Math.floor(Math.random() * 3);
        const line = qty * p.sale_price;
        const lineTax = line * (p.tax_rate / 100);
        subtotal += line;
        tax += lineTax;
        return [p.id, p.name, p.sku, qty, p.sale_price, p.tax_rate, lineTax, line + lineTax];
      });
      const total = Math.round((subtotal + tax) * 100) / 100;
      const discount = 0;
      const method = methods[Math.floor(Math.random() * methods.length)];
      const number = `BNX-${iso.slice(0, 10).replace(/-/g, '')}-${String(++counter).padStart(4, '0')}`;

      const orderRes = db.prepare(`
        INSERT INTO orders (order_number, user_id, order_type, status, subtotal, tax_amount, discount_amount,
                            total_amount, payment_method, payment_status, created_at, updated_at)
        VALUES (?, 3, 'dine_in', 'completed', ?, ?, ?, ?, ?, 'paid', ?, ?)
      `).run(number, Math.round(subtotal * 100) / 100, Math.round(tax * 100) / 100, discount, total, method, iso, iso);

      const insItem = db.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, sku, quantity, unit_price, tax_rate, tax_amount, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const it of items) insItem.run(orderRes.lastInsertRowid, ...it);
    }
  }
}

// Seed idempotently on import
seedIfEmpty();
