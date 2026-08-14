import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// ── Modal ────────────────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative card w-full ${width} animate-fadeUp max-h-[88vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-border">
          <h3 className="text-sm font-semibold text-mist">{title}</h3>
          <button onClick={onClose} className="text-mist-faint hover:text-mist transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────

export function StatCard({ label, value, sub, icon, tone = 'text-mist' }) {
  return (
    <div className="card p-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-mist-faint">{label}</div>
        <div className={`mt-1.5 text-xl font-bold ${tone} truncate`}>{value}</div>
        {sub && <div className="mt-0.5 text-[11px] text-mist-faint truncate">{sub}</div>}
      </div>
      {icon && <div className="text-mist-faint shrink-0">{icon}</div>}
    </div>
  );
}

// ── Loading / empty ──────────────────────────────────────────────────────────

export function Spinner({ text = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-mist-faint">
      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

export function EmptyState({ icon = '📭', title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-3xl mb-3">{icon}</div>
      <div className="text-sm font-medium text-mist">{title}</div>
      {sub && <div className="text-xs text-mist-faint mt-1 max-w-xs">{sub}</div>}
    </div>
  );
}

// ── Toast system ─────────────────────────────────────────────────────────────

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, kind = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const colors = { success: 'border-good/40 text-good', error: 'border-bad/40 text-bad', info: 'border-accent/40 text-accent-light' };

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[60] space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className={`card border px-4 py-2.5 text-sm animate-fadeUp ${colors[t.kind]}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
