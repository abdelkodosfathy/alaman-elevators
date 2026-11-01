'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/components/admin/AdminShell';
import { quotePdfUrl } from '@/lib/api';
import { money } from '@/lib/format';
import type { AdminQuote, QuoteStatus } from '@/lib/types';

const STATUS: Record<QuoteStatus, { label: string; cls: string }> = {
  NEW: { label: 'جديد', cls: 'bg-blue-100 text-blue-800' },
  CONTACTED: { label: 'تم التواصل', cls: 'bg-amber-100 text-amber-800' },
  QUOTED: { label: 'تم إرسال العرض', cls: 'bg-violet-100 text-violet-800' },
  WON: { label: 'تم التعاقد', cls: 'bg-green-100 text-green-800' },
  LOST: { label: 'لم يتم', cls: 'bg-gray-200 text-gray-700' },
};

interface Stats {
  totalQuotes: number;
  pipelineValue: number;
  byStatus: Partial<Record<QuoteStatus, number>>;
}

export default function QuotesPage() {
  const { call } = useAdmin();
  const [stats, setStats] = useState<Stats | null>(null);
  const [data, setData] = useState<{ items: AdminQuote[]; total: number } | null>(null);
  const [status, setStatus] = useState<QuoteStatus | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    const q = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (status) q.set('status', status);
    if (search.trim()) q.set('search', search.trim());
    call<{ items: AdminQuote[]; total: number }>(`/admin/quotes?${q}`).then(setData).catch(() => undefined);
    call<Stats>('/admin/stats').then(setStats).catch(() => undefined);
  }, [call, page, status, search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function updateStatus(id: string, s: QuoteStatus) {
    await call(`/admin/quotes/${id}`, { method: 'PATCH', body: JSON.stringify({ status: s }) });
    load();
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div className="rounded-2xl bg-navy p-5 text-white">
          <p className="text-silver text-xs">إجمالي الطلبات</p>
          <p className="num mt-1 text-3xl font-extrabold">{stats?.totalQuotes ?? '—'}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 sm:col-span-2 lg:col-span-1">
          <p className="text-muted text-xs">قيمة الطلبات التقديرية</p>
          <p className="num mt-1 text-2xl font-extrabold text-navy">{stats ? money(stats.pipelineValue) : '—'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-5 sm:col-span-3 lg:col-span-2">
          {(Object.keys(STATUS) as QuoteStatus[]).map((s) => (
            <span key={s} className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS[s].cls}`}>
              {STATUS[s].label}: <span className="num">{stats?.byStatus[s] ?? 0}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="بحث برقم الطلب أو الاسم أو الهاتف"
          className="min-w-64 flex-1 rounded-xl border border-silver-light bg-white px-3 py-2.5"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as QuoteStatus | '');
            setPage(1);
          }}
          className="rounded-xl border border-silver-light bg-white px-3 py-2.5"
        >
          <option value="">كل الحالات</option>
          {(Object.keys(STATUS) as QuoteStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS[s].label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-silver-light bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-paper text-muted text-xs">
            <tr>
              {['رقم الطلب', 'العميل', 'المنتج', 'الإجمالي', 'التاريخ', 'الحالة'].map((h) => (
                <th key={h} className="px-4 py-3 text-start font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-silver-light/70">
            {data?.items.map((q) => (
              <QuoteRow key={q.id} q={q} open={open === q.id} onToggle={() => setOpen(open === q.id ? null : q.id)} onStatus={updateStatus} />
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted px-4 py-10 text-center">
                  لا توجد طلبات
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg bg-white px-3 py-1.5 disabled:opacity-40">
            السابق
          </button>
          <span className="num">
            {page} / {pages}
          </span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-lg bg-white px-3 py-1.5 disabled:opacity-40">
            التالي
          </button>
        </div>
      )}
    </div>
  );
}

function QuoteRow({ q, open, onToggle, onStatus }: { q: AdminQuote; open: boolean; onToggle: () => void; onStatus: (id: string, s: QuoteStatus) => void }) {
  return (
    <>
      <tr className="cursor-pointer hover:bg-paper/60" onClick={onToggle}>
        <td className="num px-4 py-3 font-bold text-navy">{q.number}</td>
        <td className="px-4 py-3">
          <b className="block">{q.customerName}</b>
          <span className="num text-muted text-xs">{q.phone}</span>
        </td>
        <td className="px-4 py-3">{q.product.nameAr}</td>
        <td className="num px-4 py-3 font-bold">{money(q.total)}</td>
        <td className="text-muted px-4 py-3 text-xs">{new Date(q.createdAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <select
            value={q.status}
            onChange={(e) => onStatus(q.id, e.target.value as QuoteStatus)}
            className={`rounded-full border-0 px-3 py-1 text-xs font-bold ${STATUS[q.status].cls}`}
          >
            {(Object.keys(STATUS) as QuoteStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS[s].label}
              </option>
            ))}
          </select>
        </td>
      </tr>
      {open && (
        <tr className="bg-paper/50">
          <td colSpan={6} className="px-4 py-4">
            <div className="grid gap-4 md:grid-cols-[260px_1fr]">
              <dl className="space-y-2 text-sm">
                {[
                  ['واتساب', q.whatsapp],
                  ['البريد', q.email],
                  ['الموقع', q.city],
                  ['نوع المشروع', q.projectType],
                  ['المصدر', q.source],
                  ['ملاحظات', q.notes],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-muted text-xs">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                <a href={quotePdfUrl(q.publicToken)} target="_blank" rel="noopener" className="inline-block rounded-lg bg-navy px-3 py-2 text-xs font-bold text-white">
                  عرض PDF
                </a>
              </dl>
              <ul className="grid gap-x-6 text-sm sm:grid-cols-2">
                {q.breakdown.map((l, i) => (
                  <li key={i} className="flex justify-between gap-3 border-b border-silver-light/60 py-1.5">
                    <span>
                      <span className="text-muted text-xs">{l.labelAr}: </span>
                      {l.valueAr}
                    </span>
                    <span className="num shrink-0">{l.amount ? money(l.amount) : '—'}</span>
                  </li>
                ))}
              </ul>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
