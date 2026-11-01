import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Browser } from 'puppeteer';
import type { PriceLine } from '../pricing/pricing.engine';
import type { PublicQuote } from './quotes.service';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Renders quotes to PDF through headless Chrome, so Arabic shaping and RTL layout
 * come out exactly as in the browser.
 */
@Injectable()
export class QuotePdfService implements OnModuleDestroy {
  private readonly logger = new Logger(QuotePdfService.name);
  private browser?: Promise<Browser>;

  private getBrowser() {
    if (!this.browser) {
      this.browser = import('puppeteer').then((p) => p.default.launch({ headless: true, args: ['--no-sandbox'] }));
      this.browser.catch(() => (this.browser = undefined));
    }
    return this.browser;
  }

  async onModuleDestroy() {
    if (this.browser) await (await this.browser).close().catch(() => undefined);
  }

  async render(quote: PublicQuote): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      // Fonts load from Google; fall back to system Arabic fonts when offline.
      await page
        .setContent(this.html(quote), { waitUntil: 'load', timeout: 15_000 })
        .then(() => page.evaluate(() => document.fonts.ready))
        .catch((e) => this.logger.warn(`PDF fonts not fully loaded: ${(e as Error).message}`));
      const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' } });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }

  html(q: PublicQuote) {
    const money = (n: number) => `${n.toLocaleString('en-US')} ${esc(q.currency === 'EGP' ? 'ج.م' : q.currency)}`;
    const lines = (q.breakdown as unknown as PriceLine[])
      .map(
        (l) => `<tr><td>${esc(l.labelAr)}</td><td>${esc(l.valueAr)}</td><td class="n">${l.amount ? money(l.amount) : 'مشمول'}</td></tr>`,
      )
      .join('');
    const date = new Date(q.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;color:#1d2533;font-size:12.5px;line-height:1.6}
  header{background:#0A192F;color:#fff;padding:22px 26px;border-radius:10px;display:flex;justify-content:space-between;align-items:center}
  header h1{font-size:20px;font-weight:800}
  header small{color:#B7C0CB;display:block}
  .meta{display:flex;gap:12px;margin:18px 0}
  .meta div{flex:1;background:#F3F5F8;border-radius:8px;padding:10px 14px}
  .meta b{display:block;font-size:11px;color:#6b7686;font-weight:400}
  h2{font-size:15px;margin:18px 0 8px;color:#0A192F}
  table{width:100%;border-collapse:collapse}
  th{background:#0A192F;color:#fff;text-align:right;padding:8px 10px;font-size:12px}
  td{padding:7px 10px;border-bottom:1px solid #E4E8EE}
  tr:nth-child(even) td{background:#FAFBFC}
  .n{text-align:left;white-space:nowrap;direction:ltr}
  .sum{margin-top:12px;margin-right:auto;width:52%}
  .sum td{border:none;padding:4px 10px}
  .sum .t td{font-size:15px;font-weight:800;border-top:2px solid #0A192F;padding-top:8px}
  .range{margin-top:16px;background:#0A192F;color:#fff;border-radius:10px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center}
  .range strong{font-size:18px}
  .note{margin-top:16px;color:#6b7686;font-size:11px}
  footer{margin-top:22px;border-top:1px solid #E4E8EE;padding-top:10px;color:#6b7686;font-size:11px;display:flex;justify-content:space-between}
</style></head><body>
<header><div><h1>شركة الأمان للمصاعد والسلالم المتحركة</h1><small>سلامتكم هدفنا، والجودة أسلوب شغلنا</small></div>
<div style="text-align:left"><small>عرض سعر تقديري</small><b style="font-size:16px">${esc(q.number)}</b></div></header>
<div class="meta">
  <div><b>العميل</b>${esc(q.customerName)}</div>
  <div><b>المنتج</b>${esc(q.product.nameAr)}</div>
  <div><b>التاريخ</b>${esc(date)}</div>
  ${q.city ? `<div><b>الموقع</b>${esc(q.city)}</div>` : ''}
</div>
<h2>المواصفات المختارة</h2>
<table><thead><tr><th style="width:30%">البند</th><th>الاختيار</th><th class="n" style="text-align:left">القيمة</th></tr></thead><tbody>${lines}</tbody></table>
<table class="sum">
  <tr><td>الإجمالي قبل الضريبة</td><td class="n">${money(q.subtotal)}</td></tr>
  <tr><td>ضريبة القيمة المضافة</td><td class="n">${money(q.vat)}</td></tr>
  <tr class="t"><td>الإجمالي التقديري</td><td class="n">${money(q.total)}</td></tr>
</table>
<div class="range"><span>النطاق السعري المتوقع</span><strong><bdi>${money(q.estimateLow)}</bdi> إلى <bdi>${money(q.estimateHigh)}</bdi></strong></div>
<p class="note">هذا عرض سعر تقديري مبني على اختياراتك، والسعر النهائي يتحدد بعد المعاينة الهندسية للموقع ومراجعة مقاسات البئر والتشطيبات. العرض صالح لمدة 15 يوماً من تاريخ إصداره.</p>
<footer><span>01000146844 · 01040164442 · 01040164448</span><span>alamanelevator.site</span></footer>
</body></html>`;
  }
}
