import { Router } from 'express';
import { db, getSettings } from '../db.js';
import { requireAuth, requireAtLeast } from '../auth.js';
import { localDate } from '../util.js';
import { broadcast } from '../realtime.js';

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

// ── Helpers ───────────────────────────────────────────────────────────────────

function nextOrderNumber() {
  const day = localDate().replace(/-/g, '');
  const row = db.prepare('SELECT COUNT(*) AS c FROM orders WHERE order_number LIKE ?').get(`BNX-${day}-%`);
  return `BNX-${day}-${String(row.c + 1).padStart(4, '0')}`;
}

function orderWithItems(order) {
  if (!order) return null;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  return { ...order, items };
}

// ── Create order ──────────────────────────────────────────────────────────────

class OrderError extends Error {}

ordersRouter.post('/', (req, res) => {
  const body = req.body ?? {};
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return res.status(400).json({ error: 'Order must contain at least one item' });

  const paymentMethods = ['CASH', 'UPI', 'CARD', 'QR'];
  const paymentMethod = (body.paymentMethod || 'CASH').toUpperCase();
  if (!paymentMethods.includes(paymentMethod)) {
    return res.status(400).json({ error: `paymentMethod must be one of ${paymentMethods.join(', ')}` });
  }
  const orderTypes = ['dine_in', 'takeaway', 'delivery', 'wholesale'];
  if (body.orderType && !orderTypes.includes(body.orderType)) {
    return res.status(400).json({ error: `orderType must be one of ${orderTypes.join(', ')}` });
  }

  const settings = getSettings();
  const defaultTax = Number(settings.default_tax_rate) || 0;

  const create = db.transaction(() => {
    let subtotal = 0;
    let taxAmount = 0;

    // Validate products + stock first (throw rolls the transaction back)
    const prepared = [];
    for (const it of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(it.productId);
      if (!product || !product.is_active) throw new OrderError(`Product ${it.productId} not found`);
      const qty = Number(it.quantity);
      if (!qty || qty <= 0) throw new OrderError(`Invalid quantity for ${product.name}`);

      const unitPrice = it.unitPrice != null ? Number(it.unitPrice) : product.sale_price;
      const taxRate = it.taxRate != null ? Number(it.taxRate) : (product.tax_rate ?? defaultTax);
      if (product.stock_qty < qty) throw new OrderError(`Insufficient stock for ${product.name} (only ${product.stock_qty} left)`);

      const line = Math.round(qty * unitPrice * 100) / 100;
      const tax = Math.round(line * (taxRate / 100) * 100) / 100;
      subtotal += line;
      taxAmount += tax;
      prepared.push({ product, qty, unitPrice, taxRate, line, tax });
    }

    // Discount
    let discountAmount = 0;
    const code = body.discountCode ? String(body.discountCode).trim().toUpperCase() : null;
    if (code) {
      const d = db.prepare('SELECT * FROM discounts WHERE code = ? AND is_active = 1').get(code);
      if (!d) throw new OrderError(`Discount code ${code} is invalid or expired`);
      if (d.expires_at && String(d.expires_at).slice(0, 10) < localDate()) {
        throw new OrderError(`Discount code ${code} has expired`);
      }
      discountAmount = d.type === 'percentage'
        ? Math.round(subtotal * (d.value / 100) * 100) / 100
        : Math.min(d.value, subtotal);
    }

    const total = Math.round((subtotal + taxAmount - discountAmount) * 100) / 100;
    if (total < 0) throw new OrderError('Total cannot be negative');

    const orderNumber = nextOrderNumber();
    const orderResult = db.prepare(`
      INSERT INTO orders (order_number, user_id, order_type, status, subtotal, tax_amount, discount_amount,
                          total_amount, payment_method, payment_status, customer_name, customer_phone, notes)
      VALUES (?, ?, ?, 'completed', ?, ?, ?, ?, ?, 'paid', ?, ?, ?)
    `).run(
      orderNumber, req.user.id, body.orderType || 'dine_in',
      Math.round(subtotal * 100) / 100, Math.round(taxAmount * 100) / 100, discountAmount, total,
      paymentMethod, body.customerName || null, body.customerPhone || null, body.notes || null
    );
    const orderId = orderResult.lastInsertRowid;

    const insItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, sku, quantity, unit_price, tax_rate, tax_amount, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insMove = db.prepare(
      "INSERT INTO stock_movements (product_id, user_id, action, qty_delta, note) VALUES (?, ?, 'SALE', ?, ?)"
    );
    const decStock = db.prepare("UPDATE products SET stock_qty = stock_qty - ?, updated_at = datetime('now','localtime') WHERE id = ?");

    for (const it of prepared) {
      insItem.run(orderId, it.product.id, it.product.name, it.product.sku, it.qty, it.unitPrice, it.taxRate, it.tax, it.line);
      decStock.run(it.qty, it.product.id);
      insMove.run(it.product.id, req.user.id, -it.qty, `Invoice ${orderNumber}`);
    }

    // Track shift sales
    db.prepare("UPDATE shifts SET sales_count = sales_count + 1 WHERE user_id = ? AND status = 'ACTIVE'").run(req.user.id);

    return orderWithItems(db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId));
  });

  try {
    const result = create();
    const receipt = buildReceipt(result, settings);
    broadcast('order:created', { order: result });
    res.status(201).json({ order: result, receipt });
  } catch (err) {
    if (err instanceof OrderError) return res.status(400).json({ error: err.message });
    throw err;
  }
});

// ── List / get ────────────────────────────────────────────────────────────────

ordersRouter.get('/', (req, res) => {
  const { limit = 50, offset = 0, from, to, status, paymentMethod, search } = req.query;
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];
  if (from) { sql += ' AND created_at >= ?'; params.push(from); }
  if (to) { sql += ' AND created_at <= ?'; params.push(to); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (paymentMethod) { sql += ' AND payment_method = ?'; params.push(paymentMethod); }
  if (search) { sql += ' AND (order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  sql += ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?';
  params.push(Number(limit) || 50, Number(offset) || 0);

  const orders = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
  res.json({ orders, total });
});

ordersRouter.get('/recent', (req, res) => {
  const limit = Number(req.query.limit) || 15;
  const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC, id DESC LIMIT ?').all(limit);
  res.json({ orders: rows });
});

ordersRouter.get('/:id', (req, res) => {
  const order = orderWithItems(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ order });
});

// ── Status / payment ──────────────────────────────────────────────────────────

ordersRouter.put('/:id/status', requireAtLeast('manager'), (req, res) => {
  const { status } = req.body ?? {};
  const allowed = ['pending', 'preparing', 'ready', 'completed', 'cancelled', 'refunded'];
  if (!allowed.includes(status)) return res.status(400).json({ error: `status must be one of ${allowed.join(', ')}` });

  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Order not found' });

  // Restock if cancelling/refunding a completed order
  if ((status === 'cancelled' || status === 'refunded') && existing.status === 'completed') {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(existing.id);
    const restock = db.prepare('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?');
    for (const it of items) {
      restock.run(it.quantity, it.product_id);
      db.prepare('INSERT INTO stock_movements (product_id, user_id, action, qty_delta, note) VALUES (?, ?, ?, ?, ?)')
        .run(it.product_id, req.user.id, 'RETURN', it.quantity, `Refund ${existing.order_number}`);
    }
  }

  db.prepare('UPDATE orders SET status = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(status, existing.id);
  const order = orderWithItems(db.prepare('SELECT * FROM orders WHERE id = ?').get(existing.id));
  broadcast('order:updated', { order });
  res.json({ order });
});

ordersRouter.post('/:id/pay', requireAtLeast('manager'), (req, res) => {
  const { method, amount } = req.body ?? {};
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Order not found' });

  const paid = amount != null ? Number(amount) : existing.total_amount;
  const paymentStatus = paid >= existing.total_amount ? 'paid' : 'partial';
  db.prepare('UPDATE orders SET payment_method = ?, payment_status = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
    .run(method || existing.payment_method, paymentStatus, existing.id);

  res.json({ order: orderWithItems(db.prepare('SELECT * FROM orders WHERE id = ?').get(existing.id)) });
});

// ── Receipt ───────────────────────────────────────────────────────────────────

export function buildReceipt(order, settings = getSettings()) {
  const lines = [];
  const w = 32; // receipt character width
  const rule = '-'.repeat(w);

  lines.push(settings.shop_name.toUpperCase().padStart((w + settings.shop_name.length) / 2));
  if (settings.shop_address) lines.push(settings.shop_address);
  if (settings.shop_phone) lines.push(`Tel: ${settings.shop_phone}`);
  if (settings.gstin) lines.push(`GSTIN: ${settings.gstin}`);
  lines.push(rule);
  lines.push(`Bill: ${order.order_number}`);
  lines.push(`Date: ${order.created_at}`);
  lines.push(`Cashier: ${order.user_id ?? '-'}`);
  lines.push(rule);

  for (const it of order.items) {
    lines.push(it.product_name);
    lines.push(`  ${it.quantity} x ${settings.currency}${Number(it.unit_price).toFixed(2)}  ${settings.currency}${Number(it.line_total).toFixed(2)}`);
  }
  lines.push(rule);
  lines.push(`Subtotal${' '.repeat(w - 8 - String(Number(order.subtotal).toFixed(2)).length)}${settings.currency}${Number(order.subtotal).toFixed(2)}`);
  lines.push(`Tax${' '.repeat(w - 3 - String(Number(order.tax_amount).toFixed(2)).length)}${settings.currency}${Number(order.tax_amount).toFixed(2)}`);
  if (Number(order.discount_amount) > 0) {
    lines.push(`Discount${' '.repeat(w - 8 - String(Number(order.discount_amount).toFixed(2)).length)}-${settings.currency}${Number(order.discount_amount).toFixed(2)}`);
  }
  lines.push(`TOTAL${' '.repeat(w - 5 - String(Number(order.total_amount).toFixed(2)).length)}${settings.currency}${Number(order.total_amount).toFixed(2)}`);
  lines.push(`Paid via: ${order.payment_method}`);
  lines.push(rule);
  lines.push(settings.receipt_footer);
  lines.push('');
  lines.push('');

  return { orderNumber: order.order_number, text: lines.join('\n'), lines };
}

ordersRouter.get('/:id/bill', (req, res) => {
  const order = orderWithItems(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(buildReceipt(order));
});
