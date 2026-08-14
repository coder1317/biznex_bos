import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireAtLeast } from '../auth.js';
import { broadcast } from '../realtime.js';

export const complaintsRouter = Router();
complaintsRouter.use(requireAuth);

complaintsRouter.get('/', (_req, res) => {
  const rows = db.prepare(`
    SELECT c.*, u.name AS user_name
    FROM complaints c LEFT JOIN users u ON u.id = c.user_id
    ORDER BY c.created_at DESC
  `).all();
  res.json({ complaints: rows });
});

complaintsRouter.post('/', (req, res) => {
  const { title, description, severity = 'Normal' } = req.body ?? {};
  if (!title || !description) return res.status(400).json({ error: 'title and description are required' });
  if (!['Low', 'Normal', 'High'].includes(severity)) {
    return res.status(400).json({ error: 'severity must be Low, Normal or High' });
  }
  const result = db.prepare('INSERT INTO complaints (user_id, title, description, severity) VALUES (?, ?, ?, ?)')
    .run(req.user.id, String(title).trim(), String(description).trim(), severity);
  const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(result.lastInsertRowid);
  broadcast('complaint:created', { complaint });
  res.status(201).json({ complaint });
});

complaintsRouter.put('/:id', requireAtLeast('manager'), (req, res) => {
  const existing = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Complaint not found' });
  const { status, severity } = req.body ?? {};
  const allowed = ['Submitted', 'In Progress', 'Resolved'];
  if (status && !allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  db.prepare('UPDATE complaints SET status = ?, severity = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
    .run(status ?? existing.status, severity ?? existing.severity, existing.id);
  const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(existing.id);
  broadcast('complaint:updated', { complaint });
  res.json({ complaint });
});
