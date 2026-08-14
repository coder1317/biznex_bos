import { useEffect, useState } from 'react';
import { api, money } from '../lib/api';
import { Spinner, Modal, EmptyState, useToast } from '../components/ui';

export default function Orders() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('');
  const [selected, setSelected] = useState(null);

  // Accepts overrides so the payment-method select can reload with the NEW
  // value immediately — otherwise the closure reads the stale previous value
  // and the filter is always one selection behind.
  const load = (overrides = {}) => {
    setLoading(true);
    api('/orders', { params: { search, paymentMethod: method, limit: 100, ...overrides } })
      .then((d) => setOrders(d.orders))
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (id) => {
    const d = await api(`/orders/${id}`);
    setSelected(d.order);
  };

  const print = () => {
    if (!selected) return;
    const w = window.open('', '_blank', 'width=320,height=480');
    if (!w) return toast('Allow pop-ups to print', 'error');
    w.document.write(`<pre style="font-family:monospace;font-size:12px;max-width:300px;margin:16px auto;white-space:pre-wrap">${selected.receipt?.text || ''}</pre>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="space-y-5 animate-fadeUp">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-mist">Orders</h1>
          <p className="text-xs text-mist-faint mt-0.5">{orders.length} shown · {orders.reduce((s, o) => s + Number(o.total_amount), 0).toLocaleString('en-IN')} total</p>
        </div>
        <div className="flex gap-2">
          <input className="input !w-56" placeholder="Search order / customer…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
          <select className="input !w-32" value={method} onChange={(e) => { const v = e.target.value; setMethod(v); load({ paymentMethod: v }); }}>
            <option value="">All payments</option>
            {['CASH', 'UPI', 'CARD', 'QR'].map((m) => <option key={m}>{m}</option>)}
          </select>
          <button className="btn-ghost" onClick={load}>Search</button>
        </div>
      </div>

      {loading ? <Spinner /> : orders.length === 0 ? (
        <EmptyState icon="🧾" title="No orders found" sub="Try clearing the search, or create one from the POS terminal." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-ink-lighter/60">
                <tr>
                  <th className="th">Order</th>
                  <th className="th">Date</th>
                  <th className="th">Type</th>
                  <th className="th">Payment</th>
                  <th className="th">Status</th>
                  <th className="th">Customer</th>
                  <th className="th text-right">Total</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-border">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-ink-lighter/40 transition-colors">
                    <td className="td font-mono text-accent-light">{o.order_number}</td>
                    <td className="td text-mist-faint">{o.created_at}</td>
                    <td className="td capitalize">{o.order_type.replace('_', ' ')}</td>
                    <td className="td"><span className="badge bg-ink-border2 text-mist-dim">{o.payment_method}</span></td>
                    <td className="td"><span className={`badge ${o.status === 'completed' ? 'bg-good/15 text-good' : 'bg-warn/15 text-warn'}`}>{o.status}</span></td>
                    <td className="td text-mist-dim">{o.customer_name || '—'}</td>
                    <td className="td text-right font-semibold">{money(o.total_amount)}</td>
                    <td className="td text-right">
                      <button onClick={() => open(o.id)} className="btn-ghost !px-2.5 !py-1 text-xs">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.order_number} width="max-w-md">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <div className="rounded-lg bg-ink-lighter border border-ink-border p-3"><div className="text-[10px] text-mist-faint uppercase">Total</div><div className="text-lg font-bold text-accent-light mt-0.5">{money(selected.total_amount)}</div></div>
              <div className="rounded-lg bg-ink-lighter border border-ink-border p-3"><div className="text-[10px] text-mist-faint uppercase">Payment</div><div className="text-sm font-semibold text-mist mt-1">{selected.payment_method}</div></div>
            </div>
            <div>
              <div className="text-xs font-semibold text-mist-faint uppercase tracking-wider mb-2">Items</div>
              <div className="space-y-1.5">
                {selected.items.map((it) => (
                  <div key={it.id} className="flex justify-between text-[13px]">
                    <span className="text-mist">{it.product_name} <span className="text-mist-faint">× {it.quantity}</span></span>
                    <span className="text-mist-dim">{money(it.line_total)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-ink-border space-y-1 text-[13px]">
                <div className="flex justify-between text-mist-dim"><span>Subtotal</span><span>{money(selected.subtotal)}</span></div>
                <div className="flex justify-between text-mist-dim"><span>Tax</span><span>{money(selected.tax_amount)}</span></div>
                {Number(selected.discount_amount) > 0 && <div className="flex justify-between text-good"><span>Discount</span><span>−{money(selected.discount_amount)}</span></div>}
                <div className="flex justify-between font-bold text-mist"><span>Total</span><span>{money(selected.total_amount)}</span></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-primary" onClick={print}>Print receipt</button>
              <button className="btn-ghost" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
