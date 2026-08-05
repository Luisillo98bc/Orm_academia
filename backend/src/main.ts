// ============================================================================
// Main — Bootstrap de la aplicación NestJS
// ============================================================================

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './shared/infrastructure/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // ── Servir archivos estáticos (uploads: comprobantes, imágenes, materiales) ──
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // ── Prefijo global de API ──
  app.setGlobalPrefix('api/v1');

  // ── Filtro de excepciones global ──
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Validación global con class-validator ──

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Elimina propiedades no decoradas
      forbidNonWhitelisted: true, // Lanza error si se envían propiedades extra
      transform: true, // Transforma payloads al tipo del DTO
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── Documentación Swagger/OpenAPI ──
  const config = new DocumentBuilder()
    .setTitle('Academia Virtual API')
    .setDescription('API para el ERP y LMS Educativo de la Academia Virtual.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // ── CORS ──
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.includes(',')
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : process.env.CORS_ORIGIN
    : '*';

  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: corsOrigins !== '*',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Servidor corriendo en http://localhost:${port}/api/v1`);
}

void bootstrap();
