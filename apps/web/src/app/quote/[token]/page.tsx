import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError, getQuote, quotePdfUrl } from '@/lib/api';
import { money } from '@/lib/format';

export default async function QuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const q = await getQuote(token).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-2xl bg-navy p-6 text-white sm:p-8">
        <p className="text-silver text-sm">تم استلام طلبك بنجاح ✓</p>
        <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">شكراً {q.customerName}</h1>
        <p className="text-silver-light mt-2 leading-relaxed">
          رقم طلبك <b className="num text-white">{q.number}</b>. هيتواصل معاك مهندس فني خلال 24 ساعة لتأكيد المواصفات وتحديد ميعاد المعاينة المجانية.
        </p>
        <div className="mt-6 rounded-xl bg-white/10 p-4">
          <p className="text-silver text-xs">النطاق السعري المتوقع لـ{q.product.nameAr}</p>
          <p className="mt-1 text-2xl font-extrabold">
            <span className="num">{money(q.estimateLow)}</span> <span className="text-silver text-base font-medium">إلى</span>{' '}
            <span className="num">{money(q.estimateHigh)}</span>
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={quotePdfUrl(q.publicToken)} target="_blank" rel="noopener" className="rounded-xl bg-white px-5 py-3 font-bold text-navy hover:bg-silver-light">
            تحميل عرض السعر PDF
          </a>
          <a
            href={`https://wa.me/201000146844?text=${encodeURIComponent(`مرحباً، أرسلت طلب عرض سعر رقم ${q.number}`)}`}
            target="_blank"
            rel="noopener"
            className="rounded-xl border border-white/30 px-5 py-3 font-bold hover:bg-white/10"
          >
            تواصل عبر واتساب
          </a>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-silver-light bg-white p-5 sm:p-6">
        <h2 className="mb-3 text-lg font-extrabold text-navy">المواصفات المختارة</h2>
        <ul className="divide-y divide-silver-light/70 text-sm">
          {q.breakdown.map((l, i) => (
            <li key={i} className="flex justify-between gap-3 py-2">
              <span>
                <span className="text-muted block text-xs">{l.labelAr}</span>
                {l.valueAr}
              </span>
              <span className="num shrink-0 font-bold text-navy">{l.amount ? money(l.amount) : 'مشمول'}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-navy/15 pt-3 font-extrabold text-navy">
          <span>الإجمالي التقديري شامل الضريبة</span>
          <span className="num">{money(q.total)}</span>
        </div>
      </section>

      <Link href="/" className="text-muted mt-6 inline-block text-sm hover:text-navy">
        → تصميم منتج آخر
      </Link>
    </main>
  );
}
