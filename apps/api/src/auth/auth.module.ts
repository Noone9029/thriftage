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
import {
  MARKETPLACE_EVENT_PUBLISHER,
  type MarketplaceEventPublisher,
} from '../common/marketplace-event-publisher';
import { MarketplaceEventsModule } from '../common/marketplace-events.module';

@Module({
  controllers: [AuthController],
  imports: [MarketplaceEventsModule],
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
      inject: [AUTHORITATIVE_AUTH_USER_PROVIDER, MARKETPLACE_EVENT_PUBLISHER],
      useFactory: (authUserProvider: SupabaseAuthAdapter, events: MarketplaceEventPublisher) =>
        new ProvisionUserService(
          authUserProvider,
          () => loadApiConfig(process.env).registrationEnabled,
          events,
        ),
    },
  ],
})
export class AuthModule {}
