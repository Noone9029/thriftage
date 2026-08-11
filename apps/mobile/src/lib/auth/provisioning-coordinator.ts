import type { PrivateUserAccount } from '@thriftage/shared';

import { MobileApiError } from '../api/mobile-api-error';
import type { CurrentAccountRepositoryContract } from './current-account.repository';
import type { PendingRegistrationStoreContract } from './storage/pending-registration.store';

export type ProvisioningResolution =
  | { readonly account: PrivateUserAccount; readonly status: 'active' }
  | { readonly status: 'unprovisioned' }
  | { readonly status: 'suspended' }
  | { readonly status: 'deactivated' };

export interface ProvisioningApi {
  provisionUser(fullName: string): Promise<PrivateUserAccount>;
}

export interface ProvisioningCoordinatorContract {
  complete(fullName: string): Promise<ProvisioningResolution>;
  resolve(): Promise<ProvisioningResolution>;
}

function resolutionForAccount(account: PrivateUserAccount): ProvisioningResolution {
  switch (account.accountStatus) {
    case 'ACTIVE':
      return { account, status: 'active' };
    case 'SUSPENDED':
      return { status: 'suspended' };
    case 'DEACTIVATED':
      return { status: 'deactivated' };
  }
}

export class ProvisioningCoordinator implements ProvisioningCoordinatorContract {
  public constructor(
    private readonly accounts: CurrentAccountRepositoryContract,
    private readonly apiClient: ProvisioningApi,
    private readonly pendingRegistration: PendingRegistrationStoreContract,
  ) {}

  public async resolve(): Promise<ProvisioningResolution> {
    try {
      return resolutionForAccount(await this.accounts.get());
    } catch (error: unknown) {
      if (error instanceof MobileApiError && error.code === 'ACCOUNT_SUSPENDED') {
        return { status: 'suspended' };
      }
      if (error instanceof MobileApiError && error.code === 'ACCOUNT_DEACTIVATED') {
        return { status: 'deactivated' };
      }
      if (!(error instanceof MobileApiError) || error.code !== 'AUTH_USER_NOT_PROVISIONED') {
        throw error;
      }
    }

    const fullName = await this.pendingRegistration.getFullName();
    if (fullName === null) {
      return { status: 'unprovisioned' };
    }

    await this.apiClient.provisionUser(fullName);
    const account = await this.accounts.refresh();
    await this.pendingRegistration.clear();
    return resolutionForAccount(account);
  }

  public async complete(fullName: string): Promise<ProvisioningResolution> {
    await this.pendingRegistration.setFullName(fullName);
    return this.resolve();
  }
}
