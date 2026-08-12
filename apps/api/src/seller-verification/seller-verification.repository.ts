import { Injectable } from '@nestjs/common';
import {
  getPrismaClient,
  type Prisma,
  type PrismaClient,
  type SellerVerificationStatus,
} from '@thriftage/db';
import { z } from 'zod';
import { SellerVerificationError } from './seller-verification.errors';
const include = {
  user: { include: { profile: true } },
  reviewer: { include: { profile: true } },
} as const;
export type SellerVerificationRecord = Prisma.SellerVerificationGetPayload<{
  include: typeof include;
}>;
@Injectable()
export class SellerVerificationRepository {
  constructor(private readonly prisma?: PrismaClient) {}
  private get client() {
    return this.prisma ?? getPrismaClient();
  }
  async eligibility(userId: string, minSales: number) {
    const user = await this.client.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        sellerVerifications: { orderBy: { submittedAt: 'desc' }, take: 1, include },
      },
    });
    if (!user) throw new SellerVerificationError('VERIFICATION_NOT_ELIGIBLE');
    const requirements = [
      { key: 'EMAIL_VERIFIED' as const, met: user.emailVerified, label: 'Verified email' },
      { key: 'PHONE_VERIFIED' as const, met: user.phoneVerified, label: 'Verified phone' },
      { key: 'PROFILE_COMPLETE' as const, met: user.profile !== null, label: 'Completed profile' },
      {
        key: 'ACCOUNT_ACTIVE' as const,
        met: user.accountStatus === 'ACTIVE',
        label: 'Active account',
      },
      {
        key: 'ACTIVITY_THRESHOLD' as const,
        met: (user.profile?.completedSalesCount ?? 0) >= minSales,
        label: minSales === 0 ? 'No minimum sales requirement' : `${minSales} completed sales`,
      },
    ];
    return {
      requirements,
      current: user.sellerVerifications[0] ?? null,
      eligible: requirements.every((x) => x.met),
    };
  }
  current(userId: string) {
    return this.client.sellerVerification.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      include,
    });
  }
  async apply(userId: string, statement: string, minSales: number) {
    const state = await this.eligibility(userId, minSales);
    if (!state.eligible) throw new SellerVerificationError('VERIFICATION_NOT_ELIGIBLE');
    if (state.current && ['PENDING', 'VERIFIED'].includes(state.current.status))
      throw new SellerVerificationError('VERIFICATION_ALREADY_ACTIVE');
    if (state.current?.canReapplyAt && state.current.canReapplyAt > new Date())
      throw new SellerVerificationError('VERIFICATION_REAPPLY_LATER');
    return this.client.$transaction(async (tx) => {
      const v = await tx.sellerVerification.create({ data: { userId, statement }, include });
      await tx.notificationOutbox.create({
        data: {
          recipientId: userId,
          eventType: 'SELLER_VERIFICATION_SUBMITTED',
          sellerVerificationId: v.id,
          dedupeKey: `seller-verification-submitted:${v.id}`,
        },
      });
      return v;
    });
  }
  list(status: SellerVerificationStatus | undefined, query: string | undefined, limit: number) {
    const identifier = query && z.string().uuid().safeParse(query).success ? query : undefined;
    return this.client.sellerVerification.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(query
          ? {
              OR: [
                ...(identifier === undefined ? [] : [{ id: { equals: identifier } }]),
                { user: { profile: { username: { contains: query, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      },
      orderBy: { submittedAt: 'asc' },
      take: limit,
      include,
    });
  }
  async decide(
    adminId: string,
    id: string,
    action: 'APPROVE' | 'REJECT' | 'SUSPEND',
    reason: string,
    reapplyDays: number,
  ) {
    return this.client.$transaction(async (tx) => {
      const current = await tx.sellerVerification.findUnique({ where: { id }, include });
      if (!current) throw new SellerVerificationError('VERIFICATION_NOT_FOUND');
      const status: SellerVerificationStatus =
        action === 'APPROVE' ? 'VERIFIED' : action === 'REJECT' ? 'REJECTED' : 'SUSPENDED';
      const v = await tx.sellerVerification.update({
        where: { id },
        data: {
          status,
          reviewerId: adminId,
          decisionReason: reason,
          reviewedAt: new Date(),
          ...(status === 'REJECTED'
            ? { canReapplyAt: new Date(Date.now() + reapplyDays * 86400000) }
            : {}),
        },
        include,
      });
      const auditAction =
        action === 'APPROVE'
          ? 'SELLER_VERIFICATION_APPROVED'
          : action === 'REJECT'
            ? 'SELLER_VERIFICATION_REJECTED'
            : 'SELLER_VERIFICATION_SUSPENDED';
      await tx.trustAudit.create({
        data: {
          actorId: adminId,
          targetUserId: current.userId,
          sellerVerificationId: id,
          reason,
          action: auditAction,
        },
      });
      await tx.notificationOutbox.create({
        data: {
          recipientId: current.userId,
          eventType:
            action === 'APPROVE' ? 'SELLER_VERIFICATION_APPROVED' : 'SELLER_VERIFICATION_REJECTED',
          sellerVerificationId: id,
          dedupeKey: `seller-verification-decision:${id}:${status}`,
        },
      });
      return v;
    });
  }
}
