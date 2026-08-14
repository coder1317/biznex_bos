import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Modal, Spinner, useToast, EmptyState } from '../components/ui';

const SEVERITY = {
  Low: 'bg-cyan-500/15 text-cyan-300',
  Normal: 'bg-warn/15 text-warn',
  High: 'bg-bad/15 text-bad',
};
const STATUS = {
  Submitted: 'bg-mist-faint/15 text-mist-dim',
  'In Progress': 'bg-accent/15 text-accent-light',
  Resolved: 'bg-good/15 text-good',
};

export default function Complaints() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [tab, setTab] = useState('all');

  const load = () => api('/complaints').then((d) => setItems(d.complaints)).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load().finally(() => setLoading(false)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async (form) => {
    try {
      await api('/complaints', { method: 'POST', body: form });
      toast('Complaint filed');
      setComposing(false);
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const update = async (c, patch) => {
    await api(`/complaints/${c.id}`, { method: 'PUT', body: patch });
    load();
  };

  const filtered = items.filter((c) => tab === 'all' || c.status === tab);
  const counts = {
    all: items.length,
    Submitted: items.filter((c) => c.status === 'Submitted').length,
    'In Progress': items.filter((c) => c.status === 'In Progress').length,
    Resolved: items.filter((c) => c.status === 'Resolved').length,
  };

  return (
    <div className="space-y-5 animate-fadeUp">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-mist">Complaints</h1>
          <p className="text-xs text-mist-faint mt-0.5">{counts['Submitted'] + counts['In Progress']} open</p>
        </div>
        <button className="btn-primary" onClick={() => setComposing(true)}>+ File complaint</button>
      </div>

      <div className="flex gap-1.5">
        {Object.entries(counts).map(([k, v]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === k ? 'bg-accent text-white' : 'bg-ink-lighter text-mist-dim hover:text-mist border border-ink-border'}`}>
            {k === 'all' ? 'All' : k} <span className="opacity-70">({v})</span>
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? <EmptyState icon="💬" title="No complaints" sub="Nothing here — great!" /> : (
        <div className="space-y-2.5">
          {filtered.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-mist">{c.title}</span>
                    <span className={`badge ${SEVERITY[c.severity]}`}>{c.severity}</span>
                    <span className={`badge ${STATUS[c.status]}`}>{c.status}</span>
                  </div>
                  <p className="text-[13px] text-mist-dim mt-1.5 leading-relaxed">{c.description}</p>
                  <div className="text-[11px] text-mist-faint mt-2">{c.user_name || '—'} · {c.created_at}</div>
                </div>
                <select
                  className="input !w-32 !py-1.5 text-xs shrink-0"
                  value={c.status}
                  onChange={(e) => update(c, { status: e.target.value })}
                >
                  <option value="Submitted">Submitted</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={composing} onClose={() => setComposing(false)} title="File a complaint">
        <ComplaintForm onSave={create} onCancel={() => setComposing(false)} />
      </Modal>
    </div>
  );
}

function ComplaintForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ title: '', description: '', severity: 'Normal' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div><label className="label">Title *</label><input className="input" value={form.title} onChange={set('title')} required autoFocus placeholder="e.g. Card machine not working" /></div>
      <div><label className="label">Description *</label><textarea className="input min-h-[90px] resize-y" value={form.description} onChange={set('description')} required placeholder="What happened?" /></div>
      <div>
        <label className="label">Severity</label>
        <select className="input" value={form.severity} onChange={set('severity')}>
          <option>Low</option><option>Normal</option><option>High</option>
        </select>
      </div>
      <div className="flex gap-2 pt-2">
        <button className="btn-primary flex-1" type="submit">File complaint</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
