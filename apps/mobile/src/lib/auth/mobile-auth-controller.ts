import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import {
  mobileForgotPasswordInputSchema,
  mobileLoginInputSchema,
  mobileResetPasswordInputSchema,
  mobileSignupInputSchema,
  provisionUserInputSchema,
  type MobileForgotPasswordInput,
  type MobileLoginInput,
  type MobileResetPasswordInput,
  type MobileSignupInput,
} from '@thriftage/shared';

import type { AuthCallbackInstruction } from './deep-link';
import type { MobileAuthGateway } from './mobile-auth.gateway';
import type { MobileAuthState } from './mobile-auth-state';
import type {
  ProvisioningCoordinatorContract,
  ProvisioningResolution,
} from './provisioning-coordinator';
import type { CurrentAccountRepositoryContract } from './current-account.repository';
import type { PendingRegistrationStoreContract } from './storage/pending-registration.store';

export interface AuthRedirects {
  readonly emailConfirmation: string;
  readonly passwordRecovery: string;
}

export class MobileAuthController {
  private state: MobileAuthState = { status: 'BOOTSTRAPPING' };
  private readonly listeners = new Set<() => void>();

  public constructor(
    private readonly gateway: MobileAuthGateway,
    private readonly provisioning: ProvisioningCoordinatorContract,
    private readonly accounts: CurrentAccountRepositoryContract,
    private readonly pendingRegistration: PendingRegistrationStoreContract,
    private readonly redirects: AuthRedirects,
  ) {}

  public getSnapshot = (): MobileAuthState => this.state;

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public async bootstrap(): Promise<void> {
    this.setState({ status: 'BOOTSTRAPPING' });
    try {
      const session = await this.gateway.getSession();
      if (session === null) {
        this.setState({ status: 'SIGNED_OUT' });
        return;
      }
      await this.resolveSession(session);
    } catch {
      this.accounts.clear();
      this.setState({ status: 'SIGNED_OUT' });
    }
  }

  public async signUp(input: MobileSignupInput): Promise<void> {
    const parsed = mobileSignupInputSchema.parse(input);
    const session = await this.gateway.signUpWithPassword(
      parsed.email,
      parsed.password,
      this.redirects.emailConfirmation,
    );
    await this.pendingRegistration.setFullName(parsed.fullName);
    if (session === null) {
      this.setState({ email: parsed.email, status: 'EMAIL_VERIFICATION_PENDING' });
      return;
    }
    await this.resolveSession(session);
  }

  public async signIn(input: MobileLoginInput): Promise<void> {
    const parsed = mobileLoginInputSchema.parse(input);
    await this.resolveSession(await this.gateway.signInWithPassword(parsed.email, parsed.password));
  }

  public async completeAccount(fullName: string): Promise<void> {
    const parsed = provisionUserInputSchema.parse({ fullName });
    const session = await this.gateway.getSession();
    if (session === null) {
      this.setState({ status: 'SIGNED_OUT' });
      return;
    }
    this.setResolvedState(session, await this.provisioning.complete(parsed.fullName));
  }

  public async requestPasswordReset(input: MobileForgotPasswordInput): Promise<void> {
    const parsed = mobileForgotPasswordInputSchema.parse(input);
    await this.gateway.requestPasswordReset(parsed.email, this.redirects.passwordRecovery);
  }

  public async updatePassword(input: MobileResetPasswordInput): Promise<void> {
    const parsed = mobileResetPasswordInputSchema.parse(input);
    await this.gateway.updatePassword(parsed.password);
  }

  public async finishPasswordRecovery(): Promise<void> {
    const session = await this.gateway.getSession();
    if (session === null) {
      this.setState({ status: 'SIGNED_OUT' });
      return;
    }
    await this.resolveSession(session);
  }

  public async handleCallback(instruction: AuthCallbackInstruction): Promise<void> {
    const result = await this.gateway.exchangeCallback(instruction);
    if (result.kind === 'recovery') {
      this.setState({ session: result.session, status: 'PASSWORD_RECOVERY' });
      return;
    }
    await this.resolveSession(result.session);
  }

  public async handleAuthChange(event: AuthChangeEvent, session: Session | null): Promise<void> {
    if (event === 'SIGNED_OUT' || session === null) {
      this.accounts.clear();
      this.setState({ status: 'SIGNED_OUT' });
      return;
    }
    if (event === 'PASSWORD_RECOVERY') {
      this.setState({ session, status: 'PASSWORD_RECOVERY' });
      return;
    }
    if (this.state.status !== 'PASSWORD_RECOVERY') {
      await this.resolveSession(session);
    }
  }

  public async abandonSignup(): Promise<void> {
    await this.pendingRegistration.clear();
    this.setState({ status: 'SIGNED_OUT' });
  }

  public async signOut(): Promise<void> {
    try {
      await this.gateway.signOut();
    } finally {
      await this.pendingRegistration.clear();
      this.accounts.clear();
      this.setState({ status: 'SIGNED_OUT' });
    }
  }

  public sessionBecameInvalid = (): void => {
    void this.gateway.signOut().catch(() => undefined);
    this.accounts.clear();
    this.setState({ status: 'SIGNED_OUT' });
  };

  private async resolveSession(session: Session): Promise<void> {
    this.setResolvedState(session, await this.provisioning.resolve());
  }

  private setResolvedState(session: Session, resolution: ProvisioningResolution): void {
    switch (resolution.status) {
      case 'active':
        this.setState({ account: resolution.account, session, status: 'AUTHENTICATED_ACTIVE' });
        return;
      case 'unprovisioned':
        this.setState({ session, status: 'AUTHENTICATED_UNPROVISIONED' });
        return;
      case 'suspended':
        this.setState({ session, status: 'ACCOUNT_SUSPENDED' });
        return;
      case 'deactivated':
        this.setState({ session, status: 'ACCOUNT_DEACTIVATED' });
    }
  }

  private setState(state: MobileAuthState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}
