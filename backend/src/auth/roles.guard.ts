import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { can, isRole, ROUTE_AREAS } from './access';
import { AuthUser } from './auth.service';
import { IS_PUBLIC } from './public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ url?: string; user?: AuthUser }>();
    const user = request.user;
    if (!user || !isRole(user.role))
      throw new ForbiddenException(
        'Bu əməliyyat sizin rolunuz üçün açıq deyil.',
      );

    const path = (request.url ?? '').split('?')[0] ?? '';
    const segment =
      path
        .replace(/^\/api\/?/, '')
        .split('/')
        .filter(Boolean)[0] ?? '';
    if (!segment || segment === 'auth' || segment === 'platform') return true;
    if (segment === 'users') {
      if (user.role !== 'director')
        throw new ForbiddenException(
          'Bu əməliyyat sizin rolunuz üçün açıq deyil.',
        );
      return true;
    }

    const area = ROUTE_AREAS[segment];
    if (!area || !can(user.role, area)) {
      throw new ForbiddenException(
        'Bu əməliyyat sizin rolunuz üçün açıq deyil.',
      );
    }
    return true;
  }
}
