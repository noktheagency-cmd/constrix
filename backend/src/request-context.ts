import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

type TracedRequest = Request & { requestId?: string };
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: TracedRequest, res: Response, next: NextFunction) {
    // Generate server-side IDs rather than trusting caller-controlled log content.
    req.requestId = randomUUID();
    res.setHeader('X-Request-ID', req.requestId);
    next();
  }
}

@Catch()
export class RequestExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Request');
  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest<TracedRequest>(), res = http.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const original = exception instanceof HttpException ? exception.getResponse() : null;
    const message = status >= 500 ? 'Server xətası baş verdi. Sorğu nömrəsi ilə administratora müraciət edin.' : typeof original === 'string' ? original : (original as { message?: unknown })?.message || 'Sorğu icra edilmədi.';
    const requestId = req.requestId || randomUUID();
    if (status >= 500) this.logger.error(JSON.stringify({ requestId, method: req.method, status, error: exception instanceof Error ? exception.name : 'UnknownError' }));
    res.setHeader('X-Request-ID', requestId);
    res.status(status).json({ statusCode: status, message, requestId });
  }
}
