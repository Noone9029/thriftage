import { Module } from '@nestjs/common';
import { loadApiConfig } from '@thriftage/config/api';

import { AuthModule } from '../auth/auth.module';
import { AUTH_ADMIN_PROVIDER, type AuthAdminProvider } from './auth-admin-provider.interface';
import {
  PHONE_VERIFICATION_POLICY,
  PHONE_VERIFICATION_REPOSITORY,
  PhoneLinkingService,
  type PhoneVerificationPolicy,
} from './phone-linking.service';
import {
  PHONE_VERIFICATION_PROVIDER,
  type PhoneVerificationProvider,
} from './phone-verification-provider.interface';
import { PhoneVerificationController } from './phone-verification.controller';
import {
  PhoneVerificationRepository,
  type PhoneVerificationRepositoryContract,
} from './phone-verification.repository';
import { createSupabaseAuthAdminAdapter } from './supabase-auth-admin.adapter';
import { createTwilioVerifyAdapter } from './twilio-verify.adapter';

@Module({
  controllers: [PhoneVerificationController],
  imports: [AuthModule],
  providers: [
    {
      provide: PHONE_VERIFICATION_PROVIDER,
      useFactory: () => createTwilioVerifyAdapter(),
    },
    {
      provide: AUTH_ADMIN_PROVIDER,
      useFactory: () => createSupabaseAuthAdminAdapter(),
    },
    {
      provide: PHONE_VERIFICATION_REPOSITORY,
      useFactory: () => new PhoneVerificationRepository(),
    },
    {
      provide: PHONE_VERIFICATION_POLICY,
      useFactory: (): PhoneVerificationPolicy =>
        Object.defineProperties(
          {},
          {
            attemptTtlSeconds: {
              enumerable: true,
              get: () => loadApiConfig(process.env).phoneVerificationAttemptTtlSeconds,
            },
            enabled: {
              enumerable: true,
              get: () => loadApiConfig(process.env).phoneAuthEnabled,
            },
            maxChecks: {
              enumerable: true,
              get: () => loadApiConfig(process.env).phoneVerificationMaxChecks,
            },
            maxSends: {
              enumerable: true,
              get: () => loadApiConfig(process.env).phoneVerificationMaxSends,
            },
            maxStarts: {
              enumerable: true,
              get: () => loadApiConfig(process.env).phoneVerificationMaxStarts,
            },
            resendCooldownSeconds: {
              enumerable: true,
              get: () => loadApiConfig(process.env).phoneVerificationResendCooldownSeconds,
            },
            startWindowSeconds: {
              enumerable: true,
              get: () => loadApiConfig(process.env).phoneVerificationStartWindowSeconds,
            },
          },
        ) as PhoneVerificationPolicy,
    },
    {
      provide: PhoneLinkingService,
      inject: [
        PHONE_VERIFICATION_PROVIDER,
        AUTH_ADMIN_PROVIDER,
        PHONE_VERIFICATION_REPOSITORY,
        PHONE_VERIFICATION_POLICY,
      ],
      useFactory: (
        verificationProvider: PhoneVerificationProvider,
        authAdminProvider: AuthAdminProvider,
        repository: PhoneVerificationRepositoryContract,
        policy: PhoneVerificationPolicy,
      ) => new PhoneLinkingService(verificationProvider, authAdminProvider, repository, policy),
    },
  ],
})
export class PhoneVerificationModule {}
