/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method */
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';

jest.mock('./app.module', () => ({ AppModule: class AppModule {} }));
jest.mock('@nestjs/swagger', () => ({
  DocumentBuilder: jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setVersion: jest.fn().mockReturnThis(),
    addBearerAuth: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({}),
  })),
  SwaggerModule: { createDocument: jest.fn(), setup: jest.fn() },
}));
jest.mock('@nestjs/core', () => ({
  NestFactory: { create: jest.fn() },
}));

describe('main bootstrap', () => {
  it('configures security, tracing, metrics, Swagger, CORS and listens', async () => {
    const metricService = { record: jest.fn() };
    const finishHandlers: Array<() => void> = [];
    const httpServer = { keepAliveTimeout: 0, headersTimeout: 0 };
    const app = {
      enableShutdownHooks: jest.fn(),
      disable: jest.fn(),
      set: jest.fn(),
      setGlobalPrefix: jest.fn(),
      useGlobalFilters: jest.fn(),
      use: jest.fn(),
      get: jest.fn().mockReturnValue(metricService),
      useGlobalPipes: jest.fn(),
      enableCors: jest.fn(),
      listen: jest.fn().mockResolvedValue(httpServer),
    };
    (NestFactory.create as jest.Mock).mockResolvedValue(app);
    (SwaggerModule.createDocument as jest.Mock).mockReturnValue({
      openapi: '3.0.0',
    });

    const previous = {
      node: process.env.NODE_ENV,
      trust: process.env.TRUST_PROXY_HOPS,
      cors: process.env.CORS_ORIGIN,
      port: process.env.PORT,
    };
    process.env.NODE_ENV = 'development';
    process.env.TRUST_PROXY_HOPS = '2';
    process.env.CORS_ORIGIN = 'https://allowed.example';
    process.env.PORT = '3010';
    jest.isolateModules(() => {
      jest.requireActual('./main');
    });
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(app.disable).toHaveBeenCalledWith('x-powered-by');
    expect(app.enableShutdownHooks).toHaveBeenCalled();
    expect(app.set).toHaveBeenCalledWith('trust proxy', 2);
    expect(app.listen).toHaveBeenCalledWith('3010');
    expect(httpServer.keepAliveTimeout).toBe(65_000);
    expect(httpServer.headersTimeout).toBe(66_000);
    expect(SwaggerModule.createDocument).toHaveBeenCalled();

    const request = {
      get: jest.fn().mockReturnValue('request-id-123'),
      method: 'POST',
      path: '/api/v1/courses?x=1',
    };
    const response = {
      statusCode: 201,
      setHeader: jest.fn(),
      on: jest.fn((_event: string, callback: () => void) =>
        finishHandlers.push(callback),
      ),
    };
    const next = jest.fn();
    const middlewares = app.use.mock.calls.map(
      ([middleware]) => middleware,
    ) as Array<Function>;
    middlewares[0](request, response, next);
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      'request-id-123',
    );
    middlewares[1](request, response, next);
    process.env.NODE_ENV = 'production';
    middlewares[2](request, response, next);
    finishHandlers.forEach((finish) => finish());
    expect(metricService.record).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', statusCode: 201 }),
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      expect.any(String),
    );

    const cors = app.enableCors.mock.calls[0][0] as {
      origin: (
        origin: string,
        callback: (error: Error | null, allowed?: boolean) => void,
      ) => void;
    };
    const callback = jest.fn();
    cors.origin('https://allowed.example', callback);
    cors.origin('https://blocked.example', callback);
    expect(callback).toHaveBeenNthCalledWith(1, null, true);
    expect(callback).toHaveBeenNthCalledWith(2, null, false);

    if (previous.node === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.node;
    if (previous.trust === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = previous.trust;
    if (previous.cors === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = previous.cors;
    if (previous.port === undefined) delete process.env.PORT;
    else process.env.PORT = previous.port;
  });
});
