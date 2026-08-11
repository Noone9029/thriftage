import {
  getPrismaClient,
  type PhoneVerificationAttempt,
  type Prisma,
  type PrismaClient,
  type User,
} from '@thriftage/db';

import { AuthApiException } from '../auth/auth.errors';
import { PhoneVerificationDomainError } from './phone-verification.errors';

export interface CreatePhoneVerificationAttemptInput {
  readonly expiresAt: Date;
  readonly maxStarts: number;
  readonly now: Date;
  readonly phone: string;
  readonly resendAvailableAt: Date;
  readonly startWindowBeginsAt: Date;
  readonly userId: string;
}

export interface ReserveAttemptInput {
  readonly attemptId: string;
  readonly maxCount: number;
  readonly nextAvailableAt?: Date;
  readonly now: Date;
  readonly userId: string;
}

export interface PhoneVerificationRepositoryContract {
  cancelCurrent(userId: string, now: Date): Promise<void>;
  completeLink(userId: string, attemptId: string, phone: string, now: Date): Promise<User>;
  createAttempt(input: CreatePhoneVerificationAttemptInput): Promise<PhoneVerificationAttempt>;
  findCurrent(userId: string): Promise<PhoneVerificationAttempt | null>;
  findOwned(attemptId: string, userId: string): Promise<PhoneVerificationAttempt | null>;
  findUserById(userId: string): Promise<User | null>;
  findUserByPhone(phone: string): Promise<User | null>;
  markExpired(attemptId: string, userId: string): Promise<void>;
  markFailed(attemptId: string, userId: string, now: Date): Promise<void>;
  markProviderSent(
    attemptId: string,
    userId: string,
    providerReference: string | null,
  ): Promise<void>;
  markProviderVerified(
    attemptId: string,
    userId: string,
    now: Date,
  ): Promise<PhoneVerificationAttempt>;
  reserveCheck(input: ReserveAttemptInput): Promise<PhoneVerificationAttempt>;
  reserveResend(input: ReserveAttemptInput): Promise<PhoneVerificationAttempt>;
}

function domainError(code: ConstructorParameters<typeof PhoneVerificationDomainError>[0]) {
  return new PhoneVerificationDomainError(code, code);
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

async function lockUser(transaction: Prisma.TransactionClient, userId: string): Promise<void> {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE
  `;
  if (rows.length !== 1) throw domainError('PHONE_VERIFICATION_NOT_FOUND');
}

async function requireActiveUser(
  transaction: Prisma.TransactionClient,
  userId: string,
): Promise<User> {
  const user = await transaction.user.findUnique({ where: { id: userId } });
  if (user === null) throw domainError('PHONE_VERIFICATION_NOT_FOUND');
  if (user.accountStatus === 'SUSPENDED') throw new AuthApiException('ACCOUNT_SUSPENDED');
  if (user.accountStatus === 'DEACTIVATED') throw new AuthApiException('ACCOUNT_DEACTIVATED');
  return user;
}

async function lockAttempt(
  transaction: Prisma.TransactionClient,
  attemptId: string,
): Promise<void> {
  await transaction.$queryRaw`
    SELECT "id" FROM "phone_verification_attempts"
    WHERE "id" = ${attemptId}::uuid FOR UPDATE
  `;
}

export class PhoneVerificationRepository implements PhoneVerificationRepositoryContract {
  public constructor(private readonly prisma?: PrismaClient) {}

  private get client(): PrismaClient {
    return this.prisma ?? getPrismaClient();
  }

  public async createAttempt(
    input: CreatePhoneVerificationAttemptInput,
  ): Promise<PhoneVerificationAttempt> {
    return this.client.$transaction(async (transaction) => {
      await lockUser(transaction, input.userId);
      await requireActiveUser(transaction, input.userId);
      const owner = await transaction.user.findUnique({ where: { phone: input.phone } });
      if (owner !== null && owner.id !== input.userId) {
        throw domainError('PHONE_ALREADY_IN_USE');
      }
      const starts = await transaction.phoneVerificationAttempt.count({
        where: { createdAt: { gte: input.startWindowBeginsAt }, userId: input.userId },
      });
      if (starts >= input.maxStarts) throw domainError('PHONE_VERIFICATION_RATE_LIMITED');

      const providerVerified = await transaction.phoneVerificationAttempt.findFirst({
        where: { status: 'PROVIDER_VERIFIED', userId: input.userId },
      });
      if (providerVerified !== null) throw domainError('PHONE_VERIFICATION_RATE_LIMITED');

      await transaction.phoneVerificationAttempt.updateMany({
        data: { cancelledAt: input.now, status: 'CANCELLED' },
        where: { status: 'PENDING', userId: input.userId },
      });
      return transaction.phoneVerificationAttempt.create({
        data: {
          createdAt: input.now,
          expiresAt: input.expiresAt,
          phone: input.phone,
          resendAvailableAt: input.resendAvailableAt,
          userId: input.userId,
        },
      });
    });
  }

  public findOwned(attemptId: string, userId: string) {
    return this.client.phoneVerificationAttempt.findFirst({ where: { id: attemptId, userId } });
  }

  public findCurrent(userId: string) {
    return this.client.phoneVerificationAttempt.findFirst({
      orderBy: { createdAt: 'desc' },
      where: { status: { in: ['PENDING', 'PROVIDER_VERIFIED'] }, userId },
    });
  }

  public findUserById(userId: string) {
    return this.client.user.findUnique({ where: { id: userId } });
  }

  public findUserByPhone(phone: string) {
    return this.client.user.findUnique({ where: { phone } });
  }

  public async markProviderSent(
    attemptId: string,
    userId: string,
    providerReference: string | null,
  ): Promise<void> {
    const result = await this.client.phoneVerificationAttempt.updateMany({
      data: { providerReference },
      where: { id: attemptId, status: 'PENDING', userId },
    });
    if (result.count !== 1) throw domainError('PHONE_VERIFICATION_NOT_FOUND');
  }

  public async markFailed(attemptId: string, userId: string, now: Date): Promise<void> {
    await this.client.phoneVerificationAttempt.updateMany({
      data: { failedAt: now, status: 'FAILED' },
      where: { id: attemptId, status: 'PENDING', userId },
    });
  }

  public async markExpired(attemptId: string, userId: string): Promise<void> {
    await this.client.phoneVerificationAttempt.updateMany({
      data: { status: 'EXPIRED' },
      where: { id: attemptId, status: 'PENDING', userId },
    });
  }

  public async reserveResend(input: ReserveAttemptInput): Promise<PhoneVerificationAttempt> {
    return this.client.$transaction(async (transaction) => {
      await lockAttempt(transaction, input.attemptId);
      const attempt = await transaction.phoneVerificationAttempt.findFirst({
        where: { id: input.attemptId, userId: input.userId },
      });
      if (attempt === null || attempt.status !== 'PENDING') {
        throw domainError('PHONE_VERIFICATION_NOT_FOUND');
      }
      if (attempt.expiresAt <= input.now) throw domainError('PHONE_VERIFICATION_EXPIRED');
      if (attempt.resendAvailableAt > input.now || attempt.sendCount >= input.maxCount) {
        throw domainError('PHONE_VERIFICATION_RATE_LIMITED');
      }
      return transaction.phoneVerificationAttempt.update({
        data: {
          resendAvailableAt: input.nextAvailableAt ?? attempt.resendAvailableAt,
          sendCount: { increment: 1 },
        },
        where: { id: attempt.id },
      });
    });
  }

  public async reserveCheck(input: ReserveAttemptInput): Promise<PhoneVerificationAttempt> {
    return this.client.$transaction(async (transaction) => {
      await lockAttempt(transaction, input.attemptId);
      const attempt = await transaction.phoneVerificationAttempt.findFirst({
        where: { id: input.attemptId, userId: input.userId },
      });
      if (attempt === null) throw domainError('PHONE_VERIFICATION_NOT_FOUND');
      if (attempt.status !== 'PENDING') return attempt;
      if (attempt.expiresAt <= input.now) {
        return transaction.phoneVerificationAttempt.update({
          data: { status: 'EXPIRED' },
          where: { id: attempt.id },
        });
      }
      if (attempt.verificationCheckCount >= input.maxCount) {
        throw domainError('PHONE_VERIFICATION_RATE_LIMITED');
      }
      return transaction.phoneVerificationAttempt.update({
        data: { verificationCheckCount: { increment: 1 } },
        where: { id: attempt.id },
      });
    });
  }

  public async markProviderVerified(
    attemptId: string,
    userId: string,
    now: Date,
  ): Promise<PhoneVerificationAttempt> {
    await this.client.phoneVerificationAttempt.updateMany({
      data: { providerVerifiedAt: now, status: 'PROVIDER_VERIFIED' },
      where: { id: attemptId, status: 'PENDING', userId },
    });
    const attempt = await this.findOwned(attemptId, userId);
    if (attempt === null || !['PROVIDER_VERIFIED', 'LINKED'].includes(attempt.status)) {
      throw domainError('PHONE_VERIFICATION_NOT_FOUND');
    }
    return attempt;
  }

  public async completeLink(
    userId: string,
    attemptId: string,
    phone: string,
    now: Date,
  ): Promise<User> {
    try {
      return await this.client.$transaction(async (transaction) => {
        await lockUser(transaction, userId);
        const attempt = await transaction.phoneVerificationAttempt.findFirst({
          where: { id: attemptId, userId },
        });
        if (attempt === null || !['PROVIDER_VERIFIED', 'LINKED'].includes(attempt.status)) {
          throw domainError('PHONE_VERIFICATION_NOT_FOUND');
        }
        const user = await requireActiveUser(transaction, userId);
        if (user.phoneVerified && user.phone !== phone) {
          throw domainError('PHONE_IDENTITY_CONFLICT');
        }
        const owner = await transaction.user.findUnique({ where: { phone } });
        if (owner !== null && owner.id !== userId) throw domainError('PHONE_ALREADY_IN_USE');

        const linkedUser =
          user.phone === phone && user.phoneVerified
            ? user
            : await transaction.user.update({
                data: { phone, phoneVerified: true },
                where: { id: userId },
              });
        if (attempt.status !== 'LINKED') {
          await transaction.phoneVerificationAttempt.update({
            data: { linkedAt: now, status: 'LINKED' },
            where: { id: attemptId },
          });
        }
        return linkedUser;
      });
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) throw domainError('PHONE_ALREADY_IN_USE');
      throw error;
    }
  }

  public async cancelCurrent(userId: string, now: Date): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      await lockUser(transaction, userId);
      await transaction.phoneVerificationAttempt.updateMany({
        data: { cancelledAt: now, status: 'CANCELLED' },
        where: { status: 'PENDING', userId },
      });
    });
  }
}
