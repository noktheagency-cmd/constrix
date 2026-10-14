import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from './public.decorator';
import { verifyToken } from './token';

function readCookie(header: string | undefined, name: string) {
  if (!header) return '';
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === name)
      return decodeURIComponent(trimmed.slice(eq + 1));
  }
  return '';
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string; cookie?: string };
      user?: unknown;
    }>();
    const header = request.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : '';
    const token = bearer || readCookie(request.headers.cookie, 'afez_token');
    if (!token) throw new UnauthorizedException();
    try {
      request.user = verifyToken(token);
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
