import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { QuotePdfService } from './quote-pdf.service';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [PricingModule, WebhooksModule],
  controllers: [QuotesController],
  providers: [QuotesService, QuotePdfService],
  exports: [QuotesService],
})
export class QuotesModule {}
