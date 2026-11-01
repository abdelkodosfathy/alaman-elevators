'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { saveToken } from '@/components/admin/AdminShell';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ accessToken: string }>('/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: f.get('email'), password: f.get('password') }),
      });
      saveToken(r.accessToken);
      router.replace('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تسجيل الدخول');
      setBusy(false);
    }
  }

  const input = 'mt-1 w-full rounded-xl border border-silver-light px-3 py-2.5 outline-none focus:border-navy';
  return (
    <main className="grid min-h-[70vh] place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-silver-light bg-white p-6">
        <h1 className="text-xl font-extrabold text-navy">لوحة تحكم الأمان</h1>
        <label className="mt-5 block text-sm font-medium">
          البريد الإلكتروني
          <input name="email" type="email" required autoComplete="username" dir="ltr" className={input} />
        </label>
        <label className="mt-4 block text-sm font-medium">
          كلمة المرور
          <input name="password" type="password" required autoComplete="current-password" dir="ltr" className={input} />
        </label>
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <button disabled={busy} className="mt-5 w-full rounded-xl bg-navy py-3 font-bold text-white disabled:opacity-50">
          {busy ? '...' : 'دخول'}
        </button>
      </form>
    </main>
  );
}
