import { useEffect, useState } from 'react';
import { api, money } from '../lib/api';
import { StatCard, Spinner } from '../components/ui';

export default function Reports() {
  const [daily, setDaily] = useState(null);
  const [perf, setPerf] = useState([]);
  const [valuation, setValuation] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  // Accepts overrides so the range select can reload with the NEW days value
  // immediately — otherwise the closure reads the stale previous value.
  const load = (overrides = {}) => {
    setLoading(true);
    api('/reports/daily-sales', { params: { date } }).then(setDaily).catch(() => {});
    api('/reports/product-performance', { params: { days, ...overrides } }).then((d) => setPerf(d.products)).catch(() => {});
    api('/reports/inventory-valuation').then(setValuation).catch(() => {});
    setLoading(false);
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !daily) return <Spinner text="Crunching numbers…" />;

  return (
    <div className="space-y-5 animate-fadeUp">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-mist">Reports</h1>
          <p className="text-xs text-mist-faint mt-0.5">Daily sales · product performance · inventory value</p>
        </div>
        <div className="flex gap-2">
          <input className="input !w-40" type="date" value={date} onChange={(e) => setDate(e.target.value)} onBlur={load} />
          <button className="btn-ghost" onClick={load}>Run</button>
        </div>
      </div>

      {daily && (
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
          <StatCard label="Revenue" value={money(daily.total)} sub={daily.date} tone="text-accent-light" />
          <StatCard label="Transactions" value={daily.transactions} />
          <StatCard label="Avg ticket" value={money(daily.avgTicket)} />
          <StatCard label="Tax collected" value={money(daily.tax)} />
          <StatCard label="Discounts given" value={money(daily.discounts)} tone="text-good" />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Payment breakdown */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-mist mb-4">Payment breakdown</h2>
          {daily?.paymentBreakdown.length ? (
            <div className="space-y-3">
              {daily.paymentBreakdown.map((p) => (
                <div key={p.method} className="flex items-center justify-between">
                  <span className="text-[13px] text-mist">{p.method}</span>
                  <span className="text-[13px] text-mist-dim">{p.count} × {money(p.total)}</span>
                </div>
              ))}
            </div>
          ) : <div className="text-xs text-mist-faint py-6 text-center">No sales on this day</div>}
        </div>

        {/* Inventory valuation */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-mist mb-4">Inventory value</h2>
          {valuation && (
            <div className="space-y-3">
              {[
                ['Products', valuation.productCount],
                ['Total units', valuation.totalUnits],
                ['At cost', money(valuation.costValue)],
                ['At sale price', money(valuation.saleValue)],
                ['Potential profit', money(valuation.potentialProfit)],
              ].map(([l, v]) => (
                <div key={l} className="flex items-center justify-between">
                  <span className="text-[13px] text-mist-dim">{l}</span>
                  <span className="text-[13px] font-semibold text-mist">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top products */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-mist">Top products</h2>
            <select className="input !w-24 !py-1 text-xs" value={days} onChange={(e) => { const v = Number(e.target.value); setDays(v); load({ days: v }); }}>
              <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option>
            </select>
          </div>
          <div className="space-y-2.5">
            {perf.slice(0, 6).map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="w-5 text-center text-xs font-bold text-mist-faint">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-mist truncate">{p.name}</div>
                  <div className="text-[11px] text-mist-faint">{p.units_sold} units · {money(p.revenue)}</div>
                </div>
                <span className={`badge ${p.margin >= 30 ? 'bg-good/15 text-good' : p.margin >= 15 ? 'bg-warn/15 text-warn' : 'bg-bad/15 text-bad'}`}>{p.margin}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full performance table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-border"><h2 className="text-sm font-semibold text-mist">Product performance</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-ink-lighter/60">
              <tr><th className="th">Product</th><th className="th">Category</th><th className="th">Units sold</th><th className="th">Revenue</th><th className="th">Profit</th><th className="th">Margin</th><th className="th">Stock</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-border">
              {perf.map((p) => (
                <tr key={p.id} className="hover:bg-ink-lighter/40 transition-colors">
                  <td className="td text-mist font-medium">{p.name}</td>
                  <td className="td text-mist-faint">{p.category_name || '—'}</td>
                  <td className="td font-mono">{p.units_sold}</td>
                  <td className="td font-semibold text-accent-light">{money(p.revenue)}</td>
                  <td className={`td font-semibold ${p.profit >= 0 ? 'text-good' : 'text-bad'}`}>{money(p.profit)}</td>
                  <td className="td"><span className={`badge ${p.margin >= 30 ? 'bg-good/15 text-good' : p.margin >= 15 ? 'bg-warn/15 text-warn' : 'bg-bad/15 text-bad'}`}>{p.margin}%</span></td>
                  <td className="td"><span className={`badge ${p.stock_qty <= p.reorder_threshold ? 'bg-warn/15 text-warn' : 'bg-ink-border2 text-mist-dim'}`}>{p.stock_qty}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
