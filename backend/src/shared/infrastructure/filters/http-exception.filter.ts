import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Error interno del servidor';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        message = resObj.message || exception.message;
        error = resObj.error || exception.name;
      } else {
        message = res;
        error = exception.name;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Manejo específico de errores conocidos de Prisma
      switch (exception.code) {
        case 'P2002': {
          status = HttpStatus.CONFLICT;
          const target =
            (exception.meta?.target as string[])?.join(', ') || 'campo';
          message = `Ya existe un registro con el mismo valor para: ${target}`;
          error = 'Conflict';
          break;
        }
        case 'P2003': {
          status = HttpStatus.BAD_REQUEST;
          message =
            'Violación de restricción de clave foránea en la base de datos';
          error = 'Bad Request';
          break;
        }
        case 'P2025': {
          status = HttpStatus.NOT_FOUND;
          message =
            'El recurso solicitado no fue encontrado en la base de datos';
          error = 'Not Found';
          break;
        }
        default: {
          status = HttpStatus.BAD_REQUEST;
          message = `Error de base de datos (${exception.code})`;
          error = 'Database Error';
          break;
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Error no controlado: ${exception.message}`,
        exception.stack,
      );
      message = exception.message;
    }

    // Formatear mensaje si es un arreglo (class-validator)
    if (Array.isArray(message)) {
      message = message.join('. ');
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
