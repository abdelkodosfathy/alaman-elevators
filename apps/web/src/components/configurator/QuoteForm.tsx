'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { PublicQuote, Selections } from '@/lib/types';

const CITIES = ['الشروق', 'مدينتي', 'القاهرة الجديدة / التجمع', 'العاصمة الإدارية', 'الشيخ زايد / أكتوبر', 'أخرى'];

export function QuoteForm({ productSlug, selections, disabled }: { productSlug: string; selections: Selections; disabled: boolean }) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const val = (k: string) => String(f.get(k) ?? '').trim() || undefined;
    setSending(true);
    setError(null);
    try {
      const quote = await api<PublicQuote>('/quotes', {
        method: 'POST',
        body: JSON.stringify({
          productSlug,
          selections,
          customerName: val('customerName'),
          phone: val('phone'),
          whatsapp: val('whatsapp'),
          email: val('email'),
          city: val('city'),
          projectType: val('projectType'),
          notes: val('notes'),
          source: 'web',
        }),
      });
      router.push(`/quote/${quote.publicToken}`);
    } catch (err) {
      const issues = err instanceof ApiError ? err.body?.issues : undefined;
      setError(issues?.length ? issues.map((i) => i.messageAr).join('، ') : err instanceof Error ? err.message : 'حدث خطأ، حاول مرة أخرى');
      setSending(false);
    }
  }

  const input = 'mt-1 w-full rounded-xl border border-silver-light bg-white px-3 py-2.5 outline-none focus:border-navy';

  return (
    <form onSubmit={submit} className="rounded-2xl border border-silver-light bg-white p-5 sm:p-6">
      <h3 className="text-lg font-extrabold text-navy">بيانات التواصل</h3>
      <p className="text-muted mt-1 text-sm">هيتواصل معاك مهندس فني لمراجعة المقاسات وتحديد ميعاد المعاينة المجانية.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          الاسم <span className="text-red-700">*</span>
          <input name="customerName" required minLength={2} maxLength={120} autoComplete="name" className={input} />
        </label>
        <label className="text-sm font-medium">
          رقم الهاتف <span className="text-red-700">*</span>
          <input name="phone" required type="tel" inputMode="tel" pattern="\+?[0-9\s\-]{8,20}" autoComplete="tel" dir="ltr" className={`${input} text-right`} placeholder="01xxxxxxxxx" />
        </label>
        <label className="text-sm font-medium">
          واتساب
          <input name="whatsapp" type="tel" inputMode="tel" pattern="\+?[0-9\s\-]{8,20}" dir="ltr" className={`${input} text-right`} placeholder="لو مختلف عن رقم الهاتف" />
        </label>
        <label className="text-sm font-medium">
          البريد الإلكتروني
          <input name="email" type="email" autoComplete="email" dir="ltr" className={`${input} text-right`} />
        </label>
        <label className="text-sm font-medium">
          موقع العقار
          <select name="city" className={input} defaultValue="">
            <option value="" disabled>
              اختر الموقع
            </option>
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          نوع المشروع
          <input name="projectType" maxLength={120} className={input} placeholder="فيلا، عمارة، مول..." />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          ملاحظات
          <textarea name="notes" rows={3} maxLength={2000} className={input} placeholder="مقاسات البئر، ميعاد التسليم المطلوب..." />
        </label>
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button
        type="submit"
        disabled={sending || disabled}
        className="mt-5 w-full rounded-xl bg-navy px-6 py-3.5 font-bold text-white transition hover:bg-navy-soft disabled:opacity-50"
      >
        {sending ? 'جاري الإرسال...' : 'إرسال الطلب والحصول على عرض السعر'}
      </button>
    </form>
  );
}
