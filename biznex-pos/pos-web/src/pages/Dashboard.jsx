import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money } from '../lib/api';
import { StatCard, Spinner, EmptyState } from '../components/ui';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [range, setRange] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/dashboard').then(setData).catch((e) => setError(e.message));
    api('/sales-range?days=7').then((d) => setRange(d.series)).catch(() => {});
  }, []);

  if (error) return <EmptyState title="Could not load dashboard" sub={error} />;
  if (!data) return <Spinner text="Loading dashboard…" />;

  const max = Math.max(...range.map((r) => r.revenue), 1);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-5 animate-fadeUp">
      <div>
        <h1 className="text-lg font-bold text-mist">Dashboard</h1>
        <p className="text-xs text-mist-faint mt-0.5">Your store at a glance</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Today's revenue" value={money(data.today.revenue)} sub="excludes cancelled" tone="text-accent-light" />
        <StatCard label="Orders today" value={data.today.orders} sub={`avg ticket ${money(data.today.avgTicket)}`} />
        <StatCard label="This month" value={money(data.monthRevenue)} sub="total revenue" tone="text-good" />
        <StatCard label="Low stock" value={data.lowStockCount} sub={`${data.activeStaffCount} active staff`} tone={data.lowStockCount > 0 ? 'text-warn' : 'text-mist'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <div className="card p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-mist">Revenue — last 7 days</h2>
            <div className="flex gap-1">
              {[7, 30].map((d) => (
                <button key={d} onClick={() => api(`/sales-range?days=${d}`).then((r) => setRange(r.series))}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${range.length === d ? 'bg-accent/20 text-accent-light' : 'text-mist-faint hover:text-mist'}`}>
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <BarChart data={range} max={max} money={money} days={days} />
        </div>

        {/* Payment breakdown */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-mist mb-4">Payments today</h2>
          {data.paymentBreakdown.length === 0 ? (
            <div className="text-xs text-mist-faint py-8 text-center">No sales yet today</div>
          ) : (
            <div className="space-y-3">
              {data.paymentBreakdown.map((p) => {
                const pct = data.today.revenue > 0 ? (p.total / data.today.revenue) * 100 : 0;
                return (
                  <div key={p.method}>
                    <div className="flex justify-between text-[13px] mb-1">
                      <span className="text-mist">{p.method}</span>
                      <span className="text-mist-dim">{money(p.total)} <span className="text-mist-faint">· {p.count}</span></span>
                    </div>
                    <div className="h-1.5 rounded-full bg-ink-lighter overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-accent to-purple-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-border">
          <h2 className="text-sm font-semibold text-mist">Recent orders</h2>
          <Link to="/orders" className="text-xs text-accent-light hover:underline">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-ink-lighter/60">
              <tr>
                <th className="th">Order</th>
                <th className="th">Time</th>
                <th className="th">Type</th>
                <th className="th">Payment</th>
                <th className="th text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-border">
              {data.recentOrders.map((o) => (
                <tr key={o.id} className="hover:bg-ink-lighter/40 transition-colors">
                  <td className="td font-mono text-accent-light">{o.order_number}</td>
                  <td className="td text-mist-faint">{o.created_at}</td>
                  <td className="td capitalize">{o.order_type.replace('_', ' ')}</td>
                  <td className="td"><span className="badge bg-ink-border2 text-mist-dim">{o.payment_method}</span></td>
                  <td className="td text-right font-semibold">{money(o.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BarChart({ data, max, money, days }) {
  if (data.length === 0) return <div className="text-xs text-mist-faint py-10 text-center">No data yet</div>;
  const W = 640;
  const H = 200;
  const pad = 8;
  const bw = (W - pad * 2) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={pad} x2={W - pad} y1={H - H * f} y2={H - H * f} stroke="#1e2536" strokeWidth="1" strokeDasharray="3 4" />
      ))}
      {data.map((d, i) => {
        const h = Math.max(2, (d.revenue / max) * (H - 34));
        const x = pad + i * bw + bw * 0.18;
        const y = H - 26 - h;
        const label = new Date(d.day + 'T00:00:00').getDay();
        return (
          <g key={d.day}>
            <title>{`${d.day} — ${money(d.revenue)} (${d.orders} orders)`}</title>
            <rect x={x} y={y} width={bw * 0.64} height={h} rx="4" className="fill-accent/80 hover:fill-accent-light transition-all" />
            <text x={x + bw * 0.32} y={H - 12} textAnchor="middle" fontSize="10" fill="#5d6880">{days[label]}</text>
          </g>
        );
      })}
    </svg>
  );
}
