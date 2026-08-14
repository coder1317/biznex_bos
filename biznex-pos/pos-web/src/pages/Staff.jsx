import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Modal, Spinner, useToast, EmptyState } from '../components/ui';

const ROLE_BADGE = {
  owner: 'bg-accent/20 text-accent-light',
  admin: 'bg-purple-500/20 text-purple-300',
  manager: 'bg-cyan-500/20 text-cyan-300',
  cashier: 'bg-mist-faint/20 text-mist-dim',
};

export default function Staff() {
  const { can } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showShifts, setShowShifts] = useState(false);

  const load = () => {
    api('/users').then((d) => setUsers(d.users)).catch(() => {});
    api('/users/shifts').then((d) => setShifts(d.shifts)).catch(() => {});
  };
  useEffect(() => { load(); setLoading(false); }, []);

  const save = async (form) => {
    try {
      if (editing?.id) {
        await api(`/users/${editing.id}`, { method: 'PUT', body: { name: form.name, role: form.role, isActive: form.isActive, password: form.password || undefined } });
        toast('User updated');
      } else {
        await api('/users', { method: 'POST', body: { name: form.name, username: form.username, password: form.password, role: form.role } });
        toast('User created');
      }
      setEditing(null);
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const remove = async (u) => {
    if (!confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    try { await api(`/users/${u.id}`, { method: 'DELETE' }); toast('User removed'); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="space-y-5 animate-fadeUp">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-mist">Staff</h1>
          <p className="text-xs text-mist-faint mt-0.5">{users.length} team members · {users.filter((u) => u.isActive).length} active</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setShowShifts(true)}>Shift log</button>
          {can('admin') && <button className="btn-primary" onClick={() => setEditing({})}>+ Add staff</button>}
        </div>
      </div>

      {loading ? <Spinner /> : users.length === 0 ? <EmptyState icon="👥" title="No staff yet" /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-ink-lighter/60">
                <tr><th className="th">Name</th><th className="th">Username</th><th className="th">Role</th><th className="th">Status</th><th className="th text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-ink-lighter/40 transition-colors">
                    <td className="td font-medium text-mist">{u.name}</td>
                    <td className="td font-mono text-mist-faint text-xs">{u.username}</td>
                    <td className="td"><span className={`badge capitalize ${ROLE_BADGE[u.role]}`}>{u.role}</span></td>
                    <td className="td"><span className={`badge ${u.isActive ? 'bg-good/15 text-good' : 'bg-mist-faint/15 text-mist-faint'}`}>{u.isActive ? 'Active' : 'Disabled'}</span></td>
                    <td className="td text-right">
                      {can('admin') && (
                        <div className="flex justify-end gap-1.5">
                          <button className="btn-ghost !px-2.5 !py-1 text-xs" onClick={() => setEditing(u)}>Edit</button>
                          {u.role !== 'owner' && <button className="btn-danger !px-2.5 !py-1 text-xs" onClick={() => remove(u)}>Delete</button>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? `Edit — ${editing.name}` : 'Add staff member'}>
        <StaffForm key={editing?.id || 'new'} initial={editing || {}} onSave={save} onCancel={() => setEditing(null)} />
      </Modal>

      <Modal open={showShifts} onClose={() => setShowShifts(false)} title="Shift log" width="max-w-2xl">
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full">
            <thead><tr><th className="th">Staff</th><th className="th">Clock in</th><th className="th">Clock out</th><th className="th">Sales</th><th className="th">Status</th></tr></thead>
            <tbody className="divide-y divide-ink-border">
              {shifts.map((s) => (
                <tr key={s.id}>
                  <td className="td text-mist">{s.user_name}</td>
                  <td className="td text-mist-faint text-xs">{s.clock_in_at}</td>
                  <td className="td text-mist-faint text-xs">{s.clock_out_at || '—'}</td>
                  <td className="td font-mono">{s.sales_count}</td>
                  <td className="td"><span className={`badge ${s.status === 'ACTIVE' ? 'bg-good/15 text-good' : 'bg-mist-faint/15 text-mist-faint'}`}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}

function StaffForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    username: initial.username || '',
    password: '',
    role: initial.role || 'cashier',
    isActive: initial.isActive ?? true,
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div><label className="label">Full name *</label><input className="input" value={form.name} onChange={set('name')} required autoFocus /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Username *</label><input className="input" value={form.username} onChange={set('username')} required disabled={!!initial.id} /></div>
        <div>
          <label className="label">{initial.id ? 'New password' : 'Password *'}</label>
          <input className="input" type="password" value={form.password} onChange={set('password')} required={!initial.id} minLength={6} placeholder={initial.id ? 'leave blank to keep' : ''} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <label className="label">Role</label>
          <select className="input" value={form.role} onChange={set('role')}>
            <option value="cashier">Cashier</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
            {!initial.id && <option value="owner">Owner</option>}
          </select>
        </div>
        {initial.id && (
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.isActive ? '1' : '0'} onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })}>
              <option value="1">Active</option>
              <option value="0">Disabled</option>
            </select>
          </div>
        )}
      </div>
      <div className="flex gap-2 pt-2">
        <button className="btn-primary flex-1" type="submit">{initial.id ? 'Save changes' : 'Create staff'}</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
