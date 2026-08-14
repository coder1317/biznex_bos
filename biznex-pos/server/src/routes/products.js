import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireAtLeast } from '../auth.js';
import { broadcast } from '../realtime.js';

export const productsRouter = Router();
productsRouter.use(requireAuth);

// ── Categories ────────────────────────────────────────────────────────────────

productsRouter.get('/categories', (_req, res) => {
  const rows = db.prepare('SELECT * FROM categories ORDER BY sort_order, name').all();
  res.json({ categories: rows });
});

productsRouter.post('/categories', requireAtLeast('manager'), (req, res) => {
  const { name, color } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'Category name is required' });
  try {
    const result = db.prepare('INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)')
      .run(String(name).trim(), color || '#6366f1', 0);
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ category });
  } catch {
    res.status(409).json({ error: 'Category already exists' });
  }
});

productsRouter.put('/categories/:id', requireAtLeast('manager'), (req, res) => {
  const { name, color, sortOrder } = req.body ?? {};
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  db.prepare('UPDATE categories SET name = ?, color = ?, sort_order = ? WHERE id = ?')
    .run(name ?? cat.name, color ?? cat.color, sortOrder ?? cat.sort_order, cat.id);
  res.json({ category: db.prepare('SELECT * FROM categories WHERE id = ?').get(cat.id) });
});

productsRouter.delete('/categories/:id', requireAtLeast('admin'), (req, res) => {
  const result = db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Category not found' });
  res.json({ ok: true });
});

// ── Products ──────────────────────────────────────────────────────────────────

productsRouter.get('/', (req, res) => {
  const { search, categoryId, includeInactive } = req.query;
  let sql = `
    SELECT p.*, c.name AS category_name, c.color AS category_color
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE 1=1
  `;
  const params = [];
  if (!includeInactive) { sql += ' AND p.is_active = 1'; }
  if (categoryId) { sql += ' AND p.category_id = ?'; params.push(categoryId); }
  if (search) { sql += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  sql += ' ORDER BY p.name COLLATE NOCASE';
  const rows = db.prepare(sql).all(...params);
  res.json({ products: rows });
});

productsRouter.get('/:id', (req, res) => {
  const product = db.prepare(`
    SELECT p.*, c.name AS category_name, c.color AS category_color
    FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?
  `).get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product });
});

productsRouter.post('/', requireAtLeast('manager'), (req, res) => {
  const p = req.body ?? {};
  if (!p.name) return res.status(400).json({ error: 'Product name is required' });
  const salePrice = p.salePrice ?? p.sale_price;
  if (salePrice == null || Number(salePrice) < 0) return res.status(400).json({ error: 'Valid sale price is required' });

  const result = db.prepare(`
    INSERT INTO products (sku, barcode, name, category_id, unit, cost_price, sale_price, stock_qty, reorder_threshold, tax_rate, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    p.sku || null, p.barcode || null, String(p.name).trim(),
    p.categoryId ?? null, p.unit || 'pcs',
    Number(p.costPrice) || 0, Number(salePrice),
    Number(p.stockQty) || 0, p.reorderThreshold == null ? 5 : Number(p.reorderThreshold),
    Number(p.taxRate) || 0, p.isActive === false ? 0 : 1
  );

  const product = db.prepare(`
    SELECT p.*, c.name AS category_name, c.color AS category_color
    FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?
  `).get(result.lastInsertRowid);
  broadcast('product:updated', { product });
  res.status(201).json({ product });
});

productsRouter.put('/:id', requireAtLeast('manager'), (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  const p = req.body ?? {};

  db.prepare(`
    UPDATE products SET sku = ?, barcode = ?, name = ?, category_id = ?, unit = ?,
      cost_price = ?, sale_price = ?, reorder_threshold = ?, tax_rate = ?, is_active = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(
    p.sku ?? existing.sku, p.barcode ?? existing.barcode, p.name ?? existing.name,
    p.categoryId ?? existing.category_id, p.unit ?? existing.unit,
    p.costPrice ?? existing.cost_price, p.salePrice ?? existing.sale_price,
    p.reorderThreshold ?? existing.reorder_threshold, p.taxRate ?? existing.tax_rate,
    p.isActive === undefined ? existing.is_active : (p.isActive ? 1 : 0),
    existing.id
  );

  const product = db.prepare(`
    SELECT p.*, c.name AS category_name, c.color AS category_color
    FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?
  `).get(existing.id);
  broadcast('product:updated', { product });
  res.json({ product });
});

productsRouter.delete('/:id', requireAtLeast('admin'), (req, res) => {
  const result = db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Product not found' });
  res.json({ ok: true });
});
