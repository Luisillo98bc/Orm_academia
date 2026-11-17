import type { NextFunction, Request, Response } from 'express';
import { CsrfOriginMiddleware } from './csrf-origin.middleware';

describe('CsrfOriginMiddleware', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const middleware = new CsrfOriginMiddleware();

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  function responseMock() {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Omit<Response, 'status' | 'json'> & {
      status: jest.Mock;
      json: jest.Mock;
    };
    return response;
  }

  function requestMock(overrides: Partial<Request> = {}) {
    const request = {
      method: 'POST',
      path: '/api/v1/users/me',
      headers: {},
      ...overrides,
    } as unknown as Request & { headers: Record<string, string> };
    request.header = ((name: string) =>
      request.headers[name.toLowerCase()]) as Request['header'];
    return request;
  }

  it('allows mutating requests from the configured frontend in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = 'https://academia.example.com';
    process.env.FRONTEND_URL = 'https://academia.example.com';
    const next = jest.fn() as NextFunction;

    middleware.use(
      requestMock({
        headers: { origin: 'https://academia.example.com' },
      }),
      responseMock(),
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects mutating requests from an untrusted origin in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = 'https://academia.example.com';
    process.env.FRONTEND_URL = 'https://academia.example.com';
    const next = jest.fn() as NextFunction;
    const response = responseMock();

    middleware.use(
      requestMock({ headers: { origin: 'https://evil.example' } }),
      response,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
  });

  it('allows the Culqi webhook without browser origin headers', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = 'https://academia.example.com';
    process.env.FRONTEND_URL = 'https://academia.example.com';
    const next = jest.fn() as NextFunction;

    middleware.use(
      requestMock({ path: '/api/v1/payments/webhook/culqi' }),
      responseMock(),
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not enforce the browser-origin check outside production', () => {
    process.env.NODE_ENV = 'test';
    const next = jest.fn() as NextFunction;

    middleware.use(requestMock(), responseMock(), next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows safe methods and resolves valid or invalid referers', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = 'https://academia.example.com';
    process.env.FRONTEND_URL = 'https://academia.example.com';
    const safeNext = jest.fn() as NextFunction;
    middleware.use(
      requestMock({ method: 'OPTIONS' }),
      responseMock(),
      safeNext,
    );
    expect(safeNext).toHaveBeenCalled();

    const refererNext = jest.fn() as NextFunction;
    middleware.use(
      requestMock({
        headers: { referer: 'https://academia.example.com/path' },
      }),
      responseMock(),
      refererNext,
    );
    expect(refererNext).toHaveBeenCalled();

    const invalidNext = jest.fn() as NextFunction;
    const response = responseMock();
    middleware.use(
      requestMock({ headers: { referer: 'not-a-url' } }),
      response,
      invalidNext,
    );
    expect(response.status).toHaveBeenCalledWith(403);

    const missingOriginNext = jest.fn() as NextFunction;
    const missingOriginResponse = responseMock();
    middleware.use(requestMock(), missingOriginResponse, missingOriginNext);
    expect(missingOriginResponse.status).toHaveBeenCalledWith(403);
  });
});
