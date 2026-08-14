import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { requireAuth, requireAtLeast, publicUser } from '../auth.js';
import { broadcast } from '../realtime.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

// ── Users (staff) ─────────────────────────────────────────────────────────────

usersRouter.get('/', requireAtLeast('manager'), (_req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at').all().map(publicUser);
  res.json({ users });
});

usersRouter.post('/', requireAtLeast('admin'), (req, res) => {
  const { name, username, password, role } = req.body ?? {};
  if (!name || !username || !password || !role) {
    return res.status(400).json({ error: 'name, username, password and role are required' });
  }
  const roles = ['owner', 'admin', 'manager', 'cashier'];
  if (!roles.includes(role)) return res.status(400).json({ error: `role must be one of ${roles.join(', ')}` });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const result = db.prepare('INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(String(name).trim(), String(username).trim().toLowerCase(), bcrypt.hashSync(password, 10), role);
    res.status(201).json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid)) });
  } catch {
    res.status(409).json({ error: 'Username already exists' });
  }
});

usersRouter.put('/:id', requireAtLeast('admin'), (req, res) => {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'User not found' });
  const { name, role, isActive, password } = req.body ?? {};

  db.prepare('UPDATE users SET name = ?, role = ?, is_active = ? WHERE id = ?')
    .run(name ?? existing.name, role ?? existing.role, isActive === undefined ? existing.is_active : (isActive ? 1 : 0), existing.id);
  if (password) {
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), existing.id);
  }
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id)) });
});

usersRouter.delete('/:id', requireAtLeast('admin'), (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'owner') return res.status(400).json({ error: 'Cannot delete the owner account' });
  db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
  res.json({ ok: true });
});

// ── Shifts ────────────────────────────────────────────────────────────────────

usersRouter.post('/shifts/clock-in', (req, res) => {
  const active = db.prepare('SELECT * FROM shifts WHERE user_id = ? AND status = \'ACTIVE\'').get(req.user.id);
  if (active) return res.json({ shift: active });

  const result = db.prepare('INSERT INTO shifts (user_id) VALUES (?)').run(req.user.id);
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(result.lastInsertRowid);
  broadcast('staff:clocked-in', { userId: req.user.id, shiftId: shift.id });
  res.status(201).json({ shift });
});

usersRouter.post('/shifts/clock-out', (req, res) => {
  const active = db.prepare('SELECT * FROM shifts WHERE user_id = ? AND status = \'ACTIVE\'').get(req.user.id);
  if (!active) return res.status(400).json({ error: 'No active shift' });
  db.prepare('UPDATE shifts SET clock_out_at = datetime(\'now\',\'localtime\'), status = \'CLOSED\' WHERE id = ?').run(active.id);
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(active.id);
  broadcast('staff:clocked-out', { userId: req.user.id, shiftId: shift.id });
  res.json({ shift });
});

usersRouter.get('/shifts', requireAtLeast('manager'), (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, u.name AS user_name
    FROM shifts s JOIN users u ON u.id = s.user_id
    ORDER BY s.clock_in_at DESC LIMIT 200
  `).all();
  res.json({ shifts: rows });
});
