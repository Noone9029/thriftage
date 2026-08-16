import { Inject, Injectable, Logger } from '@nestjs/common';
import { loadApiConfig } from '@thriftage/config/api';
import type { AccountDeletionRequest } from '@thriftage/db';
import { accountDeletionStatusSchema, type AccountDeletionStatus } from '@thriftage/shared';

import {
  ACCOUNT_DELETION_AUTH_ADMIN,
  type AccountDeletionAuthAdmin,
} from './account-deletion-auth.interface';
import { AccountDeletionApiException, mapAccountDeletionError } from './account-deletion.errors';
import { AccountDeletionRepository } from './account-deletion.repository';
import type { AuthenticatedRequestContext } from '../auth/auth.types';

export function serializeAccountDeletionStatus(
  request: AccountDeletionRequest,
): AccountDeletionStatus {
  return accountDeletionStatusSchema.parse({
    completedAt: request.completedAt?.toISOString() ?? null,
    requestedAt: request.requestedAt.toISOString(),
    status: request.status,
  });
}

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  public constructor(
    @Inject(AccountDeletionRepository) private readonly repository: AccountDeletionRepository,
    @Inject(ACCOUNT_DELETION_AUTH_ADMIN) private readonly authAdmin: AccountDeletionAuthAdmin,
  ) {}

  public async request(context: AuthenticatedRequestContext): Promise<AccountDeletionStatus> {
    try {
      const existing = await this.repository.findForAuthProvider(
        context.identity.authProviderUserId,
      );
      if (existing !== null) return serializeAccountDeletionStatus(existing);

      const config = loadApiConfig(process.env);
      if (!config.accountDeletionEnabled) {
        throw new AccountDeletionApiException('ACCOUNT_DELETION_DISABLED');
      }
      const issuedAt = context.identity.issuedAt;
      const now = Date.now();
      if (
        issuedAt === undefined ||
        issuedAt.getTime() > now + 60_000 ||
        now - issuedAt.getTime() > config.accountDeletionReauthMaxAgeSeconds * 1_000
      ) {
        throw new AccountDeletionApiException('ACCOUNT_DELETION_REAUTH_REQUIRED');
      }

      const user = await this.repository.findUserForAuthProvider(
        context.identity.authProviderUserId,
      );
      if (user === null || user.accountStatus !== 'ACTIVE') {
        throw new AccountDeletionApiException('ACCOUNT_DELETION_NOT_FOUND');
      }
      const request = await this.repository.request(user.id, context.identity.authProviderUserId);

      try {
        await this.authAdmin.revokeSession(context.accessToken);
        await this.repository.markSessionRevoked(request.id);
      } catch {
        this.logger.warn(
          `Account deletion session revocation deferred: requestId=${request.id} code=AUTH_SESSION_REVOCATION_FAILED`,
        );
      }
      return serializeAccountDeletionStatus(request);
    } catch (error: unknown) {
      throw mapAccountDeletionError(error);
    }
  }

  public async status(context: AuthenticatedRequestContext): Promise<AccountDeletionStatus> {
    const request = await this.repository.findForAuthProvider(context.identity.authProviderUserId);
    if (request === null) throw new AccountDeletionApiException('ACCOUNT_DELETION_NOT_FOUND');
    return serializeAccountDeletionStatus(request);
  }
}
