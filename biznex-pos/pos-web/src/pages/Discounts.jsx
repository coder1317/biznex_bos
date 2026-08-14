import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Modal, Spinner, useToast, EmptyState } from '../components/ui';

export default function Discounts() {
  const { can } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = () => api('/discounts').then((d) => setItems(d.discounts)).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load().finally(() => setLoading(false)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (form) => {
    try {
      if (editing?.id) {
        await api(`/discounts/${editing.id}`, { method: 'PUT', body: { type: form.type, value: Number(form.value), isActive: form.isActive, expiresAt: form.expiresAt || null } });
        toast('Discount updated');
      } else {
        await api('/discounts', { method: 'POST', body: { code: form.code, type: form.type, value: Number(form.value), expiresAt: form.expiresAt || null } });
        toast('Discount created');
      }
      setEditing(null);
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const toggle = async (d) => {
    await api(`/discounts/${d.id}`, { method: 'PUT', body: { isActive: !d.is_active } });
    load();
  };

  return (
    <div className="space-y-5 animate-fadeUp">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-mist">Discounts</h1>
          <p className="text-xs text-mist-faint mt-0.5">{items.filter((d) => d.is_active).length} active codes</p>
        </div>
        {can('manager') && <button className="btn-primary" onClick={() => setEditing({})}>+ New discount code</button>}
      </div>

      {loading ? <Spinner /> : items.length === 0 ? <EmptyState icon="🏷️" title="No discount codes" sub="Create codes like SAVE10 to give percentage or fixed discounts at checkout." /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((d) => (
            <div key={d.id} className="card p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-accent-light text-sm">{d.code}</span>
                <button onClick={() => toggle(d)} className={`text-[11px] font-semibold badge ${d.is_active ? 'bg-good/15 text-good' : 'bg-mist-faint/15 text-mist-faint'}`}>
                  {d.is_active ? 'Active' : 'Disabled'}
                </button>
              </div>
              <div className="mt-2 text-2xl font-bold text-mist">
                {d.type === 'percentage' ? `${d.value}%` : `₹${d.value}`}
                <span className="text-xs font-normal text-mist-faint ml-1.5">{d.type === 'percentage' ? 'off' : 'off'}</span>
              </div>
              <div className="mt-1 text-[11px] text-mist-faint">{d.expires_at ? `Expires ${d.expires_at}` : 'No expiry'}</div>
              <div className="mt-3 flex gap-2">
                {can('manager') && <button className="btn-ghost !py-1 text-xs flex-1" onClick={() => setEditing(d)}>Edit</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? `Edit — ${editing.code}` : 'New discount code'}>
        <DiscountForm key={editing?.id || 'new'} initial={editing || {}} onSave={save} onCancel={() => setEditing(null)} />
      </Modal>
    </div>
  );
}

function DiscountForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    code: initial.code || '',
    type: initial.type || 'percentage',
    value: initial.value ?? '',
    expiresAt: initial.expires_at ? initial.expires_at.slice(0, 10) : '',
    isActive: initial.is_active ?? true,
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Code *</label><input className="input font-mono uppercase" value={form.code} onChange={set('code')} required disabled={!!initial.id} placeholder="SAVE10" autoFocus /></div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={form.type} onChange={set('type')}>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed (₹)</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Value *</label><input className="input" type="number" step="0.01" min="0" value={form.value} onChange={set('value')} required /></div>
        <div><label className="label">Expires (optional)</label><input className="input" type="date" value={form.expiresAt} onChange={set('expiresAt')} /></div>
      </div>
      <div className="flex gap-2 pt-2">
        <button className="btn-primary flex-1" type="submit">{initial.id ? 'Save changes' : 'Create code'}</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
