import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import {
  mobileForgotPasswordInputSchema,
  mobileLoginInputSchema,
  mobilePhoneLoginStartInputSchema,
  mobilePhoneLoginVerifyInputSchema,
  mobileResetPasswordInputSchema,
  mobileSignupInputSchema,
  profileCreateInputSchema,
  profileUpdateInputSchema,
  provisionUserInputSchema,
  type MobileForgotPasswordInput,
  type MobileLoginInput,
  type MobilePhoneLoginStartInput,
  type MobilePhoneLoginVerifyInput,
  type MobileResetPasswordInput,
  type MobileSignupInput,
  type PhoneVerificationChallenge,
  type PrivateUserAccount,
  type PrivateUserProfile,
  type ProfileCreateInput,
  type ProfileUpdateInput,
} from '@thriftage/shared';

import { MobileApiError } from '../api/mobile-api-error';
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

export interface IdentityOnboardingApi {
  cancelPhoneVerification(): Promise<void>;
  createProfile(input: ProfileCreateInput): Promise<PrivateUserProfile>;
  getCurrentPhoneVerification(): Promise<PhoneVerificationChallenge | null>;
  getCurrentProfile(): Promise<PrivateUserProfile>;
  removeProfileImage(): Promise<PrivateUserProfile>;
  resendPhoneVerification(attemptId: string): Promise<PhoneVerificationChallenge>;
  startPhoneVerification(phone: string): Promise<PhoneVerificationChallenge>;
  updateProfile(input: ProfileUpdateInput): Promise<PrivateUserProfile>;
  uploadProfileImage(form: FormData): Promise<PrivateUserProfile>;
  verifyPhone(attemptId: string, code: string): Promise<PrivateUserAccount>;
}

export class MobileAuthController {
  private state: MobileAuthState = { status: 'BOOTSTRAPPING' };
  private readonly listeners = new Set<() => void>();

  public constructor(
    private readonly gateway: MobileAuthGateway,
    private readonly provisioning: ProvisioningCoordinatorContract,
    private readonly accounts: CurrentAccountRepositoryContract,
    private readonly pendingRegistration: PendingRegistrationStoreContract,
    private readonly onboarding: IdentityOnboardingApi,
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
      if (session === null) return this.setState({ status: 'SIGNED_OUT' });
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
    await this.pendingRegistration.setRegistration(parsed.fullName, parsed.phone);
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

  public async startPhoneLogin(input: MobilePhoneLoginStartInput): Promise<void> {
    const parsed = mobilePhoneLoginStartInputSchema.parse(input);
    await this.gateway.startPhoneSignIn(parsed.phone);
    this.setState({ phone: parsed.phone, status: 'PHONE_LOGIN_PENDING' });
  }

  public async resendPhoneLogin(): Promise<void> {
    if (this.state.status !== 'PHONE_LOGIN_PENDING') return;
    await this.gateway.startPhoneSignIn(this.state.phone);
  }

  public async verifyPhoneLogin(input: MobilePhoneLoginVerifyInput): Promise<void> {
    if (this.state.status !== 'PHONE_LOGIN_PENDING') return;
    const parsed = mobilePhoneLoginVerifyInputSchema.parse({ ...input, phone: this.state.phone });
    await this.resolveSession(await this.gateway.verifyPhoneSignIn(parsed.phone, parsed.code));
  }

  public abandonPhoneLogin(): void {
    this.setState({ status: 'SIGNED_OUT' });
  }

  public async completeAccount(fullName: string): Promise<void> {
    const parsed = provisionUserInputSchema.parse({ fullName });
    const session = await this.gateway.getSession();
    if (session === null) return this.setState({ status: 'SIGNED_OUT' });
    await this.setResolvedState(session, await this.provisioning.complete(parsed.fullName));
  }

  public async startPhoneVerification(phone: string): Promise<void> {
    if (this.state.status !== 'PHONE_VERIFICATION_REQUIRED') return;
    const challenge = await this.onboarding.startPhoneVerification(phone);
    this.setState({ ...this.state, challenge, suggestedPhone: phone });
  }

  public async verifyRequiredPhone(code: string): Promise<void> {
    if (
      this.state.status !== 'PHONE_VERIFICATION_REQUIRED' ||
      this.state.challenge === null ||
      this.state.challenge.attemptId === null
    )
      return;
    const { session } = this.state;
    const account = await this.onboarding.verifyPhone(this.state.challenge.attemptId, code);
    await this.pendingRegistration.clear();
    await this.resolveOnboardingState(session, account);
  }

  public async resendRequiredPhone(): Promise<void> {
    if (
      this.state.status !== 'PHONE_VERIFICATION_REQUIRED' ||
      this.state.challenge?.attemptId == null
    )
      return;
    const challenge = await this.onboarding.resendPhoneVerification(this.state.challenge.attemptId);
    this.setState({ ...this.state, challenge });
  }

  public async cancelRequiredPhone(): Promise<void> {
    if (this.state.status !== 'PHONE_VERIFICATION_REQUIRED') return;
    await this.onboarding.cancelPhoneVerification();
    this.setState({ ...this.state, challenge: null });
  }

  public async completeProfile(input: ProfileCreateInput, image: FormData | null): Promise<void> {
    if (this.state.status !== 'PROFILE_ONBOARDING_REQUIRED') return;
    const parsed = profileCreateInputSchema.parse(input);
    const { account, session } = this.state;
    let profile = await this.onboarding.createProfile(parsed);
    this.setState({
      account,
      profile,
      session,
      status: 'AUTHENTICATED_ACTIVE',
    });
    if (image !== null) {
      profile = await this.onboarding.uploadProfileImage(image);
      this.setState({ account, profile, session, status: 'AUTHENTICATED_ACTIVE' });
    }
  }

  public async updateProfile(input: ProfileUpdateInput): Promise<void> {
    if (this.state.status !== 'AUTHENTICATED_ACTIVE') return;
    this.setState({
      ...this.state,
      profile: await this.onboarding.updateProfile(profileUpdateInputSchema.parse(input)),
    });
  }

  public async uploadProfileImage(image: FormData): Promise<void> {
    if (this.state.status !== 'AUTHENTICATED_ACTIVE') return;
    this.setState({ ...this.state, profile: await this.onboarding.uploadProfileImage(image) });
  }

  public async removeProfileImage(): Promise<void> {
    if (this.state.status !== 'AUTHENTICATED_ACTIVE') return;
    this.setState({ ...this.state, profile: await this.onboarding.removeProfileImage() });
  }

  public async requestPasswordReset(input: MobileForgotPasswordInput): Promise<void> {
    const parsed = mobileForgotPasswordInputSchema.parse(input);
    await this.gateway.requestPasswordReset(parsed.email, this.redirects.passwordRecovery);
  }

  public async updatePassword(input: MobileResetPasswordInput): Promise<void> {
    await this.gateway.updatePassword(mobileResetPasswordInputSchema.parse(input).password);
  }

  public async finishPasswordRecovery(): Promise<void> {
    const session = await this.gateway.getSession();
    if (session === null) return this.setState({ status: 'SIGNED_OUT' });
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
      await this.pendingRegistration.clear();
      this.accounts.clear();
      this.setState({ status: 'SIGNED_OUT' });
      return;
    }
    if (event === 'PASSWORD_RECOVERY') {
      this.setState({ session, status: 'PASSWORD_RECOVERY' });
      return;
    }
    if (this.state.status !== 'PASSWORD_RECOVERY') await this.resolveSession(session);
  }

  public async abandonSignup(): Promise<void> {
    try {
      await this.gateway.signOut();
    } finally {
      await this.pendingRegistration.clear();
      this.accounts.clear();
      this.setState({ status: 'SIGNED_OUT' });
    }
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
    void this.pendingRegistration.clear().catch(() => undefined);
    this.accounts.clear();
    this.setState({ status: 'SIGNED_OUT' });
  };

  private async resolveSession(session: Session): Promise<void> {
    try {
      await this.setResolvedState(session, await this.provisioning.resolve());
    } catch (error: unknown) {
      if (error instanceof MobileApiError && error.code === 'AUTH_EMAIL_UNVERIFIED') {
        this.setState({
          email: session.user.email ?? 'your email',
          status: 'EMAIL_VERIFICATION_PENDING',
        });
        return;
      }
      throw error;
    }
  }

  private async setResolvedState(
    session: Session,
    resolution: ProvisioningResolution,
  ): Promise<void> {
    switch (resolution.status) {
      case 'active':
        await this.resolveOnboardingState(session, resolution.account);
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

  private async resolveOnboardingState(
    session: Session,
    account: PrivateUserAccount,
  ): Promise<void> {
    if (!account.phoneVerified) {
      this.setState({
        account,
        challenge: await this.onboarding.getCurrentPhoneVerification(),
        session,
        status: 'PHONE_VERIFICATION_REQUIRED',
        suggestedPhone: await this.pendingRegistration.getPhone(),
      });
      return;
    }
    try {
      const profile = await this.onboarding.getCurrentProfile();
      this.setState({ account, profile, session, status: 'AUTHENTICATED_ACTIVE' });
    } catch (error: unknown) {
      if (error instanceof MobileApiError && error.code === 'PROFILE_NOT_FOUND') {
        this.setState({ account, session, status: 'PROFILE_ONBOARDING_REQUIRED' });
        return;
      }
      throw error;
    }
  }

  private setState(state: MobileAuthState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}
