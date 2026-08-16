import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import {
  accountDeletionConfirmationInputSchema,
  type AccountDeletionConfirmationInput,
  type AccountDeletionStatus,
} from '@thriftage/shared';

import { AccountDeletionService } from './account-deletion.service';
import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentAuthContext } from '../auth/current-auth.decorators';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@Controller('privacy/account-deletion')
@UseGuards(AuthenticationGuard)
export class AccountDeletionController {
  public constructor(
    @Inject(AccountDeletionService) private readonly accountDeletion: AccountDeletionService,
  ) {}

  @Post()
  public request(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(accountDeletionConfirmationInputSchema))
    input: AccountDeletionConfirmationInput,
  ): Promise<AccountDeletionStatus> {
    void input;
    return this.accountDeletion.request(context);
  }

  @Get()
  public status(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
  ): Promise<AccountDeletionStatus> {
    return this.accountDeletion.status(context);
  }
}
