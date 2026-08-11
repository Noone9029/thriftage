import { mobileConfig } from '../../config/mobile-config';
import { ThriftageApiClient, type ApiSessionProvider } from '../api/thriftage-api-client';
import { queryClient } from '../query-client';
import { CurrentAccountRepository } from './current-account.repository';
import { MobileAuthController } from './mobile-auth-controller';
import { ProvisioningCoordinator } from './provisioning-coordinator';
import {
  EMAIL_CONFIRMATION_REDIRECT_URL,
  mobileAuthGateway,
  PASSWORD_RECOVERY_REDIRECT_URL,
} from './supabase-client';
import { authStorage } from './storage/auth-storage';
import { PendingRegistrationStore } from './storage/pending-registration.store';

class SupabaseApiSessionProvider implements ApiSessionProvider {
  private invalidationHandler: () => void = () => undefined;

  public setInvalidationHandler(handler: () => void): void {
    this.invalidationHandler = handler;
  }

  public async getAccessToken(): Promise<string | null> {
    return (await mobileAuthGateway.getSession())?.access_token ?? null;
  }

  public async refreshAccessToken(): Promise<string | null> {
    return (await mobileAuthGateway.refreshSession())?.access_token ?? null;
  }

  public sessionBecameInvalid(): void {
    this.invalidationHandler();
  }
}

const sessionProvider = new SupabaseApiSessionProvider();
export const thriftageApiClient = new ThriftageApiClient(mobileConfig.apiUrl, sessionProvider);
export const currentAccountRepository = new CurrentAccountRepository(
  queryClient,
  thriftageApiClient,
);
export const pendingRegistrationStore = new PendingRegistrationStore(authStorage);
export const provisioningCoordinator = new ProvisioningCoordinator(
  currentAccountRepository,
  thriftageApiClient,
  pendingRegistrationStore,
);
export const mobileAuthController = new MobileAuthController(
  mobileAuthGateway,
  provisioningCoordinator,
  currentAccountRepository,
  pendingRegistrationStore,
  {
    emailConfirmation: EMAIL_CONFIRMATION_REDIRECT_URL,
    passwordRecovery: PASSWORD_RECOVERY_REDIRECT_URL,
  },
);
sessionProvider.setInvalidationHandler(mobileAuthController.sessionBecameInvalid);
