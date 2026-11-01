import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { AdminModule } from './admin/admin.module';
import { CatalogModule } from './catalog/catalog.module';
import { PricingModule } from './pricing/pricing.module';
import { PrismaModule } from './prisma/prisma.module';
import { QuotesModule } from './quotes/quotes.module';

@ApiTags('health')
@Controller('health')
class HealthController {
  @Get()
  health() {
    return { status: 'ok', time: new Date().toISOString() };
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, CatalogModule, PricingModule, QuotesModule, AdminModule],
  controllers: [HealthController],
})
export class AppModule {}
