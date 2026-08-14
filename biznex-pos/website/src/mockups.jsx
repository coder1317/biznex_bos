// Pure-CSS product mockups so the site shows the real product without images.

const PROD = [
  ['🍟', 'Potato Chips', '₹25', '80', 'good'],
  ['🥛', 'Fresh Milk 500ml', '₹30', '40', 'good'],
  ['🍪', 'Parle-G Biscuit', '₹30', '80', 'warn'],
  ['🥤', 'Cold Drink 750ml', '₹45', '48', 'good'],
  ['🍚', 'Rice 1kg', '₹78', '60', 'good'],
  ['🧼', 'Bath Soap 75g', '₹35', '90', 'good'],
  ['🍵', 'Tea Powder 250g', '₹135', '20', 'warn'],
  ['🪥', 'Toothpaste 100g', '₹60', '40', 'good'],
];

export function PosMockup({ tall = false }) {
  return (
    <div className="card-surface glow overflow-hidden">
      {/* window bar */}
      <div className="flex items-center gap-2 border-b border-ink-border bg-ink-light px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-bad/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-warn/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-good/70" />
        <div className="ml-3 flex-1 rounded-md bg-ink px-3 py-1 text-[11px] text-mist-faint">🔍 Search products, SKU or barcode…</div>
        <div className="hidden sm:flex items-center gap-1.5 rounded-md border border-ink-border px-2.5 py-1 text-[10px] text-good">
          <span className="h-1.5 w-1.5 rounded-full bg-good animate-pulse" /> Online
        </div>
      </div>
      <div className="flex">
        {/* product grid */}
        <div className={`flex-1 p-3 ${tall ? 'grid grid-cols-3 gap-2' : 'hidden sm:grid grid-cols-2 gap-2'}`}>
          {PROD.map(([e, name, price, stock, tone]) => (
            <div key={name} className="rounded-lg border border-ink-border bg-ink-card p-2.5 hover:border-accent/50 transition-colors">
              <div className="flex items-start justify-between">
                <span className="text-base">{e}</span>
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${tone === 'warn' ? 'bg-warn/15 text-warn' : 'bg-good/15 text-good'}`}>{stock}</span>
              </div>
              <div className="mt-1.5 text-[11px] font-semibold text-mist leading-tight">{name}</div>
              <div className="mt-1 text-[12px] font-extrabold text-accent-light">{price}</div>
            </div>
          ))}
          {tall && (
            <>
              {PROD.slice(0, 4).map(([e, name, price, stock]) => (
                <div key={name + 'b'} className="rounded-lg border border-ink-border bg-ink-card p-2.5">
                  <div className="flex items-start justify-between"><span className="text-base">{e}</span><span className="rounded bg-good/15 px-1.5 py-0.5 text-[9px] font-bold text-good">{stock}</span></div>
                  <div className="mt-1.5 text-[11px] font-semibold text-mist leading-tight">{name}</div>
                  <div className="mt-1 text-[12px] font-extrabold text-accent-light">{price}</div>
                </div>
              ))}
            </>
          )}
        </div>
        {/* cart */}
        <div className="w-36 sm:w-44 shrink-0 border-l border-ink-border bg-ink-light/60 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-mist-faint">Order</span>
            <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold text-accent-light">3 items</span>
          </div>
          <div className="mt-3 space-y-2">
            {[
              ['🥤', 'Cold Drink', '₹45'],
              ['🍪', 'Parle-G', '₹30'],
              ['🍚', 'Rice 1kg', '₹78'],
            ].map(([e, n, p]) => (
              <div key={n} className="flex items-center gap-1.5">
                <span className="text-sm">{e}</span>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-[10px] font-medium text-mist">{n}</div>
                  <div className="text-[9px] text-mist-faint">1 × {p}</div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-3.5 w-3.5 rounded bg-ink-border2 text-center text-[9px] leading-none text-mist-faint">−</span>
                  <span className="text-[9px] text-mist">1</span>
                  <span className="h-3.5 w-3.5 rounded bg-accent/30 text-center text-[9px] leading-none text-accent-light">+</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-ink-border pt-2 space-y-1">
            {[['Subtotal', '₹153'], ['Tax', '₹12.40'], ['Total', '₹165.40']].map(([l, v], i) => (
              <div key={l} className={`flex justify-between ${i === 2 ? 'text-[11px] font-extrabold text-accent-light' : 'text-[9px] text-mist-faint'}`}>
                <span>{l}</span><span>{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            {['CASH', 'UPI'].map((m) => (
              <div key={m} className={`rounded border py-1 text-center text-[8px] font-bold ${m === 'UPI' ? 'border-accent/60 bg-accent/15 text-accent-light' : 'border-ink-border2 text-mist-faint'}`}>{m}</div>
            ))}
          </div>
          <div className="mt-2 rounded-md bg-good py-1.5 text-center text-[10px] font-extrabold text-ink-dark">Charge ₹165.40</div>
        </div>
      </div>
    </div>
  );
}

export function PhoneMockup() {
  return (
    <div className="rounded-[2rem] border border-ink-border2 bg-ink-light p-2.5 shadow-2xl">
      <div className="overflow-hidden rounded-[1.6rem] bg-ink">
        {/* notch */}
        <div className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-ink-border2" />
        <div className="p-3.5 pb-5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-mist-faint">Today</div>
          <div className="mt-0.5 text-[13px] font-extrabold text-mist">₹18,240 <span className="text-[9px] font-semibold text-good">+12%</span></div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {[['Orders', '142'], ['Low stock', '3'], ['Avg ticket', '₹128'], ['Staff', '5']].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-ink-border bg-ink-card p-2">
                <div className="text-[7px] font-bold uppercase text-mist-faint">{l}</div>
                <div className="mt-0.5 text-[11px] font-extrabold text-mist">{v}</div>
              </div>
            ))}
          </div>
          {/* mini chart */}
          <div className="mt-2.5 flex h-14 items-end gap-1 rounded-lg border border-ink-border bg-ink-card p-2">
            {[35, 55, 40, 70, 60, 85, 100].map((h, i) => (
              <div key={i} className={`flex-1 rounded-sm ${i === 6 ? 'bg-accent-light' : 'bg-accent/60'}`} style={{ height: `${h}%` }} />
            ))}
          </div>
          {/* recent order */}
          <div className="mt-2.5 rounded-lg border border-ink-border bg-ink-card p-2">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-bold text-accent-light font-mono">BNX-20260814-0042</span>
              <span className="rounded bg-good/15 px-1 text-[7px] font-bold text-good">UPI</span>
            </div>
            <div className="mt-1 flex justify-between text-[8px] text-mist-faint"><span>3 items · 2 min ago</span><span className="font-bold text-mist">₹165.40</span></div>
          </div>
          {/* tab bar */}
          <div className="mt-3 grid grid-cols-5 gap-1 border-t border-ink-border pt-2">
            {[['🏠', true], ['🧾', false], ['📦', false], ['👥', false], ['⚙️', false]].map(([e, on]) => (
              <div key={e} className={`text-center text-[11px] ${on ? 'opacity-100' : 'opacity-40'}`}>{e}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardMock() {
  return (
    <div className="card-surface w-full max-w-3xl overflow-hidden">
      <div className="grid grid-cols-4 gap-3 border-b border-ink-border bg-ink-light/60 p-4">
        {[
          ['Today revenue', '₹18,240', 'accent-light'],
          ['Orders', '142', 'mist'],
          ['Low stock', '3', 'warn'],
          ['Month total', '₹4,82,500', 'good'],
        ].map(([l, v, tone]) => (
          <div key={l} className="text-center sm:text-left">
            <div className="text-[9px] font-bold uppercase tracking-wider text-mist-faint">{l}</div>
            <div className={`mt-0.5 text-sm sm:text-lg font-extrabold ${tone === 'accent-light' ? 'text-accent-light' : tone === 'warn' ? 'text-warn' : tone === 'good' ? 'text-good' : 'text-mist'}`}>{v}</div>
          </div>
        ))}
      </div>
      <div className="flex h-16 items-end gap-1.5 p-4">
        {[30, 45, 38, 62, 55, 78, 70, 90, 84, 100].map((h, i) => (
          <div key={i} className={`flex-1 rounded-t ${i === 9 ? 'bg-accent-light' : 'bg-accent/50'}`} style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}
