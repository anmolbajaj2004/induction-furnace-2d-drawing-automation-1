import React, { createContext, useContext, useEffect, useState } from 'react';
import { Mail, KeyRound, Loader2 } from 'lucide-react';

const DOMAIN = '@kognitoai.com';

interface AuthCtx { email: string; logout: () => void }
const AuthContext = createContext<AuthCtx | null>(null);
export const useAuth = () => useContext(AuthContext);

async function post(url: string, body?: object) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

const LoginScreen: React.FC<{ onLoggedIn: (email: string) => void }> = ({ onLoggedIn }) => {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const clean = email.trim().toLowerCase();
  const emailOk = clean.endsWith(DOMAIN) && clean.length > DOMAIN.length;

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(''); setInfo('');
    if (!emailOk) return setError(`Use your ${DOMAIN} email address.`);
    setBusy(true);
    try {
      await post('/api/auth/request-otp', { email: clean });
      setStep('code');
      setInfo(`We sent a 6-digit code to ${clean}.`);
    } catch (err: any) { setError(err.message); }
    setBusy(false);
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const j = await post('/api/auth/verify-otp', { email: clean, code });
      onLoggedIn(j.email);
    } catch (err: any) { setError(err.message); }
    setBusy(false);
  };

  const input = 'w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40';
  const button = 'w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-5">
        <div className="text-center">
          <div className="text-3xl">⚡</div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-1">VULCAN CAD</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sign in with your {DOMAIN} email</p>
        </div>

        {step === 'email' ? (
          <form onSubmit={sendCode} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Work email</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
              <input type="email" autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder={`name${DOMAIN}`} className={`${input} pl-9`} />
            </div>
            <button type="submit" disabled={busy || !emailOk} className={button}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Send code
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Enter the 6-digit code</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
              <input inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456"
                className={`${input} pl-9 tracking-[0.4em] font-mono`} />
            </div>
            <button type="submit" disabled={busy || code.length !== 6} className={button}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Verify &amp; sign in
            </button>
            <div className="flex justify-between text-xs">
              <button type="button" onClick={() => { setStep('email'); setCode(''); setError(''); setInfo(''); }}
                className="text-slate-500 hover:underline">Change email</button>
              <button type="button" disabled={busy} onClick={() => sendCode()} className="text-amber-600 hover:underline">Resend code</button>
            </div>
          </form>
        )}

        {info && !error && <p className="text-xs text-emerald-600 dark:text-emerald-400">{info}</p>}
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
};

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<'loading' | 'out' | string>('loading'); // string = logged-in email

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setState(j?.email || 'out'))
      .catch(() => setState('out'));
  }, []);

  const logout = async () => {
    try { await post('/api/auth/logout'); } catch { /* cookie is cleared server-side; fall through */ }
    setState('out');
  };

  if (state === 'loading') return null;
  if (state === 'out') return <LoginScreen onLoggedIn={setState} />;
  return <AuthContext.Provider value={{ email: state, logout }}>{children}</AuthContext.Provider>;
};
