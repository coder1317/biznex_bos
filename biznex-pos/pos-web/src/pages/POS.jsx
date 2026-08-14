import { useEffect, useMemo, useRef, useState } from 'react';
import { api, connectRealtime, money } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Spinner, Modal, useToast } from '../components/ui';

const PAY_METHODS = [
  { id: 'CASH', label: 'Cash', icon: 'M11 7h2v2h-2V7zm0 4h2v6h-2v-6zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z' },
  { id: 'UPI', label: 'UPI', icon: 'M21.5 8.5c.28-.28.5-.67.5-1.06V6a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v1.44c0 .39.22.78.5 1.06C3.5 9.53 4.5 11 4.5 12S3.5 14.47 2.5 14.5c-.28.28-.5.67-.5 1.06V18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2.44c0-.39-.22-.78-.5-1.06-.99-.53-2-1.99-2-3.5s1.01-2.97 2-3.5zM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z' },
  { id: 'CARD', label: 'Card', icon: 'M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z' },
  { id: 'QR', label: 'QR', icon: 'M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13-2h-2v3h-2v2h2v2h2v-2h2v-2h-2v-3z' },
];

export default function POS() {
  const { can } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [discountCode, setDiscountCode] = useState('');
  const [orderType, setOrderType] = useState('dine_in');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [charging, setCharging] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [discountError, setDiscountError] = useState('');
  const searchRef = useRef(null);

  const load = () => {
    api('/products').then((d) => setProducts(d.products)).catch(() => {});
    api('/products/categories').then((d) => setCategories(d.categories)).catch(() => {});
    api('/discounts').then((d) => setDiscounts(d.discounts)).catch(() => {});
  };

  useEffect(() => {
    load();
    setLoading(false);
    const off = connectRealtime({
      onEvent: (msg) => {
        if (['inventory:updated', 'product:updated', 'order:created'].includes(msg.type)) load();
      },
    });
    return off;
  }, []);

  const filtered = useMemo(() => {
    let list = products;
    if (activeCat !== 'all') list = list.filter((p) => p.category_id === activeCat);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q));
    }
    return list;
  }, [products, activeCat, search]);

  const addToCart = (p) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productId === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { productId: p.id, name: p.name, unitPrice: p.sale_price, taxRate: p.tax_rate, stock: p.stock_qty, qty: 1 }];
    });
    searchRef.current?.focus();
  };

  const setQty = (productId, qty) => {
    setCart((prev) => {
      if (qty <= 0) return prev.filter((i) => i.productId !== productId);
      return prev.map((i) => (i.productId === productId ? { ...i, qty } : i));
    });
  };

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.qty, 0);
    const tax = cart.reduce((s, i) => s + i.unitPrice * i.qty * (i.taxRate / 100), 0);
    let discount = 0;
    if (discountCode) {
      const d = discounts.find((x) => x.code === discountCode.trim().toUpperCase());
      if (d) discount = d.type === 'percentage' ? subtotal * (d.value / 100) : Math.min(d.value, subtotal);
    }
    return { subtotal, tax, discount, total: Math.max(0, subtotal + tax - discount), itemCount: cart.reduce((s, i) => s + i.qty, 0) };
  }, [cart, discountCode]);

  const charge = async () => {
    if (cart.length === 0 || charging) return;
    setCharging(true);
    setDiscountError('');
    try {
      const res = await api('/orders', {
        method: 'POST',
        body: {
          items: cart.map((i) => ({ productId: i.productId, quantity: i.qty, unitPrice: i.unitPrice, taxRate: i.taxRate })),
          paymentMethod: payMethod,
          discountCode: discountCode || undefined,
          orderType,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
        },
      });
      setReceipt(res.receipt);
      setCart([]);
      setDiscountCode('');
      setCustomerName('');
      setCustomerPhone('');
      load();
      toast(`Order ${res.order.order_number} completed`);
    } catch (err) {
      if (String(err.message).toLowerCase().includes('discount')) {
        setDiscountError(err.message);
      } else {
        toast(err.message, 'error');
      }
    } finally {
      setCharging(false);
    }
  };

  const printReceipt = () => {
    const w = window.open('', '_blank', 'width=320,height=480');
    if (!w) return toast('Allow pop-ups to print', 'error');
    w.document.write(`<pre style="font-family:monospace;font-size:12px;max-width:300px;margin:16px auto;white-space:pre-wrap">${receipt.text}</pre>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 300);
  };

  return (
    <div className="h-full flex gap-4 -m-1">
      {/* Products */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-1">
            <svg viewBox="0 0 24 24" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-mist-faint" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" /></svg>
            <input ref={searchRef} className="input pl-9" placeholder="Search products, SKU or barcode…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn-ghost" onClick={load} title="Refresh">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6a5.9 5.9 0 0 1 4.24 1.76L13 11h7V4l-2.35 2.35z" /></svg>
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-3 shrink-0">
          <button
            onClick={() => setActiveCat('all')}
            className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors ${activeCat === 'all' ? 'bg-accent text-white' : 'bg-ink-lighter text-mist-dim hover:text-mist border border-ink-border'}`}
          >All</button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors ${activeCat === c.id ? 'text-white' : 'bg-ink-lighter text-mist-dim hover:text-mist border border-ink-border'}`}
              style={activeCat === c.id ? { backgroundColor: c.color } : undefined}
            >{c.name}</button>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? <Spinner /> : filtered.length === 0 ? (
            <div className="text-center py-16 text-mist-faint text-sm">No products found</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 pb-4">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={p.stock_qty <= 0}
                  className="card p-3.5 text-left hover:border-accent/50 hover:shadow-glow transition-all group disabled:opacity-40 disabled:pointer-events-none"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: p.category_color || '#6366f1' }}>{p.name[0]}</div>
                    <span className={`badge ${p.stock_qty <= 0 ? 'bg-bad/15 text-bad' : p.stock_qty <= p.reorder_threshold ? 'bg-warn/15 text-warn' : 'bg-good/15 text-good'}`}>
                      {p.stock_qty <= 0 ? 'Out' : `${p.stock_qty} in stock`}
                    </span>
                  </div>
                  <div className="mt-2.5 text-[13px] font-semibold text-mist leading-snug line-clamp-2">{p.name}</div>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <span className="text-base font-bold text-accent-light">{money(p.sale_price)}</span>
                    {p.tax_rate > 0 && <span className="text-[10px] text-mist-faint">{p.tax_rate}% GST</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart */}
      <div className="w-[340px] shrink-0 card flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-border flex items-center justify-between">
          <div className="text-sm font-semibold text-mist">Current order</div>
          <span className="badge bg-accent/15 text-accent-light">{totals.itemCount} items</span>
        </div>

        <div className="px-4 py-2.5 border-b border-ink-border flex gap-1.5">
          {['dine_in', 'takeaway', 'delivery'].map((t) => (
            <button key={t} onClick={() => setOrderType(t)}
              className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-semibold capitalize transition-colors ${orderType === t ? 'bg-accent/20 text-accent-light' : 'text-mist-faint hover:text-mist'}`}>
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-0">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-mist-faint">
              <div className="text-3xl mb-2">🛒</div>
              <div className="text-xs">Tap products to add them to the order</div>
            </div>
          ) : cart.map((i) => (
            <div key={i.productId} className="flex items-center gap-2.5 animate-fadeUp">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-mist truncate">{i.name}</div>
                <div className="text-[11px] text-mist-faint mt-0.5">{money(i.unitPrice)} × {i.qty} <span className="text-accent-light font-medium">= {money(i.unitPrice * i.qty)}</span></div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setQty(i.productId, i.qty - 1)} className="w-6 h-6 rounded-md bg-ink-lighter border border-ink-border text-mist-dim hover:text-mist text-sm leading-none">−</button>
                <span className="w-7 text-center text-[13px] font-semibold text-mist">{i.qty}</span>
                <button onClick={() => setQty(i.productId, i.qty + 1)} disabled={i.qty >= i.stock} className="w-6 h-6 rounded-md bg-accent/20 border border-accent/40 text-accent-light hover:bg-accent/30 text-sm leading-none disabled:opacity-30">+</button>
              </div>
            </div>
          ))}
        </div>

        {/* Customer */}
        <div className="px-4 pb-2 space-y-2">
          <input className="input !py-1.5 text-[13px]" placeholder="Customer name (optional)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <input className="input !py-1.5 text-[13px]" placeholder="Phone (optional)" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
        </div>

        {/* Discount */}
        <div className="px-4 pb-2">
          <div className="flex gap-2">
            <input className="input !py-1.5 text-[13px] font-mono uppercase" placeholder="Discount code" value={discountCode} onChange={(e) => { setDiscountCode(e.target.value.toUpperCase()); setDiscountError(''); }} />
            {discountCode && <button className="btn-ghost !px-2.5" onClick={() => setDiscountCode('')} title="Clear">✕</button>}
          </div>
          {discountError && <div className="text-[11px] text-bad mt-1">{discountError}</div>}
        </div>

        {/* Totals */}
        <div className="px-4 py-3 border-t border-ink-border space-y-1.5 text-[13px]">
          <div className="flex justify-between text-mist-dim"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
          <div className="flex justify-between text-mist-dim"><span>Tax (GST)</span><span>{money(totals.tax)}</span></div>
          {totals.discount > 0 && <div className="flex justify-between text-good"><span>Discount</span><span>−{money(totals.discount)}</span></div>}
          <div className="flex justify-between text-base font-bold text-mist pt-1 border-t border-ink-border"><span>Total</span><span className="text-accent-light">{money(totals.total)}</span></div>
        </div>

        {/* Payment method */}
        <div className="px-4 pb-3 grid grid-cols-4 gap-1.5">
          {PAY_METHODS.map((m) => (
            <button key={m.id} onClick={() => setPayMethod(m.id)}
              className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[10px] font-semibold transition-colors ${payMethod === m.id ? 'border-accent bg-accent/15 text-accent-light' : 'border-ink-border bg-ink-lighter text-mist-dim hover:text-mist'}`}>
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d={m.icon} /></svg>
              {m.label}
            </button>
          ))}
        </div>

        <div className="px-4 pb-4">
          <button className="btn-good w-full py-3 text-[15px]" onClick={charge} disabled={cart.length === 0 || charging}>
            {charging ? 'Processing…' : `Charge ${money(totals.total)}`}
          </button>
        </div>
      </div>

      {/* Receipt modal */}
      <Modal open={!!receipt} onClose={() => setReceipt(null)} title="Payment successful" width="max-w-sm">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-good/15 border border-good/40 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-good" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
          </div>
          <h4 className="mt-3 text-lg font-bold text-mist">{receipt?.orderNumber}</h4>
          <p className="text-sm text-mist-faint mt-0.5">Order completed successfully</p>
          <pre className="mt-4 text-left text-[11px] leading-relaxed text-mist-dim bg-ink-lighter border border-ink-border rounded-lg p-4 max-h-56 overflow-y-auto font-mono">{receipt?.text}</pre>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="btn-primary" onClick={printReceipt}>Print receipt</button>
            <button className="btn-ghost" onClick={() => setReceipt(null)}>New order</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
