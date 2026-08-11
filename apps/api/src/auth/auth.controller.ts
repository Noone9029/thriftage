import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import type { User } from '@thriftage/db';
import {
  provisionUserInputSchema,
  serializePrivateUserAccount,
  type PrivateUserAccount,
  type ProvisionUserInput,
} from '@thriftage/shared';

import { AuthenticationGuard } from './authentication.guard';
import { CurrentAuthContext, CurrentUser } from './current-auth.decorators';
import type { AuthenticatedRequestContext } from './auth.types';
import { LinkedUserGuard } from './linked-user.guard';
import { ProvisionUserService } from './provision-user.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@Controller('auth')
export class AuthController {
  public constructor(
    @Inject(ProvisionUserService) private readonly provisionUserService: ProvisionUserService,
  ) {}

  @Post('provision')
  @UseGuards(AuthenticationGuard)
  public async provision(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(provisionUserInputSchema)) input: ProvisionUserInput,
  ): Promise<PrivateUserAccount> {
    const user = await this.provisionUserService.provision(context, input);
    return serializePrivateUserAccount(user);
  }

  @Get('me')
  @UseGuards(AuthenticationGuard, LinkedUserGuard)
  public me(@CurrentUser() user: User): PrivateUserAccount {
    return serializePrivateUserAccount(user);
  }
}
