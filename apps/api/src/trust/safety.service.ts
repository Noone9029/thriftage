import { Inject, Injectable } from '@nestjs/common';
import {
  blockPageSchema,
  adminUserDetailSchema,
  adminUserPageSchema,
  adminUserQuerySchema,
  restrictionInputSchema,
  restrictionSchema,
  safetyActionInputSchema,
  safetyStatusSchema,
  trustMetricsSchema,
  type RestrictionInput,
  type SafetyActionInput,
} from '@thriftage/shared';
import {
  MARKETPLACE_EVENT_PUBLISHER,
  type MarketplaceEventPublisher,
} from '../common/marketplace-event-publisher';
import { SafetyRepository } from './safety.repository';
import { mapTrustError, TrustDomainError } from './trust.errors';
import { ReputationReader } from './reputation.reader';

@Injectable()
export class SafetyService {
  public constructor(
    @Inject(SafetyRepository) private readonly repository: SafetyRepository,
    @Inject(MARKETPLACE_EVENT_PUBLISHER) private readonly events: MarketplaceEventPublisher,
    @Inject(ReputationReader) private readonly reputation: ReputationReader,
  ) {}
  private restriction(r: {
    id: string;
    userId: string;
    scope: 'MESSAGING' | 'SELLING' | 'BUYING' | 'SOCIAL';
    reason: string;
    startsAt: Date;
    expiresAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
  }) {
    return restrictionSchema.parse({
      ...r,
      startsAt: r.startsAt.toISOString(),
      expiresAt: r.expiresAt?.toISOString() ?? null,
      revokedAt: r.revokedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    });
  }
  public async block(userId: string, targetId: string) {
    try {
      const { block, target } = await this.repository.block(userId, targetId);
      this.events.publish({ actorId: userId, name: 'user_blocked', targetUserId: targetId });
      return {
        blockedUserId: target.id,
        username: target.profile?.username ?? 'unavailable',
        profileImageUrl: target.profile?.profileImageUrl ?? null,
        createdAt: block.createdAt.toISOString(),
      };
    } catch (e) {
      throw mapTrustError(e);
    }
  }
  public async unblock(userId: string, targetId: string) {
    try {
      await this.repository.unblock(userId, targetId);
      this.events.publish({ actorId: userId, name: 'user_unblocked', targetUserId: targetId });
    } catch (e) {
      throw mapTrustError(e);
    }
  }
  public async blocks(userId: string) {
    try {
      const records = await this.repository.listBlocks(userId);
      return blockPageSchema.parse({
        items: records.map((x) => ({
          blockedUserId: x.blockedUserId,
          username: x.blockedUser.profile?.username ?? 'unavailable',
          profileImageUrl: x.blockedUser.profile?.profileImageUrl ?? null,
          createdAt: x.createdAt.toISOString(),
        })),
      });
    } catch (e) {
      throw mapTrustError(e);
    }
  }
  public async assertPairAllowed(a: string, b: string) {
    try {
      await this.repository.assertPairAllowed(a, b);
    } catch (e) {
      throw mapTrustError(e);
    }
  }
  public async blockedCounterpartIds(userId: string): Promise<readonly string[]> {
    try {
      return await this.repository.blockedCounterpartIds(userId);
    } catch (e) {
      throw mapTrustError(e);
    }
  }
  public async assertListingPairAllowed(userId: string, listingId: string) {
    try {
      await this.repository.assertListingPairAllowed(userId, listingId);
    } catch (e) {
      throw mapTrustError(e);
    }
  }
  public async assertScopeAllowed(
    userId: string,
    scope: 'MESSAGING' | 'SELLING' | 'BUYING' | 'SOCIAL',
  ) {
    try {
      await this.repository.assertScopeAllowed(userId, scope);
    } catch (e) {
      throw mapTrustError(e);
    }
  }
  public async status(userId: string, supportUrl?: string) {
    const [restrictionRecords, actionRecords] = await Promise.all([
      this.repository.activeRestrictions(userId),
      this.repository.recentSafetyActions(userId),
    ]);
    return safetyStatusSchema.parse({
      actions: actionRecords.map((action) => ({
        id: action.id,
        type: action.type,
        reason: action.reason,
        createdAt: action.createdAt.toISOString(),
      })),
      restrictions: restrictionRecords.map((restriction) => this.restriction(restriction)),
      supportUrl: supportUrl ?? null,
    });
  }
  public async restrict(adminId: string, userId: string, input: RestrictionInput) {
    try {
      const r = await this.repository.applyRestriction(
        adminId,
        userId,
        restrictionInputSchema.parse(input),
      );
      this.events.publish({ actorId: adminId, name: 'restriction_applied', targetUserId: userId });
      return this.restriction(r);
    } catch (e) {
      throw mapTrustError(e);
    }
  }
  public async revoke(adminId: string, id: string, reason: string) {
    try {
      return this.restriction(await this.repository.revokeRestriction(adminId, id, reason));
    } catch (e) {
      throw mapTrustError(e);
    }
  }
  public async action(adminId: string, userId: string, input: SafetyActionInput) {
    try {
      return await this.repository.applyAction(
        adminId,
        userId,
        safetyActionInputSchema.parse(input),
      );
    } catch (e) {
      throw mapTrustError(e);
    }
  }
  public async metrics() {
    const [
      openReviewReports,
      openDisputes,
      pendingVerifications,
      activeRestrictions,
      suspendedAccounts,
    ] = await this.repository.metrics();
    return trustMetricsSchema.parse({
      openReviewReports,
      openDisputes,
      pendingVerifications,
      activeRestrictions,
      suspendedAccounts,
    });
  }
  public async adminUsers(queryInput: unknown) {
    try {
      const query = adminUserQuerySchema.parse(queryInput);
      const records = await this.repository.adminUsers(query.query, query.limit);
      const ids = records.map(({ id }) => id);
      const [sellerRatings, buyerRatings, verified] = await Promise.all([
        this.reputation.summaries(ids, 'BUYER_TO_SELLER'),
        this.reputation.summaries(ids, 'SELLER_TO_BUYER'),
        this.reputation.verified(ids),
      ]);
      return adminUserPageSchema.parse({
        items: records.map((record) => ({
          id: record.id,
          username: record.profile?.username ?? null,
          role: record.role,
          accountStatus: record.accountStatus,
          completedSales: record._count.ordersAsSeller,
          completedPurchases: record._count.ordersAsBuyer,
          sellerRating: sellerRatings.get(record.id),
          buyerRating: buyerRatings.get(record.id),
          sellerVerified: verified.has(record.id),
          activeRestrictions: record.restrictions.map((restriction) =>
            this.restriction(restriction),
          ),
        })),
      });
    } catch (e) {
      throw mapTrustError(e);
    }
  }
  public async adminUser(id: string) {
    try {
      const record = await this.repository.adminUser(id);
      if (!record) throw new TrustDomainError('ADMIN_USER_NOT_FOUND');
      const [sellerRatings, buyerRatings, verified] = await Promise.all([
        this.reputation.summaries([id], 'BUYER_TO_SELLER'),
        this.reputation.summaries([id], 'SELLER_TO_BUYER'),
        this.reputation.verified([id]),
      ]);
      return adminUserDetailSchema.parse({
        id: record.id,
        username: record.profile?.username ?? null,
        role: record.role,
        accountStatus: record.accountStatus,
        memberSince: record.createdAt.toISOString(),
        bio: record.profile?.bio ?? null,
        university: record.profile?.university ?? null,
        completedSales: record._count.ordersAsSeller,
        completedPurchases: record._count.ordersAsBuyer,
        sellerRating: sellerRatings.get(id),
        buyerRating: buyerRatings.get(id),
        sellerVerified: verified.has(id),
        verificationStatus: record.sellerVerifications[0]?.status ?? null,
        reportsReceived: record._count.reportsTargetingUser,
        disputeCount: record._count.disputesOpened + record._count.disputesAgainst,
        activeRestrictions: record.restrictions.map((restriction) => this.restriction(restriction)),
        safetyActions: record.safetyActionsReceived.map((action) => ({
          ...action,
          createdAt: action.createdAt.toISOString(),
        })),
      });
    } catch (e) {
      throw mapTrustError(e);
    }
  }
}
