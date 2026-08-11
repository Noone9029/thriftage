import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';

import { ApplicationUserResolver } from './application-user-resolver.service';
import { AuthApiException, mapTokenVerificationError } from './auth.errors';
import { AUTH_TOKEN_VERIFIER, type AuthTokenVerifier } from './auth-provider.interface';
import { extractBearerToken } from './bearer-token';
import type { AuthenticatedHttpRequest } from './auth.types';

@Injectable()
export class OptionalAuthenticationGuard implements CanActivate {
  public constructor(
    @Inject(AUTH_TOKEN_VERIFIER) private readonly tokenVerifier: AuthTokenVerifier,
    @Inject(ApplicationUserResolver) private readonly userResolver: ApplicationUserResolver,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedHttpRequest>();
    if (request.headers.authorization === undefined) return true;

    try {
      const accessToken = extractBearerToken(request.headers.authorization);
      const identity = await this.tokenVerifier.verifyAccessToken(accessToken);
      request.authContext = Object.freeze({ accessToken, identity });
      const resolution = await this.userResolver.resolve(identity);
      switch (resolution.state) {
        case 'active':
          request.currentUser = resolution.user;
          return true;
        case 'not_provisioned':
          throw new AuthApiException('AUTH_USER_NOT_PROVISIONED');
        case 'suspended':
          throw new AuthApiException('ACCOUNT_SUSPENDED');
        case 'deactivated':
          throw new AuthApiException('ACCOUNT_DEACTIVATED');
      }
    } catch (error: unknown) {
      if (error instanceof AuthApiException) throw error;
      throw mapTokenVerificationError(error);
    }
  }
}
