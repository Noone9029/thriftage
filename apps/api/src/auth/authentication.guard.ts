import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';

import { AuthApiException, mapTokenVerificationError } from './auth.errors';
import { AUTH_TOKEN_VERIFIER, type AuthTokenVerifier } from './auth-provider.interface';
import type { AuthenticatedHttpRequest } from './auth.types';
import { extractBearerToken } from './bearer-token';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  private readonly logger = new Logger(AuthenticationGuard.name);

  public constructor(
    @Inject(AUTH_TOKEN_VERIFIER) private readonly tokenVerifier: AuthTokenVerifier,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedHttpRequest>();
    let accessToken: string;
    try {
      accessToken = extractBearerToken(request.headers.authorization);
    } catch (error: unknown) {
      this.logger.warn('Authentication rejected: code=AUTH_REQUIRED');
      if (error instanceof AuthApiException) {
        throw error;
      }
      throw new AuthApiException('AUTH_REQUIRED');
    }

    try {
      const identity = await this.tokenVerifier.verifyAccessToken(accessToken);
      request.authContext = Object.freeze({ accessToken, identity });
      return true;
    } catch (error: unknown) {
      const apiError = mapTokenVerificationError(error);
      this.logger.warn(`Authentication rejected: code=${apiError.code}`);
      throw apiError;
    }
  }
}
