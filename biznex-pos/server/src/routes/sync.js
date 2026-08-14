import { Router } from 'express';
import { db, getSettings } from '../db.js';
import { requireAuth } from '../auth.js';

export const syncRouter = Router();
syncRouter.use(requireAuth);

/**
 * Version-based sync state. The owner app calls this frequently (or receives
 * live WebSocket events) and uses the counters to know when to refetch:
 *
 *   - orderVersion: latest order id (refetch orders when it changes)
 *   - productVersion: latest product updated_at (refetch catalog when it changes)
 *   - inventoryVersion: latest stock movement id
 */
syncRouter.get('/state', (_req, res) => {
  const lastOrder = db.prepare('SELECT MAX(id) AS id, MAX(updated_at) AS updated FROM orders').get();
  const lastProduct = db.prepare('SELECT MAX(updated_at) AS updated FROM products').get();
  const lastMovement = db.prepare('SELECT MAX(id) AS id FROM stock_movements').get();
  const lastComplaint = db.prepare('SELECT MAX(updated_at) AS updated FROM complaints').get();

  res.json({
    serverTime: new Date().toISOString(),
    shopName: getSettings().shop_name,
    orderVersion: lastOrder.id ?? 0,
    orderUpdatedAt: lastOrder.updated ?? null,
    productVersion: lastProduct.updated ?? null,
    inventoryVersion: lastMovement.id ?? 0,
    complaintVersion: lastComplaint.updated ?? null,
  });
});

/** Compact snapshot: what the owner app needs on first connect. */
syncRouter.get('/snapshot', (_req, res) => {
  const settings = getSettings();
  res.json({
    settings,
    categories: db.prepare('SELECT * FROM categories ORDER BY sort_order, name').all(),
    products: db.prepare(`
      SELECT p.id, p.sku, p.barcode, p.name, p.category_id, c.name AS category_name, p.unit,
             p.cost_price, p.sale_price, p.stock_qty, p.reorder_threshold, p.tax_rate, p.is_active
      FROM products p LEFT JOIN categories c ON c.id = p.category_id ORDER BY p.name COLLATE NOCASE
    `).all(),
    recentOrders: db.prepare('SELECT * FROM orders ORDER BY created_at DESC, id DESC LIMIT 50').all(),
    lowStock: db.prepare(`
      SELECT p.*, c.name AS category_name FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.is_active = 1 AND p.stock_qty <= p.reorder_threshold ORDER BY p.stock_qty ASC
    `).all(),
    openComplaints: db.prepare(`
      SELECT c.*, u.name AS user_name FROM complaints c LEFT JOIN users u ON u.id = c.user_id
      WHERE c.status != 'Resolved' ORDER BY c.created_at DESC
    `).all(),
  });
});
