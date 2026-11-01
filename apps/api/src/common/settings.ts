import { ConfigService } from '@nestjs/config';
import { PricingSettings } from '../pricing/pricing.engine';

export const pricingSettings = (config: ConfigService): PricingSettings => ({
  vatRate: Number(config.get('VAT_RATE') ?? 0.14),
  estimateMargin: Number(config.get('ESTIMATE_MARGIN') ?? 0.07),
  currency: config.get('CURRENCY') ?? 'EGP',
});
