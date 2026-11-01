// Pure pricing logic: no Nest, no Prisma. Everything the engine needs is passed in,
// which keeps it unit-testable and reusable from any channel.

export type InputType = 'SINGLE' | 'MULTI' | 'NUMBER';
export type PriceType = 'FIXED' | 'PER_UNIT' | 'PERCENT';
export type RuleType = 'REQUIRES' | 'EXCLUDES';

export interface EngineOption {
  code: string;
  labelAr: string;
  priceType: PriceType;
  price: number;
  unitAttributeKey: string | null;
  isActive: boolean;
  isDefault?: boolean;
}

export interface EngineAttribute {
  key: string;
  labelAr: string;
  inputType: InputType;
  required: boolean;
  min: number | null;
  max: number | null;
  defaultValue: number | null;
  unitAr: string | null;
  includedUnits: number;
  unitPrice: number;
  options: EngineOption[];
}

export interface EngineRule {
  type: RuleType;
  optionCode: string;
  targetCode: string;
  messageAr: string | null;
}

export interface EngineProduct {
  slug: string;
  nameAr: string;
  basePrice: number;
  attributes: EngineAttribute[];
  rules: EngineRule[];
}

export interface PricingSettings {
  vatRate: number;
  estimateMargin: number;
  currency: string;
}

export type SelectionValue = string | string[] | number;
export type Selections = Record<string, SelectionValue>;

export interface PriceLine {
  attributeKey: string | null;
  labelAr: string;
  valueAr: string;
  amount: number;
}

export interface PriceIssue {
  attributeKey?: string;
  code?: string;
  messageAr: string;
}

export interface PriceResult {
  productSlug: string;
  currency: string;
  lines: PriceLine[];
  subtotal: number;
  vat: number;
  total: number;
  estimateLow: number;
  estimateHigh: number;
  valid: boolean;
  issues: PriceIssue[];
  /// Selections after defaults were filled in; store this with a quote.
  normalized: Selections;
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

export function calculatePrice(
  product: EngineProduct,
  input: Selections,
  settings: PricingSettings,
): PriceResult {
  const issues: PriceIssue[] = [];
  const normalized: Selections = {};
  const selectedCodes = new Set<string>();
  const optionLabel = new Map<string, string>();
  const numbers: Record<string, number> = {};

  // 1. Normalize and validate every attribute, filling NUMBER defaults.
  for (const attr of product.attributes) {
    const raw = input[attr.key];
    const active = attr.options.filter((o) => o.isActive);
    active.forEach((o) => optionLabel.set(o.code, o.labelAr));

    if (attr.inputType === 'NUMBER') {
      let value = typeof raw === 'number' ? raw : Number(raw ?? attr.defaultValue ?? attr.min ?? 0);
      if (!Number.isFinite(value)) value = attr.defaultValue ?? attr.min ?? 0;
      value = Math.round(value);
      if (attr.min != null && value < attr.min) {
        issues.push({ attributeKey: attr.key, messageAr: `${attr.labelAr}: أقل قيمة ${attr.min}` });
        value = attr.min;
      }
      if (attr.max != null && value > attr.max) {
        issues.push({ attributeKey: attr.key, messageAr: `${attr.labelAr}: أقصى قيمة ${attr.max}` });
        value = attr.max;
      }
      numbers[attr.key] = value;
      normalized[attr.key] = value;
      continue;
    }

    // Omitted answers fall back to the catalog defaults, so callers can send partial selections.
    const given = raw === undefined ? active.filter((o) => o.isDefault).map((o) => o.code).slice(0, attr.inputType === 'SINGLE' ? 1 : undefined) : raw;
    const codes = (Array.isArray(given) ? given : given == null || given === '' ? [] : [String(given)]).filter(
      (c, i, arr) => arr.indexOf(c) === i,
    );
    const valid = codes.filter((c) => active.some((o) => o.code === c));
    codes
      .filter((c) => !valid.includes(c))
      .forEach((c) => issues.push({ attributeKey: attr.key, code: c, messageAr: `${attr.labelAr}: اختيار غير متاح` }));

    if (attr.inputType === 'SINGLE') {
      if (valid.length > 1) issues.push({ attributeKey: attr.key, messageAr: `${attr.labelAr}: اختيار واحد فقط` });
      if (valid.length === 0 && attr.required)
        issues.push({ attributeKey: attr.key, messageAr: `${attr.labelAr}: مطلوب` });
      if (valid[0]) {
        normalized[attr.key] = valid[0];
        selectedCodes.add(valid[0]);
      }
    } else {
      if (valid.length === 0 && attr.required)
        issues.push({ attributeKey: attr.key, messageAr: `${attr.labelAr}: اختر بنداً واحداً على الأقل` });
      normalized[attr.key] = valid;
      valid.forEach((c) => selectedCodes.add(c));
    }
  }

  // 2. Compatibility rules.
  for (const rule of product.rules) {
    if (!selectedCodes.has(rule.optionCode)) continue;
    const a = optionLabel.get(rule.optionCode) ?? rule.optionCode;
    const b = optionLabel.get(rule.targetCode) ?? rule.targetCode;
    if (rule.type === 'EXCLUDES' && selectedCodes.has(rule.targetCode)) {
      issues.push({ code: rule.optionCode, messageAr: rule.messageAr ?? `"${a}" لا يتوافق مع "${b}"` });
    }
    if (rule.type === 'REQUIRES' && !selectedCodes.has(rule.targetCode)) {
      issues.push({ code: rule.optionCode, messageAr: rule.messageAr ?? `"${a}" يتطلب اختيار "${b}"` });
    }
  }

  // 3. Price lines.
  const lines: PriceLine[] = [{ attributeKey: null, labelAr: 'السعر الأساسي', valueAr: product.nameAr, amount: product.basePrice }];
  const percentOptions: { attr: EngineAttribute; opt: EngineOption }[] = [];

  for (const attr of product.attributes) {
    if (attr.inputType === 'NUMBER') {
      const value = numbers[attr.key];
      const extra = Math.max(0, value - attr.includedUnits) * attr.unitPrice;
      lines.push({
        attributeKey: attr.key,
        labelAr: attr.labelAr,
        valueAr: `${value}${attr.unitAr ? ' ' + attr.unitAr : ''}`,
        amount: extra,
      });
      continue;
    }
    const codes = ([] as string[]).concat((normalized[attr.key] as string | string[] | undefined) ?? []);
    for (const code of codes) {
      const opt = attr.options.find((o) => o.code === code)!;
      if (opt.priceType === 'PERCENT') {
        percentOptions.push({ attr, opt });
        continue;
      }
      let amount = opt.price;
      let valueAr = opt.labelAr;
      if (opt.priceType === 'PER_UNIT') {
        const qty = opt.unitAttributeKey ? numbers[opt.unitAttributeKey] ?? 0 : 1;
        amount = opt.price * qty;
        valueAr = `${opt.labelAr} × ${qty}`;
      }
      lines.push({ attributeKey: attr.key, labelAr: attr.labelAr, valueAr, amount });
    }
  }

  const fixedSubtotal = lines.reduce((s, l) => s + l.amount, 0);
  for (const { attr, opt } of percentOptions) {
    lines.push({
      attributeKey: attr.key,
      labelAr: attr.labelAr,
      valueAr: `${opt.labelAr} (${opt.price}%)`,
      amount: Math.round((fixedSubtotal * opt.price) / 100),
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const vat = Math.round(subtotal * settings.vatRate);
  const total = subtotal + vat;

  return {
    productSlug: product.slug,
    currency: settings.currency,
    lines,
    subtotal,
    vat,
    total,
    estimateLow: roundTo(total * (1 - settings.estimateMargin), 1000),
    estimateHigh: roundTo(total * (1 + settings.estimateMargin), 1000),
    valid: issues.length === 0,
    issues,
    normalized,
  };
}
