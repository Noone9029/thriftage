import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';

import { ApplicationUserResolver } from './application-user-resolver.service';
import { AuthApiException } from './auth.errors';
import type { AuthenticatedHttpRequest } from './auth.types';

@Injectable()
export class LinkedUserGuard implements CanActivate {
  public constructor(
    @Inject(ApplicationUserResolver) private readonly userResolver: ApplicationUserResolver,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedHttpRequest>();
    if (request.authContext === undefined) {
      throw new AuthApiException('AUTH_REQUIRED');
    }

    const resolution = await this.userResolver.resolve(request.authContext.identity);
    switch (resolution.state) {
      case 'not_provisioned':
        throw new AuthApiException('AUTH_USER_NOT_PROVISIONED');
      case 'suspended':
        throw new AuthApiException('ACCOUNT_SUSPENDED');
      case 'deactivated':
        throw new AuthApiException('ACCOUNT_DEACTIVATED');
      case 'active':
        request.currentUser = resolution.user;
        return true;
    }
  }
}
