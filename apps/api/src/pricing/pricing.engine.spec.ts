import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePrice, EngineProduct } from './pricing.engine';

const settings = { vatRate: 0.14, estimateMargin: 0.1, currency: 'EGP' };

const opt = (code: string, price: number, extra: Partial<EngineProduct['attributes'][0]['options'][0]> = {}) => ({
  code,
  labelAr: code,
  priceType: 'FIXED' as const,
  price,
  unitAttributeKey: null,
  isActive: true,
  ...extra,
});

const product: EngineProduct = {
  slug: 'test',
  nameAr: 'مصعد',
  basePrice: 100_000,
  attributes: [
    { key: 'stops', labelAr: 'الأدوار', inputType: 'NUMBER', required: true, min: 2, max: 10, defaultValue: 4, unitAr: 'دور', includedUnits: 2, unitPrice: 10_000, options: [] },
    { key: 'drive', labelAr: 'الماكينة', inputType: 'SINGLE', required: true, min: null, max: null, defaultValue: null, unitAr: null, includedUnits: 0, unitPrice: 0, options: [opt('mrl', 20_000), opt('hyd', 0)] },
    { key: 'speed', labelAr: 'السرعة', inputType: 'SINGLE', required: true, min: null, max: null, defaultValue: null, unitAr: null, includedUnits: 0, unitPrice: 0, options: [opt('s1', 0), opt('s16', 30_000)] },
    { key: 'doors', labelAr: 'الأبواب', inputType: 'SINGLE', required: true, min: null, max: null, defaultValue: null, unitAr: null, includedUnits: 0, unitPrice: 0, options: [opt('ss', 5_000, { priceType: 'PER_UNIT', unitAttributeKey: 'stops' })] },
    { key: 'extras', labelAr: 'إضافات', inputType: 'MULTI', required: false, min: null, max: null, defaultValue: null, unitAr: null, includedUnits: 0, unitPrice: 0, options: [opt('ard', 15_000), opt('lux', 10, { priceType: 'PERCENT' })] },
  ],
  rules: [{ type: 'EXCLUDES', optionCode: 'hyd', targetCode: 's16', messageAr: null }],
};

test('prices number, per-unit, fixed and percent lines', () => {
  const r = calculatePrice(product, { stops: 5, drive: 'mrl', speed: 's1', doors: 'ss', extras: ['ard', 'lux'] }, settings);
  // base 100k + stops 3x10k + mrl 20k + doors 5x5k + ard 15k = 190k, +10% = 209k
  assert.equal(r.valid, true);
  assert.equal(r.subtotal, 209_000);
  assert.equal(r.vat, 29_260);
  assert.equal(r.total, 238_260);
  assert.equal(r.estimateLow, 214_000);
  assert.equal(r.estimateHigh, 262_000);
});

test('applies number defaults and clamps out-of-range values', () => {
  const r = calculatePrice(product, { stops: 99, drive: 'mrl', speed: 's1', doors: 'ss' }, settings);
  assert.equal(r.normalized.stops, 10);
  assert.equal(r.valid, false);
  const d = calculatePrice(product, { drive: 'mrl', speed: 's1', doors: 'ss' }, settings);
  assert.equal(d.normalized.stops, 4);
  assert.equal(d.valid, true);
});

test('reports missing required choices, unknown codes and rule violations', () => {
  const r = calculatePrice(product, { drive: 'hyd', speed: 's16', extras: ['nope'] }, settings);
  assert.equal(r.valid, false);
  assert.ok(r.issues.some((i) => i.attributeKey === 'doors'));
  assert.ok(r.issues.some((i) => i.code === 'nope'));
  assert.ok(r.issues.some((i) => i.code === 'hyd'));
});

test('fills omitted choices from catalog defaults', () => {
  const withDefaults: EngineProduct = {
    ...product,
    attributes: product.attributes.map((a) => ({ ...a, options: a.options.map((o, i) => ({ ...o, isDefault: i === 0 && a.key !== 'extras' })) })),
  };
  const r = calculatePrice(withDefaults, {}, settings);
  assert.equal(r.valid, true);
  assert.deepEqual(r.normalized, { stops: 4, drive: 'mrl', speed: 's1', doors: 'ss', extras: [] });
  const explicitEmpty = calculatePrice(withDefaults, { drive: '' }, settings);
  assert.ok(explicitEmpty.issues.some((i) => i.attributeKey === 'drive'));
});
