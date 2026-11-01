import Link from 'next/link';
import { getProducts } from '@/lib/api';
import { money } from '@/lib/format';
import { ProductIllustration } from '@/components/configurator/Illustrations';

export default async function Home() {
  const products = await getProducts().catch(() => null);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
      <section className="max-w-2xl">
        <p className="text-muted text-sm font-medium">المصمم التفاعلي</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight text-navy sm:text-4xl">
          اختر كل تفصيلة في مشروعك، واعرف السعر التقديري في نفس اللحظة
        </h1>
        <p className="text-muted mt-3 leading-relaxed">
          من نوع الماكينة والحمولة لحد خامة الحوائط والأرضية وأنظمة الأمان. السعر بيتحدث مع كل اختيار، وفي الآخر تقدر تبعت طلبك وتحمّل عرض السعر PDF.
        </p>
      </section>

      {!products ? (
        <p className="mt-10 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          تعذّر الاتصال بالخادم. تأكد من تشغيل الـ API ثم أعد تحميل الصفحة.
        </p>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {products.map((p) => (
            <Link
              key={p.slug}
              href={`/configure/${p.slug}`}
              className="group overflow-hidden rounded-2xl border border-silver-light bg-white transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <div className="bg-navy grid h-48 place-items-center">
                <ProductIllustration kind={p.kind} />
              </div>
              <div className="p-5">
                <h2 className="text-xl font-extrabold text-navy">{p.nameAr}</h2>
                <p className="text-muted mt-1 text-sm leading-relaxed">{p.descriptionAr}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm">
                    يبدأ من <b className="num text-navy">{money(p.basePrice)}</b>
                  </span>
                  <span className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white transition group-hover:bg-navy-soft">
                    ابدأ التصميم ←
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
