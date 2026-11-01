import type { Configurator, PriceResult, ProductSummary, PublicQuote, Selections } from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { message?: string | string[]; issues?: PriceResult['issues'] } | null,
  ) {
    const m = body?.message;
    super(Array.isArray(m) ? m.join('، ') : m ?? `Request failed (${status})`);
  }
}

export async function api<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  const res = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
    ...rest,
    headers: {
      ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return res.status === 204 ? (undefined as T) : res.json();
}

export const getProducts = () => api<ProductSummary[]>('/catalog/products');
export const getConfigurator = (slug: string) => api<Configurator>(`/catalog/products/${encodeURIComponent(slug)}`);
export const estimate = (productSlug: string, selections: Selections, signal?: AbortSignal) =>
  api<PriceResult>('/pricing/estimate', { method: 'POST', body: JSON.stringify({ productSlug, selections }), signal });
export const getQuote = (token: string) => api<PublicQuote>(`/quotes/${encodeURIComponent(token)}`);
export const quotePdfUrl = (token: string) => `${API_URL}/quotes/${encodeURIComponent(token)}/pdf`;
