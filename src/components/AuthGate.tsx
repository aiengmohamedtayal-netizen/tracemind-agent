import { FormEvent, useState } from 'react';

export interface AuthUser { id: number; email: string; role: string }

function friendlyError(raw: string): string {
  if (!raw) return raw;
  const lower = raw.toLowerCase();
  if (lower.includes('already exists') || lower.includes('409')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (lower.includes('invalid email or password') || lower.includes('401')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many login or registration attempts. Please wait a minute and try again.';
  }
  if (lower.includes('special-use') || lower.includes('reserved') || lower.includes('valid email')) {
    return 'Please enter a valid email address (reserved domains like .local are not accepted).';
  }
  if (lower.includes('12 characters') || lower.includes('422')) {
    return 'Please enter a valid email and a password of at least 12 characters.';
  }
  if (lower.includes('unable to reach') || lower.includes('backend unavailable')) {
    return 'Backend Unavailable: could not reach the TraceMind API. Verify the FastAPI server is running.';
  }
  return raw;
}

export function AuthGate({
  onAuthenticated,
  initialError,
}: {
  onAuthenticated: (email: string, password: string, mode: 'login' | 'register') => Promise<void>;
  initialError?: string | null;
}) {
  const [mode,setMode]=useState<'login'|'register'>('login');
  const [email,setEmail]=useState(''); const [password,setPassword]=useState('');
  const [error,setError]=useState(initialError ?? ''); const [busy,setBusy]=useState(false);
  async function submit(event:FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { await onAuthenticated(email,password,mode); } catch(e) { setError(e instanceof Error?e.message:'Unable to sign in. Please try again.'); } finally { setBusy(false); } }
  return (
    <main className="min-h-screen grid place-items-center bg-[#060913] text-slate-100 p-5">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-[#0B0F19] border border-slate-800 p-8 shadow-2xl space-y-5">
        <div>
          <p className="text-sm text-cyan-400 font-semibold tracking-wide uppercase font-mono">TraceMind Incident Intelligence</p>
          <h1 className="text-2xl font-bold mt-2 text-white">{mode === 'login' ? 'Sign in to TraceMind' : 'Create your account'}</h1>
          <p className="text-slate-400 text-sm mt-2">Your analysis history and telemetry data are private to your account.</p>
        </div>
        <label className="block text-sm font-medium text-slate-300">
          Email address
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700/80 p-3 text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
          />
        </label>
        <label className="block text-sm font-medium text-slate-300">
          Password
          <input
            required
            minLength={12}
            maxLength={128}
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700/80 p-3 text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
          />
          <span className="text-xs text-slate-500 mt-1 block font-mono">At least 12 characters</span>
        </label>
        {error && <p role="alert" className="text-sm text-rose-400 bg-rose-950/40 border border-rose-800/60 rounded-lg p-2.5">{friendlyError(error)}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 p-3 text-white font-medium hover:from-cyan-400 hover:to-indigo-500 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
        >
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <button
          type="button"
          className="w-full text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </form>
    </main>
  );
}
