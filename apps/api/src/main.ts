import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // All routes live under /api/v1/... so future breaking changes can ship as /api/v2.
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableCors({ origin: (config.get<string>('CORS_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean) });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();

  const doc = new DocumentBuilder()
    .setTitle('Alaman Elevators API')
    .setDescription('Configurator, pricing and quotes API for elevators and escalators.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc), { jsonDocumentUrl: 'api/docs-json' });

  const port = Number(config.get('PORT') ?? 4000);
  await app.listen(port);
  console.log(`API on http://localhost:${port}/api/v1  ·  docs on http://localhost:${port}/api/docs`);
}
void bootstrap();
