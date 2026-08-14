import { useEffect, useState } from 'react';
import { api, money } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Modal, Spinner, useToast, EmptyState } from '../components/ui';

const EMPTY = { name: '', sku: '', barcode: '', categoryId: '', unit: 'pcs', costPrice: '', salePrice: '', stockQty: '', reorderThreshold: '', taxRate: 18 };

export default function Inventory() {
  const { can } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('all'); // all | low | out
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const [showMoves, setShowMoves] = useState(false);

  const load = () => {
    api('/products').then((d) => setProducts(d.products)).catch(() => {});
    api('/products/categories').then((d) => setCategories(d.categories)).catch(() => {});
  };

  useEffect(() => {
    load();
    setLoading(false);
  }, []);

  useEffect(() => {
    if (showMoves) api('/inventory/movements').then((d) => setMovements(d.movements)).catch(() => {});
  }, [showMoves]);

  const filtered = products.filter((p) => {
    if (view === 'low') return p.stock_qty <= p.reorder_threshold && p.stock_qty > 0;
    if (view === 'out') return p.stock_qty <= 0;
    return true;
  }).filter((p) => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()) || (p.sku || '').toLowerCase().includes(search.trim().toLowerCase()));

  const saveProduct = async (form) => {
    const body = {
      name: form.name, sku: form.sku, barcode: form.barcode,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      unit: form.unit, costPrice: Number(form.costPrice) || 0,
      salePrice: Number(form.salePrice), stockQty: Number(form.stockQty) || 0,
      reorderThreshold: Number(form.reorderThreshold) || 5, taxRate: Number(form.taxRate) || 0,
    };
    try {
      if (editing?.id) await api(`/products/${editing.id}`, { method: 'PUT', body });
      else await api('/products', { method: 'POST', body });
      toast(editing?.id ? 'Product updated' : 'Product created');
      setEditing(null);
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const adjustStock = async (form) => {
    try {
      await api('/inventory/adjust', {
        method: 'POST',
        body: { productId: adjusting.id, qtyDelta: Number(form.delta), action: form.action, note: form.note },
      });
      toast('Stock adjusted');
      setAdjusting(null);
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const [adjustForm, setAdjustForm] = useState({ delta: '', action: 'CORRECTION', note: '' });

  return (
    <div className="space-y-5 animate-fadeUp">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-mist">Inventory</h1>
          <p className="text-xs text-mist-faint mt-0.5">{products.length} products · {products.filter((p) => p.stock_qty <= p.reorder_threshold).length} low stock</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-ink-border overflow-hidden">
            {[['all', 'All'], ['low', 'Low stock'], ['out', 'Out']].map(([k, l]) => (
              <button key={k} onClick={() => setView(k)} className={`px-3 py-1.5 text-xs font-semibold transition-colors ${view === k ? 'bg-accent text-white' : 'bg-ink-lighter text-mist-dim hover:text-mist'}`}>{l}</button>
            ))}
          </div>
          <input className="input !w-48" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {can('manager') && <button className="btn-primary" onClick={() => { setEditing(EMPTY); }}>+ Add product</button>}
        </div>
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon="📦" title="No products here" sub="Add your first product to start selling." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-ink-lighter/60">
                <tr>
                  <th className="th">Product</th>
                  <th className="th">SKU</th>
                  <th className="th">Category</th>
                  <th className="th">Cost</th>
                  <th className="th">Price</th>
                  <th className="th">Stock</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-border">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-ink-lighter/40 transition-colors">
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: p.category_color || '#6366f1' }}>{p.name[0]}</div>
                        <div>
                          <div className="font-medium text-mist">{p.name}</div>
                          {p.barcode && <div className="text-[10px] text-mist-faint font-mono">{p.barcode}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="td font-mono text-mist-faint text-xs">{p.sku || '—'}</td>
                    <td className="td text-mist-dim">{p.category_name || '—'}</td>
                    <td className="td text-mist-faint">{money(p.cost_price)}</td>
                    <td className="td font-semibold text-accent-light">{money(p.sale_price)}</td>
                    <td className="td font-semibold text-mist">{p.stock_qty}</td>
                    <td className="td">
                      <span className={`badge ${p.stock_qty <= 0 ? 'bg-bad/15 text-bad' : p.stock_qty <= p.reorder_threshold ? 'bg-warn/15 text-warn' : 'bg-good/15 text-good'}`}>
                        {p.stock_qty <= 0 ? 'Out of stock' : p.stock_qty <= p.reorder_threshold ? 'Low stock' : 'In stock'}
                      </span>
                    </td>
                    <td className="td text-right">
                      <div className="flex justify-end gap-1.5">
                        {can('manager') && (
                          <>
                            <button className="btn-ghost !px-2.5 !py-1 text-xs" onClick={() => { setAdjusting(p); setAdjustForm({ delta: '', action: 'CORRECTION', note: '' }); }}>Adjust</button>
                            <button className="btn-ghost !px-2.5 !py-1 text-xs" onClick={() => setEditing(p)}>Edit</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button className="btn-ghost text-xs" onClick={() => setShowMoves(true)}>View stock movements</button>
      </div>

      {/* Add / edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? `Edit — ${editing.name}` : 'Add product'} width="max-w-xl">
        {editing && <ProductForm key={editing.id || 'new'} initial={editing} categories={categories} onSave={saveProduct} onCancel={() => setEditing(null)} />}
      </Modal>

      {/* Adjust modal */}
      <Modal open={!!adjusting} onClose={() => setAdjusting(null)} title={`Adjust stock — ${adjusting?.name}`}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Change (±)</label>
              <input className="input" type="number" value={adjustForm.delta} onChange={(e) => setAdjustForm({ ...adjustForm, delta: e.target.value })} placeholder="e.g. 10 or -5" autoFocus />
            </div>
            <div>
              <label className="label">Reason</label>
              <select className="input" value={adjustForm.action} onChange={(e) => setAdjustForm({ ...adjustForm, action: e.target.value })}>
                <option value="CORRECTION">Correction</option>
                <option value="PURCHASE">Purchase / restock</option>
                <option value="DAMAGE">Damaged</option>
                <option value="THEFT">Theft / missing</option>
                <option value="RETURN">Return</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Note</label>
            <input className="input" value={adjustForm.note} onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })} placeholder="optional" />
          </div>
          <div className="flex gap-2 pt-1">
            <button className="btn-primary flex-1" onClick={() => adjustStock(adjustForm)} disabled={!adjustForm.delta}>Apply change</button>
            <button className="btn-ghost" onClick={() => setAdjusting(null)}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Movements modal */}
      <Modal open={showMoves} onClose={() => setShowMoves(false)} title="Stock movements" width="max-w-2xl">
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full">
            <thead><tr><th className="th">When</th><th className="th">Product</th><th className="th">Action</th><th className="th">Δ</th><th className="th">User</th><th className="th">Note</th></tr></thead>
            <tbody className="divide-y divide-ink-border">
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="td text-mist-faint text-xs">{m.created_at}</td>
                  <td className="td text-mist">{m.product_name}</td>
                  <td className="td"><span className={`badge ${m.action === 'SALE' ? 'bg-accent/15 text-accent-light' : 'bg-ink-border2 text-mist-dim'}`}>{m.action}</span></td>
                  <td className={`td font-mono font-semibold ${m.qty_delta < 0 ? 'text-bad' : 'text-good'}`}>{m.qty_delta > 0 ? '+' : ''}{m.qty_delta}</td>
                  <td className="td text-mist-faint">{m.user_name || '—'}</td>
                  <td className="td text-mist-faint text-xs">{m.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}

function ProductForm({ initial, categories, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    sku: initial.sku || '',
    barcode: initial.barcode || '',
    categoryId: initial.category_id ?? initial.categoryId ?? '',
    unit: initial.unit || 'pcs',
    costPrice: initial.cost_price ?? initial.costPrice ?? '',
    salePrice: initial.sale_price ?? initial.salePrice ?? '',
    stockQty: initial.stock_qty ?? initial.stockQty ?? '',
    reorderThreshold: initial.reorder_threshold ?? initial.reorderThreshold ?? 5,
    taxRate: initial.tax_rate ?? initial.taxRate ?? 18,
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div>
        <label className="label">Product name *</label>
        <input className="input" value={form.name} onChange={set('name')} autoFocus required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">SKU</label><input className="input" value={form.sku} onChange={set('sku')} /></div>
        <div><label className="label">Barcode</label><input className="input" value={form.barcode} onChange={set('barcode')} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Category</label>
          <select className="input" value={form.categoryId} onChange={set('categoryId')}>
            <option value="">Uncategorized</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><label className="label">Unit</label><input className="input" value={form.unit} onChange={set('unit')} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Cost price (₹)</label><input className="input" type="number" step="0.01" value={form.costPrice} onChange={set('costPrice')} /></div>
        <div><label className="label">Sale price (₹) *</label><input className="input" type="number" step="0.01" value={form.salePrice} onChange={set('salePrice')} required /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="label">Stock</label><input className="input" type="number" value={form.stockQty} onChange={set('stockQty')} /></div>
        <div><label className="label">Reorder at</label><input className="input" type="number" value={form.reorderThreshold} onChange={set('reorderThreshold')} /></div>
        <div><label className="label">Tax rate %</label><input className="input" type="number" value={form.taxRate} onChange={set('taxRate')} /></div>
      </div>
      <div className="flex gap-2 pt-2">
        <button className="btn-primary flex-1" type="submit">Save product</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
