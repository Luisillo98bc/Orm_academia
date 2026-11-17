import {
  BadRequestException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  type ArgumentsHost,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './http-exception.filter';

function executeFilter(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnThis();
  const response = {
    getHeader: jest.fn().mockReturnValue('request-1'),
    status,
    json,
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url: '/api/test' }),
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);
  return { json, status };
}

function prismaError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('database error', {
    code,
    clientVersion: '6.19.3',
    meta,
  });
}

describe('AllExceptionsFilter', () => {
  it('formats structured HTTP exceptions and validation arrays', () => {
    const { status, json } = executeFilter(
      new BadRequestException({
        message: ['email inválido', 'clave corta'],
        error: 'Bad Request',
      }),
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'email inválido. clave corta',
        path: '/api/test',
        requestId: 'request-1',
      }),
    );
  });

  it('supports HTTP exceptions with string responses', () => {
    const { status, json } = executeFilter(
      new HttpException('no autorizado', HttpStatus.UNAUTHORIZED),
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'no autorizado',
        error: 'HttpException',
      }),
    );
  });

  it.each([
    ['P2002', HttpStatus.CONFLICT, 'Conflict'],
    ['P2003', HttpStatus.BAD_REQUEST, 'Bad Request'],
    ['P2025', HttpStatus.NOT_FOUND, 'Not Found'],
    ['P2010', HttpStatus.BAD_REQUEST, 'Database Error'],
  ])('maps Prisma error %s', (code, expectedStatus, expectedError) => {
    const { status, json } = executeFilter(
      prismaError(code, code === 'P2002' ? { target: ['email'] } : undefined),
    );

    expect(status).toHaveBeenCalledWith(expectedStatus);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expectedError }),
    );
  });

  it('hides internal error details for generic exceptions', () => {
    const { status, json } = executeFilter(
      new Error('database password leaked'),
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Error interno del servidor',
        requestId: 'request-1',
      }),
    );
  });

  it('uses the default response for unknown thrown values', () => {
    const { status, json } = executeFilter('unexpected');

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Internal Server Error',
        message: 'Error interno del servidor',
      }),
    );
  });

  it('keeps standard Nest responses intact', () => {
    const { json } = executeFilter(new NotFoundException('missing'));
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: HttpStatus.NOT_FOUND }),
    );
    expect(new InternalServerErrorException().getStatus()).toBe(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  });
});
