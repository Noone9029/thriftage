import { describe, expect, it, vi } from 'vitest';

import { SupabaseAuthAdminAdapter } from './supabase-auth-admin.adapter';

const expectedUser = {
  id: 'provider-user-id',
  phone: '+923001234567',
  phone_confirmed_at: '2026-08-11T00:00:00.000Z',
};

describe('SupabaseAuthAdminAdapter', () => {
  it('reads only the requested authoritative auth user', async () => {
    const client = {
      getUserById: vi.fn().mockResolvedValue({ data: { user: expectedUser }, error: null }),
      updateUserById: vi.fn(),
    };

    await expect(
      new SupabaseAuthAdminAdapter(client).getUserById('provider-user-id'),
    ).resolves.toMatchObject({
      authProviderUserId: 'provider-user-id',
      phone: '+923001234567',
      phoneVerified: true,
    });
    expect(client.getUserById).toHaveBeenCalledWith('provider-user-id');
  });

  it('targets the exact provider subject and explicitly confirms the phone', async () => {
    const client = {
      getUserById: vi.fn(),
      updateUserById: vi.fn().mockResolvedValue({ data: { user: expectedUser }, error: null }),
    };
    const adapter = new SupabaseAuthAdminAdapter(client);

    await expect(
      adapter.setVerifiedPhone('provider-user-id', '+923001234567'),
    ).resolves.toMatchObject({
      authProviderUserId: 'provider-user-id',
      phone: '+923001234567',
      phoneVerified: true,
    });
    expect(client.updateUserById).toHaveBeenCalledWith('provider-user-id', {
      phone: '+923001234567',
      phone_confirm: true,
    });
  });

  it('fails closed when Supabase returns a different user', async () => {
    const client = {
      getUserById: vi.fn(),
      updateUserById: vi.fn().mockResolvedValue({
        data: { user: { ...expectedUser, id: 'different-user-id' } },
        error: null,
      }),
    };

    await expect(
      new SupabaseAuthAdminAdapter(client).setVerifiedPhone('provider-user-id', '+923001234567'),
    ).rejects.toMatchObject({ code: 'IDENTITY_MISMATCH' });
  });

  it('maps provider errors without exposing response details', async () => {
    const client = {
      getUserById: vi.fn().mockResolvedValue({ data: { user: null }, error: { secret: 'hidden' } }),
      updateUserById: vi.fn(),
    };

    await expect(
      new SupabaseAuthAdminAdapter(client).getUserById('provider-user-id'),
    ).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
      message: 'Authentication administration request failed.',
    });
  });
});
