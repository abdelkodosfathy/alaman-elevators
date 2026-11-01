'use client';

import type { PriceResult } from '@/lib/types';
import { money } from '@/lib/format';

export function PriceRange({ price, loading, dark = false }: { price: PriceResult | null; loading: boolean; dark?: boolean }) {
  return (
    <div aria-live="polite" className={loading ? 'opacity-60 transition' : 'transition'}>
      <p className={`text-xs ${dark ? 'text-silver' : 'text-muted'}`}>السعر التقديري شامل الضريبة</p>
      {price ? (
        <p className={`mt-1 text-[17px] font-extrabold leading-tight sm:text-2xl ${dark ? 'text-white' : 'text-navy'}`}>
          <span className="num whitespace-nowrap">{money(price.estimateLow)}</span>
          <span className={`mx-1 text-base font-medium ${dark ? 'text-silver' : 'text-muted'}`}>إلى</span>
          <span className="num whitespace-nowrap">{money(price.estimateHigh)}</span>
        </p>
      ) : (
        <p className={`mt-1 h-8 w-48 animate-pulse rounded ${dark ? 'bg-white/15' : 'bg-silver-light'}`} />
      )}
    </div>
  );
}

export function PriceBreakdown({ price }: { price: PriceResult }) {
  return (
    <div>
      <ul className="divide-y divide-silver-light/70 text-sm">
        {price.lines.map((l, i) => (
          <li key={i} className="flex items-start justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="text-muted block text-xs">{l.labelAr}</span>
              <span className="block font-medium">{l.valueAr}</span>
            </span>
            <span className="num shrink-0 font-bold text-navy">{l.amount ? money(l.amount) : 'مشمول'}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-3 space-y-1 border-t border-navy/15 pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">الإجمالي قبل الضريبة</dt>
          <dd className="num font-bold">{money(price.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">ضريبة القيمة المضافة</dt>
          <dd className="num font-bold">{money(price.vat)}</dd>
        </div>
        <div className="flex justify-between text-base">
          <dt className="font-bold text-navy">الإجمالي</dt>
          <dd className="num font-extrabold text-navy">{money(price.total)}</dd>
        </div>
      </dl>
    </div>
  );
}
