import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const UserIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-3.34 0-9 1.67-9 5v3h18v-3c0-3.33-5.66-5-9-5z" /></svg>
);
const LockIcon = ({ open }) => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    {open
      ? <path d="M12 17a2 2 0 0 0 2-2 1.9 1.9 0 0 0-.7-1.5L19.6 7A2 2 0 0 0 17.6 5L14 8.6A4 4 0 0 0 6 12a3.9 3.9 0 0 0 1.1 2.8L3.5 18.4a1 1 0 0 0 1.4 1.4L8.6 16A4 4 0 0 0 12 17zm8.5-8.5L18 11l-2.2-2.2 2.5-2.5zM12 15a3 3 0 0 1-3-3 3 3 0 0 1 .9-2.1l4.2 4.2A3 3 0 0 1 12 15z" />
      : <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 0 1 6 0z" />}
  </svg>
);

const ROLE_STYLE = {
  admin: 'border-accent/30 bg-accent/10 hover:border-accent/60',
  manager: 'border-purple-400/30 bg-purple-400/10 hover:border-purple-400/60',
  cashier: 'border-cyan-400/30 bg-cyan-400/10 hover:border-cyan-400/60',
};
const ROLE_DOT = { admin: 'bg-accent', manager: 'bg-purple-400', cashier: 'bg-cyan-400' };

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password);
      navigate('/pos', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const quick = (u, p) => { setUsername(u); setPassword(p); setError(''); };

  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-ink relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-accent/15 blur-[130px]" />
      <div className="absolute -bottom-40 -right-40 w-[520px] h-[520px] rounded-full bg-purple-600/15 blur-[130px]" />
      <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-cyan-400/10 blur-[110px]" />

      <div className="relative w-full max-w-sm animate-fadeUp">
        {/* Brand header */}
        <div className="text-center mb-8">
          <img src="/logo-mark.png" alt="Biznex" className="w-16 h-16 mx-auto rounded-2xl bg-white p-1.5 object-contain shadow-glow ring-4 ring-accent/10" />
          <h1 className="mt-4 text-2xl font-bold text-mist tracking-tight">Biznex POS</h1>
          <p className="text-sm text-mist-faint mt-1.5">Sign in to start selling</p>
        </div>

        {/* Login card */}
        <form onSubmit={submit} className="card p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-bad/10 border border-bad/30 text-bad text-sm px-3 py-2.5 flex items-start gap-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z" /></svg>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="label" htmlFor="login-user">Username</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-faint"><UserIcon /></span>
              <input
                id="login-user"
                className="input !pl-9"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoFocus
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label !mb-0" htmlFor="login-pass">Password</label>
              <span className="text-[11px] text-mist-faint">min 6 characters</span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-faint"><LockIcon open={showPw} /></span>
              <input
                id="login-pass"
                className="input !pl-9 !pr-10"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-mist-faint hover:text-mist hover:bg-ink-border/60 transition-colors"
                title={showPw ? 'Hide password' : 'Show password'}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  {showPw
                    ? <path d="M12 4.5C7 4.5 2.7 7.6 1 12c1.7 4.4 6 7.5 11 7.5s9.3-3.1 11-7.5c-1.7-4.4-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 5-5 5 5 0 0 1-5 5zm0-8a3 3 0 1 0 3 3 3 3 0 0 0-3-3z" />
                    : <path d="M12 4.5C7 4.5 2.7 7.6 1 12c1.7 4.4 6 7.5 11 7.5s9.3-3.1 11-7.5c-1.7-4.4-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 5-5 5 5 0 0 1-5 5z" />}
                </svg>
              </button>
            </div>
          </div>

          <button className="btn-primary w-full py-2.5 !text-[15px]" disabled={busy || !username || !password}>
            {busy ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" /></svg>
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" /></svg>
              </>
            )}
          </button>
        </form>

        {/* Demo accounts */}
        <div className="mt-4 card p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-mist-faint mb-3 px-1">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
            Demo accounts
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              ['admin', 'admin123', 'Owner', 'admin'],
              ['manager', 'manager123', 'Manager', 'manager'],
              ['cashier', 'cashier123', 'Cashier', 'cashier'],
            ].map(([u, p, label, role]) => (
              <button
                key={u}
                type="button"
                onClick={() => quick(u, p)}
                className={`rounded-lg border px-2 py-2.5 text-left transition-all hover:-translate-y-0.5 ${ROLE_STYLE[role]}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${ROLE_DOT[role]}`} />
                  <span className="text-xs font-semibold text-mist">{label}</span>
                </div>
                <div className="text-[10px] font-mono text-mist-faint mt-1">{u}</div>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-[11px] text-mist-faint mt-5">
          One tap on a demo account fills in the credentials
        </p>
      </div>
    </div>
  );
}
