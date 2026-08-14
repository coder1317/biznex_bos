import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireAtLeast } from '../auth.js';

export const discountsRouter = Router();
discountsRouter.use(requireAuth);

discountsRouter.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM discounts ORDER BY created_at DESC').all();
  res.json({ discounts: rows });
});

discountsRouter.post('/', requireAtLeast('manager'), (req, res) => {
  const { code, type, value, expiresAt } = req.body ?? {};
  if (!code || !type || value == null) {
    return res.status(400).json({ error: 'code, type and value are required' });
  }
  if (!['percentage', 'fixed'].includes(type)) {
    return res.status(400).json({ error: 'type must be percentage or fixed' });
  }
  try {
    const result = db.prepare('INSERT INTO discounts (code, type, value, expires_at) VALUES (?, ?, ?, ?)')
      .run(String(code).trim().toUpperCase(), type, Number(value), expiresAt || null);
    res.status(201).json({ discount: db.prepare('SELECT * FROM discounts WHERE id = ?').get(result.lastInsertRowid) });
  } catch {
    res.status(409).json({ error: 'Discount code already exists' });
  }
});

discountsRouter.put('/:id', requireAtLeast('manager'), (req, res) => {
  const existing = db.prepare('SELECT * FROM discounts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Discount not found' });
  const { type, value, isActive, expiresAt } = req.body ?? {};

  db.prepare('UPDATE discounts SET type = ?, value = ?, is_active = ?, expires_at = ? WHERE id = ?')
    .run(type ?? existing.type, value ?? existing.value, isActive === undefined ? existing.is_active : (isActive ? 1 : 0),
      expiresAt === undefined ? existing.expires_at : expiresAt, existing.id);

  res.json({ discount: db.prepare('SELECT * FROM discounts WHERE id = ?').get(existing.id) });
});

discountsRouter.delete('/:id', requireAtLeast('admin'), (req, res) => {
  const result = db.prepare('DELETE FROM discounts WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Discount not found' });
  res.json({ ok: true });
});
