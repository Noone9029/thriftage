import type { PrivateUserAccount } from '@thriftage/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MobileApiError } from '../api/mobile-api-error';
import type { CurrentAccountRepositoryContract } from './current-account.repository';
import { ProvisioningCoordinator, type ProvisioningApi } from './provisioning-coordinator';
import type { PendingRegistrationStoreContract } from './storage/pending-registration.store';

const activeAccount: PrivateUserAccount = {
  accountStatus: 'ACTIVE',
  createdAt: '2026-08-10T00:00:00.000Z',
  email: 'user@example.com',
  emailVerified: true,
  fullName: 'Ayesha Khan',
  id: 'f4a24a69-563f-4d76-a657-2f672b2789d2',
  phone: null,
  phoneVerified: false,
  role: 'USER',
  updatedAt: '2026-08-10T00:00:00.000Z',
};

describe('ProvisioningCoordinator', () => {
  let accounts: CurrentAccountRepositoryContract;
  let api: ProvisioningApi;
  let pending: PendingRegistrationStoreContract;

  beforeEach(() => {
    accounts = {
      clear: vi.fn(),
      get: vi.fn().mockResolvedValue(activeAccount),
      refresh: vi.fn().mockResolvedValue(activeAccount),
    };
    api = { provisionUser: vi.fn().mockResolvedValue(activeAccount) };
    pending = {
      clear: vi.fn().mockResolvedValue(undefined),
      getFullName: vi.fn().mockResolvedValue(null),
      setFullName: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('returns an existing active application user', async () => {
    await expect(new ProvisioningCoordinator(accounts, api, pending).resolve()).resolves.toEqual({
      account: activeAccount,
      status: 'active',
    });
  });

  it('provisions an unlinked identity when pending fullName is available and clears it', async () => {
    vi.mocked(accounts.get).mockRejectedValue(
      new MobileApiError('AUTH_USER_NOT_PROVISIONED', 'not provisioned', 403),
    );
    vi.mocked(pending.getFullName).mockResolvedValue('Ayesha Khan');

    await expect(
      new ProvisioningCoordinator(accounts, api, pending).resolve(),
    ).resolves.toMatchObject({
      status: 'active',
    });
    expect(api.provisionUser).toHaveBeenCalledWith('Ayesha Khan');
    expect(accounts.refresh).toHaveBeenCalledOnce();
    expect(pending.clear).toHaveBeenCalledOnce();
  });

  it('requires complete-account when cross-device login has no pending name', async () => {
    vi.mocked(accounts.get).mockRejectedValue(
      new MobileApiError('AUTH_USER_NOT_PROVISIONED', 'not provisioned', 403),
    );
    await expect(new ProvisioningCoordinator(accounts, api, pending).resolve()).resolves.toEqual({
      status: 'unprovisioned',
    });
    expect(api.provisionUser).not.toHaveBeenCalled();
  });

  it('preserves identity conflicts for visible handling and does not clear pending data', async () => {
    vi.mocked(accounts.get).mockRejectedValue(
      new MobileApiError('AUTH_USER_NOT_PROVISIONED', 'not provisioned', 403),
    );
    vi.mocked(pending.getFullName).mockResolvedValue('Ayesha Khan');
    vi.mocked(api.provisionUser).mockRejectedValue(
      new MobileApiError('AUTH_IDENTITY_CONFLICT', 'conflict', 409),
    );

    await expect(
      new ProvisioningCoordinator(accounts, api, pending).resolve(),
    ).rejects.toMatchObject({
      code: 'AUTH_IDENTITY_CONFLICT',
    });
    expect(pending.clear).not.toHaveBeenCalled();
  });

  it.each([
    ['ACCOUNT_SUSPENDED', 'suspended'],
    ['ACCOUNT_DEACTIVATED', 'deactivated'],
  ] as const)('maps %s from the authoritative API', async (code, status) => {
    vi.mocked(accounts.get).mockRejectedValue(new MobileApiError(code, 'blocked', 403));
    await expect(new ProvisioningCoordinator(accounts, api, pending).resolve()).resolves.toEqual({
      status,
    });
  });

  it('persists only the supplied full name before cross-device completion', async () => {
    await new ProvisioningCoordinator(accounts, api, pending).complete('Ayesha Khan');
    expect(pending.setFullName).toHaveBeenCalledWith('Ayesha Khan');
  });
});
