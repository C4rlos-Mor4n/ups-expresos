import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp['message'] as string) ?? exception.message;
        errors = resp['errors'] ?? undefined;
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Mapea errores conocidos de Prisma a respuestas HTTP adecuadas
      if (exception.code === 'P2002') {
        const conflict = new ConflictException('Record already exists');
        status = conflict.getStatus();
        message = 'Record already exists';
      } else if (exception.code === 'P2025') {
        const notFound = new NotFoundException('Record not found');
        status = notFound.getStatus();
        message = 'Record not found';
      } else if (exception.code === 'P2003') {
        const conflict = new ConflictException('Related record not found or in use');
        status = conflict.getStatus();
        message = 'Related record not found or in use';
      } else {
        this.logger.error(
          'Unhandled Prisma exception',
          exception instanceof Error ? exception.stack : String(exception),
        );
      }
    } else {
      this.logger.error(
        'Unhandled exception',
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: Record<string, unknown> = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    };
    if (errors !== undefined) {
      body['errors'] = errors;
    }

    response.status(status).json(body);
  }
}
