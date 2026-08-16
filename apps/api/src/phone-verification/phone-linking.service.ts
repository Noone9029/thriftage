import type { PhoneVerificationAttempt, User } from '@thriftage/db';
import {
  phoneVerificationChallengeSchema,
  phoneVerificationStartInputSchema,
  phoneVerificationVerifyInputSchema,
  type PhoneVerificationChallenge,
  type PhoneVerificationStartInput,
  type PhoneVerificationVerifyInput,
} from '@thriftage/shared';

import { AuthApiException } from '../auth/auth.errors';
import {
  AuthAdminProviderError,
  type AuthAdminProvider,
  type AuthAdminUser,
} from './auth-admin-provider.interface';
import { maskPhoneNumber, normalizePhoneNumber } from './phone-number';
import {
  PhoneVerificationDomainError,
  toPhoneVerificationApiException,
} from './phone-verification.errors';
import {
  PhoneVerificationProviderError,
  type PhoneVerificationProvider,
} from './phone-verification-provider.interface';
import type { PhoneVerificationRepositoryContract } from './phone-verification.repository';

export const PHONE_VERIFICATION_REPOSITORY = Symbol('PHONE_VERIFICATION_REPOSITORY');
export const PHONE_VERIFICATION_POLICY = Symbol('PHONE_VERIFICATION_POLICY');

export interface PhoneVerificationPolicy {
  readonly attemptTtlSeconds: number;
  readonly enabled?: boolean;
  readonly maxChecks: number;
  readonly maxSends: number;
  readonly maxStarts: number;
  readonly resendCooldownSeconds: number;
  readonly startWindowSeconds: number;
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1_000);
}

function challengeForAttempt(attempt: PhoneVerificationAttempt): PhoneVerificationChallenge {
  return phoneVerificationChallengeSchema.parse({
    attemptId: attempt.id,
    expiresAt: attempt.expiresAt.toISOString(),
    maskedPhone: maskPhoneNumber(attempt.phone),
    resendAvailableAt: attempt.resendAvailableAt.toISOString(),
    status: attempt.status,
  });
}

function alreadyVerified(phone: string): PhoneVerificationChallenge {
  return phoneVerificationChallengeSchema.parse({
    attemptId: null,
    expiresAt: null,
    maskedPhone: maskPhoneNumber(phone),
    resendAvailableAt: null,
    status: 'ALREADY_VERIFIED',
  });
}

export class PhoneLinkingService {
  public constructor(
    private readonly verificationProvider: PhoneVerificationProvider,
    private readonly authAdminProvider: AuthAdminProvider,
    private readonly repository: PhoneVerificationRepositoryContract,
    private readonly policy: PhoneVerificationPolicy,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async start(user: User, input: PhoneVerificationStartInput) {
    try {
      this.assertEnabled();
      const normalizedPhone = normalizePhoneNumber(
        phoneVerificationStartInputSchema.parse(input).phone,
      );
      if (user.phoneVerified) {
        if (user.phone === normalizedPhone) return alreadyVerified(normalizedPhone);
        throw new PhoneVerificationDomainError(
          'PHONE_IDENTITY_CONFLICT',
          'Verified phone replacement is not supported.',
        );
      }
      const owner = await this.repository.findUserByPhone(normalizedPhone);
      if (owner !== null && owner.id !== user.id) {
        throw new PhoneVerificationDomainError('PHONE_ALREADY_IN_USE', 'Phone is already in use.');
      }

      const now = this.now();
      const attempt = await this.repository.createAttempt({
        expiresAt: addSeconds(now, this.policy.attemptTtlSeconds),
        maxStarts: this.policy.maxStarts,
        now,
        phone: normalizedPhone,
        resendAvailableAt: addSeconds(now, this.policy.resendCooldownSeconds),
        startWindowBeginsAt: addSeconds(now, -this.policy.startWindowSeconds),
        userId: user.id,
      });
      try {
        const sent = await this.verificationProvider.sendVerification(normalizedPhone);
        await this.repository.markProviderSent(attempt.id, user.id, sent.providerReference);
      } catch (error: unknown) {
        await this.repository.markFailed(attempt.id, user.id, this.now());
        throw error;
      }
      const current = await this.repository.findOwned(attempt.id, user.id);
      if (current === null || current.status !== 'PENDING') {
        throw new PhoneVerificationDomainError(
          'PHONE_VERIFICATION_NOT_FOUND',
          'Attempt was superseded.',
        );
      }
      return challengeForAttempt(current);
    } catch (error: unknown) {
      throw toPhoneVerificationApiException(error);
    }
  }

  public async current(user: User): Promise<PhoneVerificationChallenge | null> {
    try {
      const attempt = await this.repository.findCurrent(user.id);
      if (attempt === null) return null;
      if (attempt.expiresAt <= this.now() && attempt.status === 'PENDING') {
        await this.repository.markExpired(attempt.id, user.id);
        return null;
      }
      return challengeForAttempt(attempt);
    } catch (error: unknown) {
      throw toPhoneVerificationApiException(error);
    }
  }

  public async resend(user: User, attemptId: string): Promise<PhoneVerificationChallenge> {
    try {
      this.assertEnabled();
      const now = this.now();
      const attempt = await this.repository.reserveResend({
        attemptId,
        maxCount: this.policy.maxSends,
        nextAvailableAt: addSeconds(now, this.policy.resendCooldownSeconds),
        now,
        userId: user.id,
      });
      const sent = await this.verificationProvider.sendVerification(attempt.phone);
      await this.repository.markProviderSent(attempt.id, user.id, sent.providerReference);
      const current = await this.repository.findOwned(attempt.id, user.id);
      if (current === null) {
        throw new PhoneVerificationDomainError(
          'PHONE_VERIFICATION_NOT_FOUND',
          'Attempt was not found.',
        );
      }
      return challengeForAttempt(current);
    } catch (error: unknown) {
      throw toPhoneVerificationApiException(error);
    }
  }

  public async verify(user: User, input: PhoneVerificationVerifyInput): Promise<User> {
    try {
      this.assertEnabled();
      const parsed = phoneVerificationVerifyInputSchema.parse(input);
      const now = this.now();
      let attempt = await this.repository.reserveCheck({
        attemptId: parsed.attemptId,
        maxCount: this.policy.maxChecks,
        now,
        userId: user.id,
      });
      if (attempt.status === 'LINKED') {
        const linkedUser = await this.repository.findUserById(user.id);
        if (linkedUser === null) {
          throw new PhoneVerificationDomainError(
            'PHONE_VERIFICATION_NOT_FOUND',
            'User was not found.',
          );
        }
        return linkedUser;
      }
      if (attempt.status === 'EXPIRED') {
        throw new PhoneVerificationDomainError(
          'PHONE_VERIFICATION_EXPIRED',
          'Verification attempt expired.',
        );
      }
      if (attempt.status === 'PENDING') {
        let checked;
        try {
          checked = await this.verificationProvider.verifyCode(attempt.phone, parsed.code);
        } catch (error: unknown) {
          if (error instanceof PhoneVerificationProviderError && error.code === 'EXPIRED') {
            await this.repository.markExpired(attempt.id, user.id);
            throw new PhoneVerificationDomainError(
              'PHONE_VERIFICATION_EXPIRED',
              'Verification attempt expired.',
            );
          }
          throw error;
        }
        if (checked.status === 'INVALID') {
          throw new PhoneVerificationDomainError(
            'PHONE_VERIFICATION_CODE_INVALID',
            'Verification code is invalid.',
          );
        }
        if (checked.status === 'EXPIRED') {
          await this.repository.markExpired(attempt.id, user.id);
          throw new PhoneVerificationDomainError(
            'PHONE_VERIFICATION_EXPIRED',
            'Verification attempt expired.',
          );
        }
        attempt = await this.repository.markProviderVerified(attempt.id, user.id, now);
      }
      if (attempt.status !== 'PROVIDER_VERIFIED') {
        throw new PhoneVerificationDomainError(
          'PHONE_VERIFICATION_NOT_FOUND',
          'Verification attempt is not actionable.',
        );
      }
      return await this.reconcileLink(user.id, attempt);
    } catch (error: unknown) {
      throw toPhoneVerificationApiException(error);
    }
  }

  public async cancel(user: User): Promise<void> {
    try {
      await this.repository.cancelCurrent(user.id, this.now());
    } catch (error: unknown) {
      throw toPhoneVerificationApiException(error);
    }
  }

  private assertEnabled(): void {
    if (this.policy.enabled === false) {
      throw new PhoneVerificationDomainError(
        'PHONE_AUTH_DISABLED',
        'Phone authentication is disabled by runtime policy.',
      );
    }
  }

  private async reconcileLink(userId: string, attempt: PhoneVerificationAttempt): Promise<User> {
    const currentUser = await this.repository.findUserById(userId);
    if (currentUser === null) {
      throw new PhoneVerificationDomainError('PHONE_VERIFICATION_NOT_FOUND', 'User was not found.');
    }
    if (currentUser.accountStatus === 'SUSPENDED') {
      throw new AuthApiException('ACCOUNT_SUSPENDED');
    }
    if (currentUser.accountStatus === 'DEACTIVATED') {
      throw new AuthApiException('ACCOUNT_DEACTIVATED');
    }
    if (currentUser.phoneVerified) {
      if (currentUser.phone !== attempt.phone) {
        throw new PhoneVerificationDomainError(
          'PHONE_IDENTITY_CONFLICT',
          'Verified phone replacement is not supported.',
        );
      }
      return this.repository.completeLink(userId, attempt.id, attempt.phone, this.now());
    }
    const owner = await this.repository.findUserByPhone(attempt.phone);
    if (owner !== null && owner.id !== userId) {
      throw new PhoneVerificationDomainError('PHONE_ALREADY_IN_USE', 'Phone is already in use.');
    }

    let authUser = await this.authAdminProvider.getUserById(currentUser.authProviderUserId);
    this.assertExpectedIdentity(authUser, currentUser.authProviderUserId, attempt.phone);
    if (!authUser.phoneVerified) {
      authUser = await this.authAdminProvider.setVerifiedPhone(
        currentUser.authProviderUserId,
        attempt.phone,
      );
      this.assertExpectedIdentity(authUser, currentUser.authProviderUserId, attempt.phone, true);
    }
    return this.repository.completeLink(userId, attempt.id, attempt.phone, this.now());
  }

  private assertExpectedIdentity(
    authUser: AuthAdminUser,
    expectedId: string,
    expectedPhone: string,
    requireVerified = false,
  ): void {
    if (authUser.authProviderUserId !== expectedId) {
      throw new AuthAdminProviderError('IDENTITY_MISMATCH');
    }
    if (authUser.phone !== null && authUser.phone !== expectedPhone) {
      throw new PhoneVerificationDomainError(
        'PHONE_IDENTITY_CONFLICT',
        'Authentication identity has a conflicting phone.',
      );
    }
    if (authUser.phoneVerified && authUser.phone !== expectedPhone) {
      throw new AuthAdminProviderError('IDENTITY_MISMATCH');
    }
    if (requireVerified && (authUser.phone !== expectedPhone || !authUser.phoneVerified)) {
      throw new AuthAdminProviderError('IDENTITY_MISMATCH');
    }
  }
}
