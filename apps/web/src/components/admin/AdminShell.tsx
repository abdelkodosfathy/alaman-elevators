'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

const TOKEN_KEY = 'alaman.admin.token';

interface AdminCtx {
  call: <T>(path: string, init?: RequestInit) => Promise<T>;
  logout: () => void;
}

const Ctx = createContext<AdminCtx | null>(null);

export const useAdmin = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAdmin outside AdminShell');
  return c;
};

export const saveToken = (t: string) => {
  try {
    localStorage.setItem(TOKEN_KEY, t);
  } catch {}
};

const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const NAV = [
  ['/admin', 'الطلبات'],
  ['/admin/catalog', 'البنود والأسعار'],
  ['/admin/webhooks', 'الربط مع المنصات'],
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const isLogin = path === '/admin/login';

  useEffect(() => {
    const t = readToken();
    setToken(t);
    if (!t && !isLogin) router.replace('/admin/login');
  }, [isLogin, router]);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
    setToken(null);
    router.replace('/admin/login');
  }, [router]);

  const call = useCallback(
    async <T,>(p: string, init: RequestInit = {}) => {
      try {
        return await api<T>(p, { ...init, token: readToken() });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) logout();
        throw e;
      }
    },
    [logout],
  );

  if (isLogin) return <>{children}</>;
  if (!token) return <div className="text-muted p-10 text-center">جاري التحميل...</div>;

  return (
    <Ctx.Provider value={{ call, logout }}>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <nav className="flex flex-wrap gap-2">
            {NAV.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-4 py-2 text-sm font-bold ${path === href ? 'bg-navy text-white' : 'bg-white text-navy hover:bg-silver-light'}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex gap-2 text-sm">
            <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace(/\/v1$/, '') ?? 'http://localhost:4000/api'}/docs`} target="_blank" rel="noopener" className="rounded-lg bg-white px-3 py-2 text-navy hover:bg-silver-light">
              توثيق الـ API
            </a>
            <button onClick={logout} className="rounded-lg bg-white px-3 py-2 text-navy hover:bg-silver-light">
              تسجيل الخروج
            </button>
          </div>
        </div>
        {children}
      </div>
    </Ctx.Provider>
  );
}
