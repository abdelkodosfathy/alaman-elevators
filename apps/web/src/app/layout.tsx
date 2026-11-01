import type { Metadata } from 'next';
import { Tajawal } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const tajawal = Tajawal({ subsets: ['arabic', 'latin'], weight: ['400', '500', '700', '800'], variable: '--font-tajawal' });

export const metadata: Metadata = {
  title: 'صمّم مصعدك | شركة الأمان للمصاعد والسلالم المتحركة',
  description: 'اختر مواصفات المصعد أو السلم المتحرك بالكامل واحصل على سعر تقديري فوري.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body className="font-sans antialiased">
        <header className="bg-navy text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-white/10 text-lg font-extrabold">A</span>
              <span className="leading-tight">
                <b className="block text-[15px] font-extrabold">الأمان للمصاعد</b>
                <small className="text-silver text-xs">صمّم مصعدك واعرف سعره فوراً</small>
              </span>
            </Link>
            <a href="tel:01000146844" className="num rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10">
              01000146844
            </a>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
