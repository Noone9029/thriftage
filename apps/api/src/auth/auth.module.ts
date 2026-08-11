import { Module } from '@nestjs/common';

import { ApplicationUserResolver } from './application-user-resolver.service';
import { AuthController } from './auth.controller';
import { AUTHORITATIVE_AUTH_USER_PROVIDER, AUTH_TOKEN_VERIFIER } from './auth-provider.interface';
import { AuthenticationGuard } from './authentication.guard';
import { LinkedUserGuard } from './linked-user.guard';
import { ProvisionUserService } from './provision-user.service';
import { SupabaseAuthAdapter } from './supabase-auth.adapter';

@Module({
  controllers: [AuthController],
  exports: [ApplicationUserResolver, AuthenticationGuard, AUTH_TOKEN_VERIFIER, LinkedUserGuard],
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
    ProvisionUserService,
  ],
})
export class AuthModule {}
