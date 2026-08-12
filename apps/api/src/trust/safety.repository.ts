import { Injectable } from '@nestjs/common';
import {
  getPrismaClient,
  type Prisma,
  type PrismaClient,
  type RestrictionScope,
} from '@thriftage/db';
import type { RestrictionInput, SafetyActionInput } from '@thriftage/shared';
import { z } from 'zod';
import { TrustDomainError } from './trust.errors';

const blockInclude = { blockedUser: { include: { profile: true } } } as const;
type BlockRecord = Prisma.UserBlockGetPayload<{ include: typeof blockInclude }>;
type AdminUserListRecord = Prisma.UserGetPayload<{
  include: {
    profile: true;
    restrictions: true;
    _count: { select: { ordersAsBuyer: true; ordersAsSeller: true } };
  };
}>;
type AdminUserDetailRecord = Prisma.UserGetPayload<{
  include: {
    profile: true;
    restrictions: true;
    sellerVerifications: true;
    safetyActionsReceived: true;
    _count: {
      select: {
        ordersAsBuyer: true;
        ordersAsSeller: true;
        reportsTargetingUser: true;
        disputesOpened: true;
        disputesAgainst: true;
      };
    };
  };
}>;

@Injectable()
export class SafetyRepository {
  public constructor(private readonly prisma?: PrismaClient) {}
  private get client() {
    return this.prisma ?? getPrismaClient();
  }
  public async block(blockerId: string, blockedUserId: string) {
    if (blockerId === blockedUserId) throw new TrustDomainError('BLOCK_FORBIDDEN');
    return this.client.$transaction(async (tx) => {
      const target = await tx.user.findFirst({
        where: { id: blockedUserId, accountStatus: 'ACTIVE', role: 'USER' },
        include: { profile: true },
      });
      if (!target) throw new TrustDomainError('BLOCK_FORBIDDEN');
      const block = await tx.userBlock.upsert({
        create: { blockerId, blockedUserId },
        update: {},
        where: { blockerId_blockedUserId: { blockerId, blockedUserId } },
      });
      await tx.follow.deleteMany({
        where: {
          OR: [
            { followerId: blockerId, followedId: blockedUserId },
            { followerId: blockedUserId, followedId: blockerId },
          ],
        },
      });
      return { block, target };
    });
  }
  public async unblock(blockerId: string, blockedUserId: string) {
    const r = await this.client.userBlock.deleteMany({ where: { blockerId, blockedUserId } });
    if (r.count === 0) throw new TrustDomainError('BLOCK_NOT_FOUND');
  }
  public async listBlocks(blockerId: string): Promise<readonly BlockRecord[]> {
    return this.client.userBlock.findMany({
      where: { blockerId },
      orderBy: { createdAt: 'desc' },
      include: blockInclude,
    });
  }
  public async blockedBetween(a: string, b: string) {
    return (
      (await this.client.userBlock.count({
        where: {
          OR: [
            { blockerId: a, blockedUserId: b },
            { blockerId: b, blockedUserId: a },
          ],
        },
      })) > 0
    );
  }
  public async blockedCounterpartIds(userId: string): Promise<readonly string[]> {
    const rows = await this.client.userBlock.findMany({
      select: { blockedUserId: true, blockerId: true },
      where: { OR: [{ blockerId: userId }, { blockedUserId: userId }] },
    });
    return rows.map((row) => (row.blockerId === userId ? row.blockedUserId : row.blockerId));
  }
  public async assertPairAllowed(a: string, b: string) {
    if (await this.blockedBetween(a, b)) throw new TrustDomainError('INTERACTION_NOT_AVAILABLE');
  }
  public async assertListingPairAllowed(userId: string, listingId: string) {
    const listing = await this.client.listing.findUnique({
      where: { id: listingId },
      select: { sellerId: true },
    });
    if (!listing) throw new TrustDomainError('INTERACTION_NOT_AVAILABLE');
    await this.assertPairAllowed(userId, listing.sellerId);
  }
  public async activeRestrictions(userId: string) {
    return this.client.userRestriction.findMany({
      where: {
        userId,
        revokedAt: null,
        startsAt: { lte: new Date() },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  public async recentSafetyActions(userId: string) {
    return this.client.safetyAction.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
  public async assertScopeAllowed(userId: string, scope: RestrictionScope) {
    if (
      (await this.client.userRestriction.count({
        where: {
          userId,
          scope,
          revokedAt: null,
          startsAt: { lte: new Date() },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      })) > 0
    )
      throw new TrustDomainError('INTERACTION_NOT_AVAILABLE');
  }
  public applyRestriction(adminId: string, userId: string, input: RestrictionInput) {
    return this.client.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: userId } });
      if (!target || target.role === 'ADMIN')
        throw new TrustDomainError('INTERACTION_NOT_AVAILABLE');
      const restriction = await tx.userRestriction.create({
        data: {
          userId,
          scope: input.scope,
          reason: input.reason,
          createdById: adminId,
          ...(input.expiresAt ? { expiresAt: new Date(input.expiresAt) } : {}),
        },
      });
      await tx.safetyAction.create({
        data: {
          actorId: adminId,
          targetUserId: userId,
          type: input.expiresAt ? 'TEMPORARY_RESTRICTION' : 'PERMANENT_RESTRICTION',
          reason: input.reason,
          restrictionId: restriction.id,
          ...(input.linkedDisputeId === undefined ? {} : { disputeId: input.linkedDisputeId }),
          ...(input.linkedReportId === undefined ? {} : { reportId: input.linkedReportId }),
        },
      });
      await tx.trustAudit.create({
        data: {
          action: 'RESTRICTION_CREATED',
          actorId: adminId,
          targetUserId: userId,
          reason: input.reason,
          restrictionId: restriction.id,
        },
      });
      await tx.notificationOutbox.create({
        data: {
          recipientId: userId,
          eventType: 'ACCOUNT_RESTRICTED',
          dedupeKey: `restriction:${restriction.id}`,
          status: 'PENDING',
        },
      });
      return restriction;
    });
  }
  public revokeRestriction(adminId: string, id: string, reason: string) {
    return this.client.$transaction(async (tx) => {
      const existing = await tx.userRestriction.findUnique({ where: { id } });
      if (!existing) throw new TrustDomainError('RESTRICTION_NOT_FOUND');
      const restriction = await tx.userRestriction.update({
        where: { id },
        data: { revokedAt: new Date(), revokedReason: reason },
      });
      await tx.safetyAction.create({
        data: {
          actorId: adminId,
          targetUserId: existing.userId,
          type: 'RESTRICTION_REVOKED',
          reason,
          restrictionId: id,
        },
      });
      await tx.trustAudit.create({
        data: {
          action: 'RESTRICTION_REVOKED',
          actorId: adminId,
          targetUserId: existing.userId,
          reason,
          restrictionId: id,
        },
      });
      return restriction;
    });
  }
  public applyAction(adminId: string, userId: string, input: SafetyActionInput) {
    return this.client.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: userId } });
      if (!target || target.role === 'ADMIN')
        throw new TrustDomainError('INTERACTION_NOT_AVAILABLE');
      if (input.action === 'ACCOUNT_SUSPENSION')
        await tx.user.update({ where: { id: userId }, data: { accountStatus: 'SUSPENDED' } });
      const action = await tx.safetyAction.create({
        data: {
          actorId: adminId,
          targetUserId: userId,
          type: input.action,
          reason: input.reason,
          ...(input.linkedDisputeId === undefined ? {} : { disputeId: input.linkedDisputeId }),
          ...(input.linkedReportId === undefined ? {} : { reportId: input.linkedReportId }),
        },
      });
      await tx.trustAudit.create({
        data: {
          action: input.action === 'WARNING' ? 'WARNING_ISSUED' : 'ACCOUNT_SUSPENDED',
          actorId: adminId,
          targetUserId: userId,
          reason: input.reason,
        },
      });
      return action;
    });
  }
  public metrics() {
    const now = new Date();
    return Promise.all([
      this.client.reviewReport.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
      this.client.dispute.count({
        where: { status: { in: ['OPEN', 'UNDER_REVIEW', 'AWAITING_INFORMATION'] } },
      }),
      this.client.sellerVerification.count({ where: { status: 'PENDING' } }),
      this.client.userRestriction.count({
        where: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      }),
      this.client.user.count({ where: { accountStatus: 'SUSPENDED' } }),
    ]);
  }
  public async adminUsers(
    query: string | undefined,
    limit: number,
  ): Promise<readonly AdminUserListRecord[]> {
    const identifier = query && z.string().uuid().safeParse(query).success ? query : undefined;
    const now = new Date();
    return this.client.user.findMany({
      where: {
        role: 'USER',
        ...(query
          ? {
              OR: [
                ...(identifier === undefined ? [] : [{ id: identifier }]),
                { profile: { username: { contains: query, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        profile: true,
        restrictions: {
          where: {
            revokedAt: null,
            startsAt: { lte: now },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        },
        _count: {
          select: {
            ordersAsBuyer: { where: { status: 'COMPLETED' } },
            ordersAsSeller: { where: { status: 'COMPLETED' } },
          },
        },
      },
    });
  }
  public async adminUser(id: string): Promise<AdminUserDetailRecord | null> {
    const now = new Date();
    return this.client.user.findUnique({
      where: { id },
      include: {
        profile: true,
        restrictions: {
          where: {
            revokedAt: null,
            startsAt: { lte: now },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        },
        sellerVerifications: { orderBy: { submittedAt: 'desc' }, take: 1 },
        safetyActionsReceived: { orderBy: { createdAt: 'desc' }, take: 50 },
        _count: {
          select: {
            ordersAsBuyer: { where: { status: 'COMPLETED' } },
            ordersAsSeller: { where: { status: 'COMPLETED' } },
            reportsTargetingUser: true,
            disputesOpened: true,
            disputesAgainst: true,
          },
        },
      },
    });
  }
}
