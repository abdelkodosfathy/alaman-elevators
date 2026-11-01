'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/components/admin/AdminShell';

interface Webhook {
  id: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  lastStatus: number | null;
  lastDeliveredAt: string | null;
}

const EVENTS: Record<string, string> = {
  'quote.created': 'طلب عرض سعر جديد',
  'quote.status_changed': 'تغيير حالة الطلب',
};

export default function WebhooksPage() {
  const { call } = useAdmin();
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    call<Webhook[]>('/admin/webhooks').then(setHooks);
  }, [call]);
  useEffect(load, [load]);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setError(null);
    try {
      await call('/admin/webhooks', { method: 'POST', body: JSON.stringify({ url: f.get('url'), events: f.getAll('events') }) });
      form.reset();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحفظ');
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5">
        <h2 className="text-lg font-extrabold text-navy">الربط مع المنصات الأخرى</h2>
        <p className="text-muted mt-1 text-sm leading-relaxed">
          أضف رابط (Webhook) لأي نظام خارجي (CRM، بوابة واتساب، ERP...) وهيوصله إشعار JSON فوري مع كل طلب جديد. كل إشعار موقّع بـ
          <code className="mx-1 rounded bg-paper px-1" dir="ltr">X-Alaman-Signature</code>
          (HMAC-SHA256 للـ body بالـ secret). وأي تطبيق تاني (موبايل، شركاء) يقدر يستخدم الـ REST API مباشرة؛ التوثيق الكامل في صفحة توثيق الـ API.
        </p>
        <form onSubmit={add} className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <input name="url" type="url" required placeholder="https://crm.example.com/hooks/alaman" dir="ltr" className="min-w-72 flex-1 rounded-xl border border-silver-light px-3 py-2.5" />
          {Object.entries(EVENTS).map(([k, v]) => (
            <label key={k} className="flex items-center gap-1.5">
              <input type="checkbox" name="events" value={k} defaultChecked={k === 'quote.created'} />
              {v}
            </label>
          ))}
          <button className="rounded-xl bg-navy px-4 py-2.5 font-bold text-white">إضافة</button>
        </form>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </section>

      <section className="space-y-3">
        {hooks.map((h) => (
          <div key={h.id} className="rounded-2xl border border-silver-light bg-white p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <code dir="ltr" className="break-all font-bold text-navy">{h.url}</code>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={h.isActive}
                    onChange={(e) => call(`/admin/webhooks/${h.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: e.target.checked }) }).then(load)}
                  />
                  مفعّل
                </label>
                <button
                  onClick={() => confirm('حذف هذا الربط؟') && call(`/admin/webhooks/${h.id}`, { method: 'DELETE' }).then(load)}
                  className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                >
                  حذف
                </button>
              </div>
            </div>
            <div className="text-muted mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <span>الأحداث: {h.events.map((e) => EVENTS[e] ?? e).join('، ')}</span>
              <span>
                Secret: <code dir="ltr" className="select-all text-ink">{h.secret}</code>
              </span>
              <span>
                آخر إرسال: {h.lastDeliveredAt ? `${new Date(h.lastDeliveredAt).toLocaleString('ar-EG')} (${h.lastStatus || 'فشل'})` : 'لم يتم بعد'}
              </span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
