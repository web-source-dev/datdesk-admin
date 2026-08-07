'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

function AdminLoginForm() {
  const [email, setEmail] = useState('admin@datdesk.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason) setError(reason);
  }, [searchParams]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      router.push('/admin/users');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="relative z-10 w-full max-w-md bg-white/90 backdrop-blur border border-slate-200/80 shadow-xl rounded-2xl p-8"
    >
      <div className="mb-7 text-center">
        <Image
          src="/dat-logo.svg"
          alt="Horizon"
          width={280}
          height={72}
          className="mx-auto h-10 w-auto object-contain"
          priority
        />
        <h1 className="text-lg font-semibold text-brand-900 mt-5">Admin</h1>
        <p className="text-sm text-slate-500 mt-1">Sign in to manage Horizon</p>
      </div>

      <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="dd-input mb-4"
      />

      <label className="block text-xs font-medium text-slate-500 mb-1">Password</label>
      <input
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="dd-input mb-4"
      />

      {error ? (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      ) : null}

      <button type="submit" disabled={busy} className="dd-btn-primary w-full !py-3">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-6">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(11,107,203,0.18), transparent 55%), linear-gradient(180deg, #f1f5f9 0%, #e8eef5 100%)'
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(10,47,87,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(10,47,87,0.12) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse 75% 65% at 50% 45%, black 20%, transparent 85%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 75% 65% at 50% 45%, black 20%, transparent 85%)'
        }}
      />
      <Suspense fallback={<div className="text-slate-500">Loading…</div>}>
        <AdminLoginForm />
      </Suspense>
    </div>
  );
}
