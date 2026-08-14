import { Router } from 'express';
import { db, getSettings } from '../db.js';
import { requireAuth, requireAtLeast } from '../auth.js';
import { broadcast } from '../realtime.js';

export const inventoryRouter = Router();
inventoryRouter.use(requireAuth);

/**
 * Adjust stock for a product. Positive qtyDelta = stock in, negative = stock out.
 * Every adjustment is recorded as an immutable stock movement (audit trail).
 */
inventoryRouter.post('/adjust', requireAtLeast('manager'), (req, res) => {
  const { productId, qtyDelta, action = 'CORRECTION', note } = req.body ?? {};
  if (!productId || qtyDelta == null || Number(qtyDelta) === 0) {
    return res.status(400).json({ error: 'productId and a non-zero qtyDelta are required' });
  }
  const allowed = ['PURCHASE', 'DAMAGE', 'THEFT', 'CORRECTION', 'RETURN'];
  if (!allowed.includes(action)) return res.status(400).json({ error: `action must be one of ${allowed.join(', ')}` });

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const delta = Number(qtyDelta);
  const newQty = Math.max(0, product.stock_qty + delta);
  const applied = newQty - product.stock_qty;

  db.prepare('UPDATE products SET stock_qty = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(newQty, productId);
  db.prepare('INSERT INTO stock_movements (product_id, user_id, action, qty_delta, note) VALUES (?, ?, ?, ?, ?)')
    .run(productId, req.user.id, action, applied, note || null);

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  broadcast('inventory:updated', { product: updated, appliedDelta: applied });
  res.json({ product: updated, appliedDelta: applied, note });
});

inventoryRouter.get('/movements', (req, res) => {
  const { productId, limit = 100 } = req.query;
  let sql = `
    SELECT m.*, p.name AS product_name, u.name AS user_name
    FROM stock_movements m
    JOIN products p ON p.id = m.product_id
    LEFT JOIN users u ON u.id = m.user_id
  `;
  const params = [];
  if (productId) { sql += ' WHERE m.product_id = ?'; params.push(productId); }
  sql += ' ORDER BY m.created_at DESC, m.id DESC LIMIT ?';
  params.push(Number(limit) || 100);
  res.json({ movements: db.prepare(sql).all(...params) });
});

inventoryRouter.get('/low-stock', (_req, res) => {
  const threshold = Number(getSettings().low_stock_threshold) || 5;
  const rows = db.prepare(`
    SELECT p.*, c.name AS category_name
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1 AND p.stock_qty <= p.reorder_threshold
    ORDER BY p.stock_qty ASC
  `).all();
  res.json({ products: rows, threshold });
});
