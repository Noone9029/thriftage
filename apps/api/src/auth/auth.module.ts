import { Module } from '@nestjs/common';
import { loadApiConfig } from '@thriftage/config/api';

import { ApplicationUserResolver } from './application-user-resolver.service';
import { AuthController } from './auth.controller';
import { AUTHORITATIVE_AUTH_USER_PROVIDER, AUTH_TOKEN_VERIFIER } from './auth-provider.interface';
import { AuthenticationGuard } from './authentication.guard';
import { LinkedUserGuard } from './linked-user.guard';
import { OptionalAuthenticationGuard } from './optional-authentication.guard';
import { ProvisionUserService } from './provision-user.service';
import { RoleGuard } from './role.guard';
import { SupabaseAuthAdapter } from './supabase-auth.adapter';

@Module({
  controllers: [AuthController],
  exports: [
    ApplicationUserResolver,
    AuthenticationGuard,
    AUTH_TOKEN_VERIFIER,
    LinkedUserGuard,
    OptionalAuthenticationGuard,
    RoleGuard,
  ],
  providers: [
    {
      provide: SupabaseAuthAdapter,
      useFactory: () => new SupabaseAuthAdapter(),
    },
    { provide: AUTH_TOKEN_VERIFIER, useExisting: SupabaseAuthAdapter },
    { provide: AUTHORITATIVE_AUTH_USER_PROVIDER, useExisting: SupabaseAuthAdapter },
    ApplicationUserResolver,
    AuthenticationGuard,
    LinkedUserGuard,
    OptionalAuthenticationGuard,
    RoleGuard,
    {
      provide: ProvisionUserService,
      inject: [AUTHORITATIVE_AUTH_USER_PROVIDER],
      useFactory: (authUserProvider: SupabaseAuthAdapter) =>
        new ProvisionUserService(
          authUserProvider,
          () => loadApiConfig(process.env).registrationEnabled,
        ),
    },
  ],
})
export class AuthModule {}
