'use client';

import { useEffect, useMemo, useState } from 'react';
import { estimate } from '@/lib/api';
import { attributesOf, defaultSelections, normalize } from '@/lib/rules';
import type { Configurator as Config, PriceResult, Selections } from '@/lib/types';
import { AttributeField } from './AttributeField';
import { CabinViewer } from './cabin3d/CabinViewer';
import type { Focus } from './cabin3d/CabinScene';
import { cabinLook, FOCUS } from './cabin3d/look';
import { CabinPreview, EscalatorPreview } from './Illustrations';
import { PriceBreakdown, PriceRange } from './PriceSummary';
import { QuoteForm } from './QuoteForm';

const STORAGE_PREFIX = 'alaman.config.';

function loadSaved(config: Config): Selections | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + config.slug);
    return raw ? normalize(config, { ...defaultSelections(config), ...JSON.parse(raw) }) : null;
  } catch {
    return null;
  }
}

export function Configurator({ config }: { config: Config }) {
  const [sel, setSel] = useState<Selections>(() => defaultSelections(config));
  const [stepIdx, setStepIdx] = useState(0);
  const [price, setPrice] = useState<PriceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const steps = config.steps;
  const isReview = stepIdx === steps.length;
  const step = steps[stepIdx];

  // Restore a draft after hydration so server and client render the same first frame.
  useEffect(() => {
    const saved = loadSaved(config);
    if (saved) setSel(saved);
  }, [config]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + config.slug, JSON.stringify(sel));
    } catch {}
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      estimate(config.slug, sel, ctrl.signal)
        .then((p) => {
          setPrice(p);
          setError(null);
        })
        .catch((e) => {
          if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'تعذّر حساب السعر');
        })
        .finally(() => !ctrl.signal.aborted && setLoading(false));
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [config.slug, sel]);

  const change = (key: string, value: Selections[string]) => {
    setSel((s) => normalize(config, { ...s, [key]: value }));
    // Turn the 3D camera toward the part that just changed.
    if (FOCUS[key]) setFocus({ ...FOCUS[key], key: Date.now() });
  };

  const is3d = config.kind === 'ELEVATOR';
  const look = useMemo(() => (is3d ? cabinLook(config, sel) : null), [is3d, config, sel]);

  const go = (i: number) => {
    setStepIdx(i);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const preview = useMemo(() => {
    const opt = (key: string) => {
      const a = attributesOf(config).find((x) => x.key === key);
      return a?.options.find((o) => o.code === sel[key]);
    };
    const tail = (key: string) => String(sel[key] ?? '').split('.').pop() ?? '';
    if (config.kind === 'ESCALATOR') {
      return <EscalatorPreview handrail={opt('handrail')?.swatch ?? '#1b1b1b'} glass={tail('balustrade').startsWith('glass')} className="h-36 w-full" />;
    }
    const floors: Record<string, string> = { pvc: '#3a3f47', granite: '#6d6a66', marble: '#e8e4dc' };
    const rails: Record<string, string | null> = { none: null, gold: '#c9a227' };
    const mirror = tail('mirror');
    return (
      <CabinPreview
        wall={opt('walls')?.swatch ?? '#a7adb3'}
        floor={floors[tail('floor')] ?? '#3a3f47'}
        handrail={tail('handrail') in rails ? rails[tail('handrail')] : '#d8dee6'}
        mirror={mirror === 'none' || mirror === 'full' ? mirror : 'half'}
        glass={tail('walls') === 'glass'}
        className="h-36 w-full"
      />
    );
  }, [config, sel]);

  const stepIssues = (i: number) =>
    price?.issues.filter((iss) => iss.attributeKey && steps[i]?.attributes.some((a) => a.key === iss.attributeKey)) ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-6 lg:pb-12">
      <div className="mb-5">
        <p className="text-muted text-sm">تصميم {config.nameAr}</p>
        <h1 className="text-2xl font-extrabold text-navy sm:text-3xl">{isReview ? 'مراجعة الطلب' : step.titleAr}</h1>
        {!isReview && step.descriptionAr && <p className="text-muted mt-1">{step.descriptionAr}</p>}
        {is3d && (
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-bold text-white lg:hidden"
          >
            <span aria-hidden>◫</span> شوف الكابينة 3D من الداخل
          </button>
        )}
      </div>

      {/* Stepper */}
      <nav aria-label="خطوات التصميم" className="-mx-4 mb-6 overflow-x-auto px-4">
        <ol className="flex min-w-max gap-2">
          {[...steps.map((s) => s.titleAr), 'المراجعة والإرسال'].map((title, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={i === stepIdx ? 'step' : undefined}
                className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition ${
                  i === stepIdx
                    ? 'border-navy bg-navy text-white'
                    : i < stepIdx
                      ? 'border-navy/30 bg-white text-navy'
                      : 'border-silver-light bg-white text-muted hover:text-navy'
                }`}
              >
                <span className={`num grid size-5 place-items-center rounded-full text-xs ${i === stepIdx ? 'bg-white text-navy' : 'bg-paper'}`}>
                  {i < stepIdx ? '✓' : i + 1}
                </span>
                {title}
                {i < steps.length && stepIssues(i).length > 0 && <span className="size-2 rounded-full bg-red-600" aria-label="بها ملاحظات" />}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="min-w-0 space-y-8">
          {isReview ? (
            <>
              {price && !price.valid && (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <b>محتاج تراجع الاختيارات دي قبل الإرسال:</b>
                  <ul className="mt-2 list-disc ps-5">
                    {price.issues.map((i, k) => (
                      <li key={k}>{i.messageAr}</li>
                    ))}
                  </ul>
                </div>
              )}
              {price && (
                <div className="rounded-2xl border border-silver-light bg-white p-5 sm:p-6">
                  <h3 className="mb-3 text-lg font-extrabold text-navy">ملخص المواصفات والتكلفة</h3>
                  <PriceBreakdown price={price} />
                </div>
              )}
              <QuoteForm productSlug={config.slug} selections={sel} disabled={!price?.valid || loading} />
            </>
          ) : (
            step.attributes.map((a) => <AttributeField key={a.key} config={config} attr={a} sel={sel} onChange={change} />)
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => go(stepIdx - 1)}
              disabled={stepIdx === 0}
              className="rounded-xl border border-silver-light bg-white px-5 py-3 font-bold text-navy disabled:invisible"
            >
              → السابق
            </button>
            {!isReview && (
              <button type="button" onClick={() => go(stepIdx + 1)} className="rounded-xl bg-navy px-6 py-3 font-bold text-white hover:bg-navy-soft">
                {stepIdx === steps.length - 1 ? 'مراجعة وإرسال' : 'التالي'} ←
              </button>
            )}
          </div>
        </section>

        {/* Desktop summary */}
        <aside className="hidden lg:block">
          <div className="sticky top-4 space-y-4">
            <div className="overflow-hidden rounded-2xl bg-navy text-white">
              {look ? (
                <CabinViewer
                  look={look}
                  focus={focus}
                  fallback={<div className="px-5 pt-4">{preview}</div>}
                  className="h-72 bg-navy-light"
                  open={viewerOpen}
                  onOpenChange={setViewerOpen}
                />
              ) : (
                <div className="bg-navy-light px-5 pt-4">{preview}</div>
              )}
              <div className="p-5">
                <PriceRange price={price} loading={loading} dark />
                {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
              </div>
            </div>
            {price && (
              <div className="max-h-[50vh] overflow-y-auto rounded-2xl border border-silver-light bg-white p-5">
                <PriceBreakdown price={price} />
              </div>
            )}
            <p className="text-muted px-1 text-xs leading-relaxed">
              السعر تقديري ويتحدد نهائياً بعد المعاينة الهندسية للموقع.
            </p>
          </div>
        </aside>
      </div>

      {/* Mobile price bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-navy text-white shadow-2xl lg:hidden">
        {showDetails && price && (
          <div className="max-h-[55vh] overflow-y-auto bg-white px-4 py-4 text-ink">
            <PriceBreakdown price={price} />
          </div>
        )}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <PriceRange price={price} loading={loading} dark />
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
            className="shrink-0 rounded-lg border border-white/25 px-3 py-2 text-sm"
          >
            {showDetails ? 'إخفاء' : 'التفاصيل'}
          </button>
        </div>
      </div>
    </div>
  );
}
