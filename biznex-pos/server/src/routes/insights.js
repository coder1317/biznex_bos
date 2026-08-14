import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { localDate } from '../util.js';

export const insightsRouter = Router();
insightsRouter.use(requireAuth);

// ── Dashboard ─────────────────────────────────────────────────────────────────

insightsRouter.get('/dashboard', (_req, res) => {
  const today = localDate();
  const todayStart = `${today} 00:00:00`;
  const todayEnd = `${today} 23:59:59`;

  const todayRow = db.prepare(`
    SELECT COUNT(*) AS orders, COALESCE(SUM(total_amount), 0) AS revenue,
           COALESCE(AVG(total_amount), 0) AS avg_ticket
    FROM orders WHERE created_at >= ? AND created_at <= ? AND status != 'cancelled'
  `).get(todayStart, todayEnd);

  const monthStart = `${today.slice(0, 8)}01 00:00:00`;
  const monthRow = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) AS revenue FROM orders
    WHERE created_at >= ? AND status != 'cancelled'
  `).get(monthStart);

  const lowStock = db.prepare('SELECT COUNT(*) AS c FROM products WHERE is_active = 1 AND stock_qty <= reorder_threshold').get().c;
  const activeStaff = db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_active = 1 AND role != \'owner\'').get().c;

  const paymentBreakdown = db.prepare(`
    SELECT payment_method AS method, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total
    FROM orders WHERE created_at >= ? AND created_at <= ? AND status != 'cancelled'
    GROUP BY payment_method
  `).all(todayStart, todayEnd);

  const hourly = db.prepare(`
    SELECT CAST(strftime('%H', created_at) AS INTEGER) AS hour, COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*) AS orders
    FROM orders WHERE created_at >= ? AND created_at <= ?
    GROUP BY hour ORDER BY hour
  `).all(todayStart, todayEnd);

  const recentOrders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC, id DESC LIMIT 10').all();

  res.json({
    today: {
      orders: todayRow.orders,
      revenue: Math.round(todayRow.revenue * 100) / 100,
      avgTicket: Math.round(todayRow.avg_ticket * 100) / 100,
    },
    monthRevenue: Math.round(monthRow.revenue * 100) / 100,
    lowStockCount: lowStock,
    activeStaffCount: activeStaff,
    paymentBreakdown,
    hourly,
    recentOrders,
  });
});

insightsRouter.get('/sales-range', (req, res) => {
  const days = Math.min(Number(req.query.days) || 7, 90);
  const now = new Date();
  const start = localDate(new Date(now.getTime() - (days - 1) * 86400_000));

  const rows = db.prepare(`
    SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS orders, COALESCE(SUM(total_amount), 0) AS revenue
    FROM orders WHERE created_at >= ? AND status != 'cancelled'
    GROUP BY day ORDER BY day
  `).all(`${start} 00:00:00`);

  // Fill missing days with zeros
  const map = new Map(rows.map((r) => [r.day, r]));
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = localDate(new Date(now.getTime() - i * 86400_000));
    const row = map.get(d);
    series.push({ day: d, revenue: Math.round((row?.revenue ?? 0) * 100) / 100, orders: row?.orders ?? 0 });
  }
  res.json({ series });
});

// ── Reports ───────────────────────────────────────────────────────────────────

insightsRouter.get('/reports/daily-sales', (req, res) => {
  const date = req.query.date || localDate();
  const start = `${date} 00:00:00`;
  const end = `${date} 23:59:59`;

  const row = db.prepare(`
    SELECT COUNT(*) AS transactions, COALESCE(SUM(total_amount), 0) AS total,
           COALESCE(SUM(subtotal), 0) AS subtotal, COALESCE(SUM(tax_amount), 0) AS tax,
           COALESCE(SUM(discount_amount), 0) AS discounts, COALESCE(AVG(total_amount), 0) AS avg_ticket
    FROM orders WHERE created_at >= ? AND created_at <= ? AND status != 'cancelled'
  `).get(start, end);

  const breakdown = db.prepare(`
    SELECT payment_method AS method, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total
    FROM orders WHERE created_at >= ? AND created_at <= ? AND status != 'cancelled'
    GROUP BY payment_method
  `).all(start, end);

  res.json({ date, ...row, avgTicket: Math.round(row.avg_ticket * 100) / 100, paymentBreakdown: breakdown });
});

insightsRouter.get('/reports/product-performance', (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365);
  const start = localDate(new Date(Date.now() - (days - 1) * 86400_000));

  const rows = db.prepare(`
    SELECT p.id, p.name, p.sku, p.category_id, c.name AS category_name,
           p.cost_price, p.sale_price, p.stock_qty, p.reorder_threshold,
           COALESCE(SUM(oi.quantity), 0) AS units_sold,
           COALESCE(SUM(oi.line_total), 0) AS revenue
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN order_items oi ON oi.product_id = p.id
    LEFT JOIN orders o ON o.id = oi.order_id AND o.created_at >= ? AND o.status != 'cancelled'
    WHERE p.is_active = 1
    GROUP BY p.id ORDER BY units_sold DESC
  `).all(`${start} 00:00:00`);

  res.json({
    products: rows.map((r) => ({
      ...r,
      revenue: Math.round(r.revenue * 100) / 100,
      profit: Math.round((r.revenue - r.units_sold * r.cost_price) * 100) / 100,
      margin: r.revenue > 0 ? Math.round(((r.revenue - r.units_sold * r.cost_price) / r.revenue) * 100) / 100 : 0,
    })),
  });
});

insightsRouter.get('/reports/inventory-valuation', (_req, res) => {
  const row = db.prepare(`
    SELECT COUNT(*) AS product_count, COALESCE(SUM(stock_qty), 0) AS total_units,
           COALESCE(SUM(stock_qty * cost_price), 0) AS cost_value,
           COALESCE(SUM(stock_qty * sale_price), 0) AS sale_value
    FROM products WHERE is_active = 1
  `).get();
  res.json({
    productCount: row.product_count,
    totalUnits: row.total_units,
    costValue: Math.round(row.cost_value * 100) / 100,
    saleValue: Math.round(row.sale_value * 100) / 100,
    potentialProfit: Math.round((row.sale_value - row.cost_value) * 100) / 100,
  });
});

insightsRouter.get('/reports/shift-summary', (req, res) => {
  const date = req.query.date || localDate();
  const rows = db.prepare(`
    SELECT u.id, u.name, u.role, s.clock_in_at, s.clock_out_at, s.sales_count, s.status
    FROM shifts s JOIN users u ON u.id = s.user_id
    WHERE s.clock_in_at >= ? ORDER BY s.clock_in_at
  `).all(`${date} 00:00:00`);
  res.json({ shifts: rows });
});
