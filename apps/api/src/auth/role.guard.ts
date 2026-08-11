import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@thriftage/shared';

import { AuthApiException } from './auth.errors';
import { REQUIRED_ROLES_METADATA } from './require-roles.decorator';
import type { AuthenticatedHttpRequest } from './auth.types';

@Injectable()
export class RoleGuard implements CanActivate {
  public constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<readonly UserRole[]>(
      REQUIRED_ROLES_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (requiredRoles === undefined || requiredRoles.length === 0) return true;

    const user = context.switchToHttp().getRequest<AuthenticatedHttpRequest>().currentUser;
    if (user === undefined || !requiredRoles.includes(user.role)) {
      throw new AuthApiException('ADMIN_PERMISSION_DENIED');
    }
    return true;
  }
}
