import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CatalogModule } from '../catalog/catalog.module';
import { QuotesModule } from '../quotes/quotes.module';
import { AdminAuthController, AdminCatalogController, AdminQuotesController, AdminWebhooksController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AuthService } from './auth.service';

@Module({
  imports: [
    CatalogModule,
    QuotesModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '12h' },
      }),
    }),
  ],
  controllers: [AdminAuthController, AdminCatalogController, AdminQuotesController, AdminWebhooksController],
  providers: [AuthService, AdminGuard],
})
export class AdminModule {}
