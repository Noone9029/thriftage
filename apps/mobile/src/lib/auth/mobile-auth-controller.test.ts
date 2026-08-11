import type { Session } from '@supabase/supabase-js';
import type { PrivateUserAccount } from '@thriftage/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CurrentAccountRepositoryContract } from './current-account.repository';
import { MobileAuthController } from './mobile-auth-controller';
import type { MobileAuthGateway } from './mobile-auth.gateway';
import type {
  ProvisioningCoordinatorContract,
  ProvisioningResolution,
} from './provisioning-coordinator';
import type { PendingRegistrationStoreContract } from './storage/pending-registration.store';

const session = {
  access_token: 'access-token',
  expires_at: 4_000_000_000,
  expires_in: 3_600,
  refresh_token: 'refresh-token',
  token_type: 'bearer',
  user: { id: 'provider-user-id' },
} as Session;

const account: PrivateUserAccount = {
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

class TestAuthGateway implements MobileAuthGateway {
  public getSessionResult: Session | null = null;
  public signInResult: Session = session;
  public signUpResult: Session | null = null;
  public callbackKind: 'confirmation' | 'recovery' = 'confirmation';
  public readonly requestPasswordReset = vi.fn(async () => undefined);
  public readonly signOut = vi.fn(async () => undefined);
  public readonly updatePassword = vi.fn(async () => undefined);
  public readonly startAutoRefresh = vi.fn();
  public readonly stopAutoRefresh = vi.fn();

  public async exchangeCallback() {
    return { kind: this.callbackKind, session };
  }

  public async getSession(): Promise<Session | null> {
    return this.getSessionResult;
  }

  public async refreshSession(): Promise<Session | null> {
    return this.getSessionResult;
  }

  public async signInWithPassword(): Promise<Session> {
    return this.signInResult;
  }

  public async signUpWithPassword(): Promise<Session | null> {
    return this.signUpResult;
  }

  public subscribe(): () => void {
    return () => undefined;
  }
}

describe('MobileAuthController', () => {
  let gateway: TestAuthGateway;
  let resolution: ProvisioningResolution;
  let provisioning: ProvisioningCoordinatorContract;
  let accounts: CurrentAccountRepositoryContract;
  let pending: PendingRegistrationStoreContract;
  let controller: MobileAuthController;

  beforeEach(() => {
    gateway = new TestAuthGateway();
    resolution = { account, status: 'active' };
    provisioning = {
      complete: vi.fn(async () => resolution),
      resolve: vi.fn(async () => resolution),
    };
    accounts = {
      clear: vi.fn(),
      get: vi.fn(),
      refresh: vi.fn(),
    };
    pending = {
      clear: vi.fn(async () => undefined),
      getFullName: vi.fn(async () => null),
      setFullName: vi.fn(async () => undefined),
    };
    controller = new MobileAuthController(gateway, provisioning, accounts, pending, {
      emailConfirmation: 'thriftage://auth/callback',
      passwordRecovery: 'thriftage://auth/reset-password',
    });
  });

  it('restores no session to SIGNED_OUT', async () => {
    await controller.bootstrap();
    expect(controller.getSnapshot().status).toBe('SIGNED_OUT');
  });

  it('restores a session and resolves an active application user', async () => {
    gateway.getSessionResult = session;
    await controller.bootstrap();
    expect(controller.getSnapshot()).toMatchObject({ account, status: 'AUTHENTICATED_ACTIVE' });
  });

  it.each([
    ['unprovisioned', 'AUTHENTICATED_UNPROVISIONED'],
    ['suspended', 'ACCOUNT_SUSPENDED'],
    ['deactivated', 'ACCOUNT_DEACTIVATED'],
  ] as const)('maps restored %s application state', async (status, expected) => {
    gateway.getSessionResult = session;
    resolution = { status };
    await controller.bootstrap();
    expect(controller.getSnapshot().status).toBe(expected);
  });

  it('provisions signup immediately when Supabase returns a session', async () => {
    gateway.signUpResult = session;
    await controller.signUp({
      confirmPassword: 'Secure123',
      email: 'USER@example.com',
      fullName: 'Ayesha Khan',
      password: 'Secure123',
    });
    expect(pending.setFullName).toHaveBeenCalledWith('Ayesha Khan');
    expect(provisioning.resolve).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().status).toBe('AUTHENTICATED_ACTIVE');
  });

  it('persists only pending fullName when signup requires email confirmation', async () => {
    await controller.signUp({
      confirmPassword: 'Secure123',
      email: 'USER@example.com',
      fullName: 'Ayesha Khan',
      password: 'Secure123',
    });
    expect(pending.setFullName).toHaveBeenCalledWith('Ayesha Khan');
    expect(controller.getSnapshot()).toEqual({
      email: 'user@example.com',
      status: 'EMAIL_VERIFICATION_PENDING',
    });
  });

  it('routes cross-device login without pending name to account completion', async () => {
    resolution = { status: 'unprovisioned' };
    await controller.signIn({ email: 'user@example.com', password: 'password' });
    expect(controller.getSnapshot().status).toBe('AUTHENTICATED_UNPROVISIONED');
  });

  it('enters PASSWORD_RECOVERY for a validated recovery callback', async () => {
    gateway.callbackKind = 'recovery';
    await controller.handleCallback({
      accessToken: 'access',
      action: 'set-session',
      kind: 'recovery',
      refreshToken: 'refresh',
    });
    expect(controller.getSnapshot().status).toBe('PASSWORD_RECOVERY');
  });

  it('updates a password without leaving recovery until the user continues', async () => {
    gateway.getSessionResult = session;
    await controller.handleAuthChange('PASSWORD_RECOVERY', session);
    await controller.updatePassword({ confirmPassword: 'NewSecure123', password: 'NewSecure123' });
    expect(controller.getSnapshot().status).toBe('PASSWORD_RECOVERY');
    await controller.finishPasswordRecovery();
    expect(controller.getSnapshot().status).toBe('AUTHENTICATED_ACTIVE');
  });

  it('requests generic password recovery using the allowlisted redirect', async () => {
    await controller.requestPasswordReset({ email: ' USER@example.com ' });
    expect(gateway.requestPasswordReset).toHaveBeenCalledWith(
      'user@example.com',
      'thriftage://auth/reset-password',
    );
  });

  it('clears pending and private application state on logout', async () => {
    await controller.signOut();
    expect(gateway.signOut).toHaveBeenCalledOnce();
    expect(pending.clear).toHaveBeenCalledOnce();
    expect(accounts.clear).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().status).toBe('SIGNED_OUT');
  });

  it('clears private state and signs out after the API invalidates the session', async () => {
    gateway.getSessionResult = session;
    await controller.bootstrap();

    controller.sessionBecameInvalid();

    expect(gateway.signOut).toHaveBeenCalledOnce();
    expect(accounts.clear).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().status).toBe('SIGNED_OUT');
  });
});
