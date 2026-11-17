// ============================================================================
// Main — Bootstrap de la aplicación NestJS
// ============================================================================

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './shared/infrastructure/filters/http-exception.filter';
import type { NextFunction, Request, Response } from 'express';
import compression from 'compression';
import * as crypto from 'crypto';
import { RequestMetricsService } from './modules/health/request-metrics.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.enableShutdownHooks();

  // No revelar la tecnología del servidor y respetar el proxy confiable
  // configurado por la plataforma de despliegue.
  app.disable('x-powered-by');
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  app.set(
    'trust proxy',
    Number.isInteger(trustProxyHops) && trustProxyHops > 0
      ? trustProxyHops
      : false,
  );

  // ── Prefijo global de API ──
  app.setGlobalPrefix('api/v1');

  // ── Filtro de excepciones global ──
  app.useGlobalFilters(new AllExceptionsFilter());

  // Identificador de trazabilidad para correlacionar una respuesta con sus
  // logs sin confiar ciegamente en valores arbitrarios del cliente.
  app.use((request: Request, response: Response, next: NextFunction) => {
    const incoming = request.get('x-request-id');
    const requestId =
      incoming && /^[a-zA-Z0-9._:-]{8,64}$/.test(incoming)
        ? incoming
        : crypto.randomUUID();
    response.setHeader('X-Request-Id', requestId);
    next();
  });

  const requestMetrics = app.get(RequestMetricsService);
  app.use((request: Request, response: Response, next: NextFunction) => {
    const started = performance.now();
    response.on('finish', () => {
      requestMetrics.record({
        method: request.method,
        path: request.path.split('?')[0].slice(0, 200),
        statusCode: response.statusCode,
        durationMs: Math.round(performance.now() - started),
      });
    });
    next();
  });

  // Encabezados de seguridad básicos para API, Swagger y descargas.
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    response.setHeader('X-DNS-Prefetch-Control', 'off');
    response.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    response.setHeader('Cache-Control', 'no-store');
    if (process.env.NODE_ENV === 'production') {
      response.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
      response.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      );
    }
    next();
  });

  app.use(compression({ threshold: 1024 }));

  // ── Validación global con class-validator ──

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Elimina propiedades no decoradas
      forbidNonWhitelisted: true, // Rechaza parámetros no declarados después de definir los DTOs de consulta
      transform: true, // Transforma payloads al tipo del DTO
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── Documentación Swagger/OpenAPI ──
  // No exponer el contrato completo de la API en producción salvo habilitación
  // explícita para reducir superficie de reconocimiento.
  const swaggerEnabled =
    process.env.NODE_ENV !== 'production' ||
    process.env.ENABLE_SWAGGER === 'true';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Academia Virtual API')
      .setDescription('API para el ERP y LMS Educativo de la Academia Virtual.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // ── CORS ──
  const configuredCorsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [];
  const corsOrigins =
    configuredCorsOrigins.length > 0 ? configuredCorsOrigins : '*';

  app.enableCors({
    origin:
      corsOrigins === '*'
        ? '*'
        : (requestOrigin, callback) => {
            if (
              !requestOrigin ||
              configuredCorsOrigins.includes(requestOrigin)
            ) {
              callback(null, true);
              return;
            }
            callback(null, false);
          },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: corsOrigins !== '*',
    exposedHeaders: ['X-Tab-Access-Token', 'X-Tab-Refresh-Token'],
  });

  const port = process.env.PORT || 3000;
  const server = await app.listen(port);
  // Evita errores 502 Bad Gateway en proxies (Cloudflare / Nginx) por cierre prematuro de Keep-Alive
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  console.log(`🚀 Servidor corriendo en http://localhost:${port}/api/v1`);
}

void bootstrap();
