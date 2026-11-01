import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CatalogService } from '../catalog/catalog.service';
import { pricingSettings } from '../common/settings';
import { calculatePrice, Selections } from './pricing.engine';

@Injectable()
export class PricingService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly config: ConfigService,
  ) {}

  async estimate(productSlug: string, selections: Selections) {
    const tree = await this.catalog.getTree(productSlug);
    const result = calculatePrice(this.catalog.toEngine(tree), selections, pricingSettings(this.config));
    return { product: tree, result };
  }
}
