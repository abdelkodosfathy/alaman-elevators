'use client';

import type { Attribute, Configurator, Option, Selections } from '@/lib/types';
import { blockReason } from '@/lib/rules';
import { money, signedMoney } from '@/lib/format';

function priceLabel(c: Configurator, o: Option) {
  if (o.priceType === 'PERCENT') return o.price ? `+${o.price}%` : 'مشمول';
  if (o.priceType === 'PER_UNIT') {
    const unit = c.steps.flatMap((s) => s.attributes).find((a) => a.key === o.unitAttributeKey)?.unitAr ?? 'وحدة';
    return `${money(o.price)} / ${unit}`;
  }
  return signedMoney(o.price);
}

export function AttributeField({
  config,
  attr,
  sel,
  onChange,
}: {
  config: Configurator;
  attr: Attribute;
  sel: Selections;
  onChange: (key: string, value: Selections[string]) => void;
}) {
  if (attr.inputType === 'NUMBER') {
    const value = Number(sel[attr.key] ?? attr.defaultValue ?? attr.min ?? 0);
    const min = attr.min ?? 0;
    const max = attr.max ?? 999;
    const set = (v: number) => onChange(attr.key, Math.min(max, Math.max(min, Math.round(v || min))));
    return (
      <fieldset className="rounded-2xl border border-silver-light bg-white p-5">
        <legend className="sr-only">{attr.labelAr}</legend>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-navy">{attr.labelAr}</h3>
            {attr.helpAr && <p className="text-muted mt-1 text-sm">{attr.helpAr}</p>}
            {attr.unitPrice > 0 && (
              <p className="text-muted mt-1 text-xs">
                {money(attr.unitPrice)} لكل {attr.unitAr ?? 'وحدة'} إضافي{attr.includedUnits ? ` بعد أول ${attr.includedUnits}` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2" dir="ltr">
            <button type="button" aria-label="إنقاص" onClick={() => set(value - 1)} disabled={value <= min} className="size-11 rounded-xl border border-silver-light text-xl font-bold text-navy hover:bg-paper disabled:opacity-40">−</button>
            <input
              type="number"
              inputMode="numeric"
              aria-label={attr.labelAr}
              value={value}
              min={min}
              max={max}
              onChange={(e) => set(Number(e.target.value))}
              className="num h-11 w-20 rounded-xl border border-silver-light text-center text-lg font-bold text-navy"
            />
            <button type="button" aria-label="زيادة" onClick={() => set(value + 1)} disabled={value >= max} className="size-11 rounded-xl border border-silver-light text-xl font-bold text-navy hover:bg-paper disabled:opacity-40">+</button>
            {attr.unitAr && <span className="text-muted ms-1 text-sm" dir="rtl">{attr.unitAr}</span>}
          </div>
        </div>
        <input
          type="range"
          aria-hidden
          tabIndex={-1}
          min={min}
          max={max}
          value={value}
          onChange={(e) => set(Number(e.target.value))}
          className="mt-4 w-full accent-[var(--color-navy)]"
          dir="ltr"
        />
      </fieldset>
    );
  }

  const selected = new Set(
    attr.inputType === 'MULTI' ? ((sel[attr.key] as string[]) ?? []) : [sel[attr.key] as string].filter(Boolean),
  );
  const toggle = (code: string) => {
    if (attr.inputType === 'SINGLE') return onChange(attr.key, code);
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange(attr.key, [...next]);
  };

  return (
    <fieldset>
      <legend className="mb-3">
        <span className="font-bold text-navy">{attr.labelAr}</span>
        {attr.inputType === 'MULTI' && <span className="text-muted ms-2 text-xs">(اختر ما يناسبك)</span>}
        {attr.helpAr && <span className="text-muted mt-1 block text-sm">{attr.helpAr}</span>}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {attr.options.map((o) => {
          const on = selected.has(o.code);
          const blocked = blockReason(config, attr.key, o.code, sel);
          return (
            <button
              key={o.code}
              type="button"
              role={attr.inputType === 'SINGLE' ? 'radio' : 'checkbox'}
              aria-checked={on}
              disabled={!!blocked}
              title={blocked ?? undefined}
              onClick={() => toggle(o.code)}
              className={`relative flex items-start gap-3 rounded-2xl border p-4 text-start transition ${
                on ? 'border-navy bg-navy text-white shadow-lg' : 'border-silver-light bg-white hover:border-navy/40'
              } disabled:cursor-not-allowed disabled:opacity-45`}
            >
              {o.swatch ? (
                <span className="mt-0.5 size-8 shrink-0 rounded-lg border border-black/10" style={{ background: o.swatch }} />
              ) : (
                <span
                  className={`mt-1 grid size-5 shrink-0 place-items-center border-2 ${attr.inputType === 'SINGLE' ? 'rounded-full' : 'rounded-md'} ${
                    on ? 'border-white bg-white' : 'border-silver'
                  }`}
                >
                  {on && <span className={`size-2.5 bg-navy ${attr.inputType === 'SINGLE' ? 'rounded-full' : 'rounded-sm'}`} />}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-bold leading-snug">{o.labelAr}</span>
                {o.descriptionAr && <span className={`mt-1 block text-xs leading-relaxed ${on ? 'text-silver-light' : 'text-muted'}`}>{o.descriptionAr}</span>}
                {blocked && <span className="mt-1 block text-xs text-red-700">{blocked}</span>}
                <span className={`mt-2 block text-sm font-bold ${on ? 'text-white' : 'text-navy'}`}>
                  <span className="num">{priceLabel(config, o)}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
