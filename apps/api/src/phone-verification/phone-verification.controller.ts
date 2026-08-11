import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@thriftage/db';
import {
  phoneVerificationStartInputSchema,
  phoneVerificationVerifyInputSchema,
  serializePrivateUserAccount,
  type PhoneVerificationChallenge,
  type PhoneVerificationStartInput,
  type PhoneVerificationVerifyInput,
  type PrivateUserAccount,
} from '@thriftage/shared';

import { AuthenticationGuard } from '../auth/authentication.guard';
import { CurrentUser } from '../auth/current-auth.decorators';
import { LinkedUserGuard } from '../auth/linked-user.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PhoneLinkingService } from './phone-linking.service';

@Controller('auth/phone-verification')
@UseGuards(AuthenticationGuard, LinkedUserGuard)
export class PhoneVerificationController {
  public constructor(
    @Inject(PhoneLinkingService) private readonly phoneLinkingService: PhoneLinkingService,
  ) {}

  @Post('start')
  @HttpCode(HttpStatus.OK)
  public start(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(phoneVerificationStartInputSchema))
    input: PhoneVerificationStartInput,
  ): Promise<PhoneVerificationChallenge> {
    return this.phoneLinkingService.start(user, input);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  public async verify(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(phoneVerificationVerifyInputSchema))
    input: PhoneVerificationVerifyInput,
  ): Promise<PrivateUserAccount> {
    return serializePrivateUserAccount(await this.phoneLinkingService.verify(user, input));
  }

  @Post(':attemptId/resend')
  @HttpCode(HttpStatus.OK)
  public resend(
    @CurrentUser() user: User,
    @Param('attemptId', new ParseUUIDPipe({ version: '4' })) attemptId: string,
  ): Promise<PhoneVerificationChallenge> {
    return this.phoneLinkingService.resend(user, attemptId);
  }

  @Get('current')
  public current(@CurrentUser() user: User): Promise<PhoneVerificationChallenge | null> {
    return this.phoneLinkingService.current(user);
  }

  @Delete('current')
  @HttpCode(HttpStatus.NO_CONTENT)
  public cancel(@CurrentUser() user: User): Promise<void> {
    return this.phoneLinkingService.cancel(user);
  }
}
