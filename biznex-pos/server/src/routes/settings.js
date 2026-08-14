import { Router } from 'express';
import { getSettings, updateSetting } from '../db.js';
import { requireAuth, requireAtLeast } from '../auth.js';
import { broadcast } from '../realtime.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get('/', (_req, res) => {
  res.json({ settings: getSettings() });
});

settingsRouter.put('/', requireAtLeast('admin'), (req, res) => {
  const body = req.body ?? {};
  if (typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Expected an object of key/value settings' });
  }
  const known = new Set(Object.keys(getSettings()));
  for (const [key, value] of Object.entries(body)) {
    if (known.has(key)) updateSetting(key, value);
  }
  const settings = getSettings();
  broadcast('settings:updated', { settings });
  res.json({ settings });
});
