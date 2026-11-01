// Mirrors the public REST contract of apps/api.
export type InputType = 'SINGLE' | 'MULTI' | 'NUMBER';
export type PriceType = 'FIXED' | 'PER_UNIT' | 'PERCENT';
export type RuleType = 'REQUIRES' | 'EXCLUDES';
export type QuoteStatus = 'NEW' | 'CONTACTED' | 'QUOTED' | 'WON' | 'LOST';

export interface ProductSummary {
  id: string;
  slug: string;
  kind: 'ELEVATOR' | 'ESCALATOR';
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  imageUrl: string | null;
  basePrice: number;
}

export interface Option {
  code: string;
  labelAr: string;
  labelEn: string;
  descriptionAr: string | null;
  imageUrl: string | null;
  swatch: string | null;
  priceType: PriceType;
  price: number;
  unitAttributeKey: string | null;
  isDefault: boolean;
}

export interface Attribute {
  key: string;
  labelAr: string;
  labelEn: string;
  helpAr: string | null;
  inputType: InputType;
  required: boolean;
  min: number | null;
  max: number | null;
  defaultValue: number | null;
  unitAr: string | null;
  includedUnits: number;
  unitPrice: number;
  options: Option[];
}

export interface Step {
  key: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string | null;
  attributes: Attribute[];
}

export interface Rule {
  type: RuleType;
  optionCode: string;
  targetCode: string;
  messageAr: string | null;
}

export interface Configurator extends ProductSummary {
  steps: Step[];
  rules: Rule[];
}

export type Selections = Record<string, string | string[] | number>;

export interface PriceLine {
  attributeKey: string | null;
  labelAr: string;
  valueAr: string;
  amount: number;
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
  issues: { attributeKey?: string; code?: string; messageAr: string }[];
}

export interface PublicQuote {
  id: string;
  number: string;
  publicToken: string;
  status: QuoteStatus;
  customerName: string;
  city: string | null;
  breakdown: PriceLine[];
  subtotal: number;
  vat: number;
  total: number;
  estimateLow: number;
  estimateHigh: number;
  currency: string;
  createdAt: string;
  product: { slug: string; nameAr: string; nameEn: string; kind: string };
}

export interface AdminQuote extends Omit<PublicQuote, 'product'> {
  phone: string;
  whatsapp: string | null;
  email: string | null;
  projectType: string | null;
  notes: string | null;
  source: string;
  selections: Selections;
  product: { slug: string; nameAr: string };
}
