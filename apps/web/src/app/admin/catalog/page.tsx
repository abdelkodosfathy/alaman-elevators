'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/components/admin/AdminShell';
import type { PriceType, RuleType } from '@/lib/types';

interface AdminOption {
  id: string;
  code: string;
  labelAr: string;
  labelEn: string;
  priceType: PriceType;
  price: number;
  unitAttributeKey: string | null;
  isDefault: boolean;
  isActive: boolean;
  rules: { id: string; type: RuleType; messageAr: string | null; target: { code: string } }[];
}
interface AdminAttribute {
  id: string;
  key: string;
  labelAr: string;
  inputType: 'SINGLE' | 'MULTI' | 'NUMBER';
  min: number | null;
  max: number | null;
  includedUnits: number;
  unitPrice: number;
  unitAr: string | null;
  options: AdminOption[];
}
interface AdminProduct {
  id: string;
  slug: string;
  nameAr: string;
  basePrice: number;
  isActive: boolean;
  steps: { id: string; titleAr: string; attributes: AdminAttribute[] }[];
}

const PRICE_TYPES: Record<PriceType, string> = { FIXED: 'مبلغ ثابت', PER_UNIT: 'لكل وحدة', PERCENT: 'نسبة %' };

function NumberCell({ value, onSave, className = 'w-28' }: { value: number | null; onSave: (v: number) => void; className?: string }) {
  const [v, setV] = useState(String(value ?? ''));
  useEffect(() => setV(String(value ?? '')), [value]);
  return (
    <input
      type="number"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== String(value ?? '') && v.trim() !== '' && onSave(Math.round(Number(v)))}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className={`num rounded-lg border border-silver-light px-2 py-1.5 ${className}`}
    />
  );
}

function TextCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() && v !== value && onSave(v.trim())}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="w-full min-w-40 rounded-lg border border-transparent px-2 py-1.5 hover:border-silver-light focus:border-navy"
    />
  );
}

export default function CatalogPage() {
  const { call } = useAdmin();
  const [products, setProducts] = useState<{ slug: string; nameAr: string }[]>([]);
  const [slug, setSlug] = useState<string | null>(null);
  const [tree, setTree] = useState<AdminProduct | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    call<{ slug: string; nameAr: string }[]>('/admin/products').then((p) => {
      setProducts(p);
      setSlug((s) => s ?? p[0]?.slug ?? null);
    });
  }, [call]);

  const load = useCallback(() => {
    if (slug) call<AdminProduct>(`/admin/products/${slug}`).then(setTree);
  }, [call, slug]);
  useEffect(load, [load]);

  const save = async (path: string, body: unknown, method = 'PATCH') => {
    try {
      await call(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
      setToast({ ok: true, text: 'تم الحفظ' });
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : 'فشل الحفظ' });
    }
    setTimeout(() => setToast(null), 2200);
  };

  const allOptions = tree?.steps.flatMap((s) => s.attributes.flatMap((a) => a.options.map((o) => ({ ...o, attr: a.labelAr })))) ?? [];
  const rules = allOptions.flatMap((o) => o.rules.map((r) => ({ ...r, from: o })));
  const labelOf = (code: string) => allOptions.find((o) => o.code === code);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {products.map((p) => (
          <button
            key={p.slug}
            onClick={() => setSlug(p.slug)}
            className={`rounded-lg px-4 py-2 text-sm font-bold ${slug === p.slug ? 'bg-navy text-white' : 'bg-white text-navy'}`}
          >
            {p.nameAr}
          </button>
        ))}
      </div>

      {tree && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-6 rounded-2xl bg-white p-5">
            <h2 className="text-xl font-extrabold text-navy">{tree.nameAr}</h2>
            <label className="flex items-center gap-2 text-sm">
              السعر الأساسي (ج.م)
              <NumberCell value={tree.basePrice} className="w-36" onSave={(v) => save(`/admin/products/${tree.id}`, { basePrice: v })} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={tree.isActive} onChange={(e) => save(`/admin/products/${tree.id}`, { isActive: e.target.checked })} />
              ظاهر للعملاء
            </label>
          </div>

          {tree.steps.map((s) => (
            <section key={s.id} className="mt-6">
              <h3 className="mb-2 text-lg font-extrabold text-navy">{s.titleAr}</h3>
              <div className="space-y-4">
                {s.attributes.map((a) => (
                  <div key={a.id} className="overflow-x-auto rounded-2xl border border-silver-light bg-white p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-4">
                      <b>{a.labelAr}</b>
                      <code className="text-muted text-xs">{a.key}</code>
                      {a.inputType === 'NUMBER' && (
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <label className="flex items-center gap-1">
                            من <NumberCell value={a.min} className="w-16" onSave={(v) => save(`/admin/attributes/${a.id}`, { min: v })} />
                          </label>
                          <label className="flex items-center gap-1">
                            إلى <NumberCell value={a.max} className="w-16" onSave={(v) => save(`/admin/attributes/${a.id}`, { max: v })} />
                          </label>
                          <label className="flex items-center gap-1">
                            مشمول في الأساسي <NumberCell value={a.includedUnits} className="w-16" onSave={(v) => save(`/admin/attributes/${a.id}`, { includedUnits: v })} />
                          </label>
                          <label className="flex items-center gap-1">
                            سعر {a.unitAr ?? 'الوحدة'} الإضافي <NumberCell value={a.unitPrice} onSave={(v) => save(`/admin/attributes/${a.id}`, { unitPrice: v })} />
                          </label>
                        </div>
                      )}
                    </div>
                    {a.inputType !== 'NUMBER' && (
                      <>
                        <table className="w-full min-w-[680px] text-sm">
                          <thead className="text-muted text-xs">
                            <tr>
                              <th className="py-1 text-start font-medium">البند</th>
                              <th className="py-1 text-start font-medium">نوع التسعير</th>
                              <th className="py-1 text-start font-medium">السعر</th>
                              <th className="py-1 text-start font-medium">افتراضي</th>
                              <th className="py-1 text-start font-medium">متاح</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {a.options.map((o) => (
                              <tr key={o.id} className={`border-t border-silver-light/60 ${o.isActive ? '' : 'opacity-50'}`}>
                                <td className="py-1">
                                  <TextCell value={o.labelAr} onSave={(v) => save(`/admin/options/${o.id}`, { labelAr: v })} />
                                </td>
                                <td>
                                  <select
                                    value={o.priceType}
                                    onChange={(e) => save(`/admin/options/${o.id}`, { priceType: e.target.value })}
                                    className="rounded-lg border border-silver-light px-2 py-1.5"
                                  >
                                    {(Object.keys(PRICE_TYPES) as PriceType[]).map((t) => (
                                      <option key={t} value={t}>
                                        {PRICE_TYPES[t]}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <NumberCell value={o.price} onSave={(v) => save(`/admin/options/${o.id}`, { price: v })} />
                                </td>
                                <td>
                                  <input type="checkbox" checked={o.isDefault} onChange={(e) => save(`/admin/options/${o.id}`, { isDefault: e.target.checked })} />
                                </td>
                                <td>
                                  <input type="checkbox" checked={o.isActive} onChange={(e) => save(`/admin/options/${o.id}`, { isActive: e.target.checked })} />
                                </td>
                                <td className="text-end">
                                  <button
                                    onClick={() => confirm(`حذف "${o.labelAr}" نهائياً؟`) && save(`/admin/options/${o.id}`, undefined, 'DELETE')}
                                    className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                                  >
                                    حذف
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <AddOption
                          prefix={a.options[0] ? `${a.options[0].code.split('.').slice(0, 2).join('.')}.` : `${tree.slug}.${a.key}.`}
                          onAdd={(body) => save(`/admin/attributes/${a.id}/options`, body, 'POST')}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className="mt-8 rounded-2xl border border-silver-light bg-white p-5">
            <h3 className="text-lg font-extrabold text-navy">قواعد التوافق</h3>
            <p className="text-muted mt-1 text-sm">تمنع اختيار بنود غير متوافقة فنياً، أو تفرض بنداً مع آخر.</p>
            <ul className="mt-4 divide-y divide-silver-light/60 text-sm">
              {rules.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <b>{r.from.labelAr}</b>{' '}
                    <span className={`mx-1 rounded px-2 py-0.5 text-xs ${r.type === 'EXCLUDES' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
                      {r.type === 'EXCLUDES' ? 'لا يتوافق مع' : 'يتطلب'}
                    </span>{' '}
                    <b>{labelOf(r.target.code)?.labelAr ?? r.target.code}</b>
                    {r.messageAr && <span className="text-muted block text-xs">{r.messageAr}</span>}
                  </span>
                  <button onClick={() => save(`/admin/rules/${r.id}`, undefined, 'DELETE')} className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50">
                    حذف
                  </button>
                </li>
              ))}
            </ul>
            <AddRule options={allOptions} onAdd={(body) => save('/admin/rules', body, 'POST')} />
          </section>
        </>
      )}

      {toast && (
        <div role="status" className={`fixed bottom-5 left-5 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-xl ${toast.ok ? 'bg-green-700' : 'bg-red-700'}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}

function AddOption({ prefix: base, onAdd }: { prefix: string; onAdd: (b: unknown) => void }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onAdd({
          code: base + String(f.get('code')).trim().toLowerCase(),
          labelAr: f.get('labelAr'),
          labelEn: f.get('labelEn') || f.get('code'),
          price: Number(f.get('price') || 0),
        });
        e.currentTarget.reset();
      }}
      className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-silver-light pt-3 text-sm"
    >
      <span className="text-muted text-xs">إضافة بند:</span>
      <input name="labelAr" required placeholder="الاسم بالعربي" className="rounded-lg border border-silver-light px-2 py-1.5" />
      <input name="labelEn" placeholder="English name" dir="ltr" className="rounded-lg border border-silver-light px-2 py-1.5" />
      <span className="flex items-center rounded-lg border border-silver-light" dir="ltr">
        <span className="text-muted ps-2 text-xs">{base}</span>
        <input name="code" required pattern="[a-z0-9\-_]+" placeholder="code" className="w-24 rounded-lg px-1 py-1.5" />
      </span>
      <input name="price" type="number" placeholder="السعر" className="num w-28 rounded-lg border border-silver-light px-2 py-1.5" />
      <button className="rounded-lg bg-navy px-3 py-1.5 font-bold text-white">إضافة</button>
    </form>
  );
}

function AddRule({ options, onAdd }: { options: { code: string; labelAr: string; attr: string }[]; onAdd: (b: unknown) => void }) {
  const opts = options.map((o) => (
    <option key={o.code} value={o.code}>
      {o.attr}: {o.labelAr}
    </option>
  ));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onAdd({ type: f.get('type'), optionCode: f.get('optionCode'), targetCode: f.get('targetCode'), messageAr: f.get('messageAr') || undefined });
        e.currentTarget.reset();
      }}
      className="mt-4 flex flex-wrap items-center gap-2 border-t border-dashed border-silver-light pt-4 text-sm"
    >
      <select name="optionCode" required className="max-w-64 rounded-lg border border-silver-light px-2 py-1.5">
        {opts}
      </select>
      <select name="type" className="rounded-lg border border-silver-light px-2 py-1.5">
        <option value="EXCLUDES">لا يتوافق مع</option>
        <option value="REQUIRES">يتطلب</option>
      </select>
      <select name="targetCode" required className="max-w-64 rounded-lg border border-silver-light px-2 py-1.5">
        {opts}
      </select>
      <input name="messageAr" placeholder="رسالة توضيحية للعميل (اختياري)" className="min-w-56 flex-1 rounded-lg border border-silver-light px-2 py-1.5" />
      <button className="rounded-lg bg-navy px-3 py-1.5 font-bold text-white">إضافة قاعدة</button>
    </form>
  );
}
