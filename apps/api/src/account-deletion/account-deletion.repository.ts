import {
  getPrismaClient,
  type AccountDeletionRequest,
  type PrismaClient,
  type User,
} from '@thriftage/db';

import { AccountDeletionDomainError } from './account-deletion.errors';

const activeOrderStatuses = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED'] as const;
const activeDisputeStatuses = ['OPEN', 'UNDER_REVIEW', 'AWAITING_INFORMATION'] as const;

export interface AccountDeletionMedia {
  readonly listingImageKeys: readonly string[];
  readonly profileImageKey: string | null;
}

export class AccountDeletionRepository {
  public constructor(private readonly prisma?: PrismaClient) {}

  public get db(): PrismaClient {
    return this.prisma ?? getPrismaClient();
  }

  public findForAuthProvider(authProviderUserId: string): Promise<AccountDeletionRequest | null> {
    return this.db.accountDeletionRequest.findFirst({ where: { authProviderUserId } });
  }

  public findUserForAuthProvider(authProviderUserId: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { authProviderUserId } });
  }

  public findByUserId(userId: string): Promise<AccountDeletionRequest | null> {
    return this.db.accountDeletionRequest.findUnique({ where: { userId } });
  }

  public async request(
    userId: string,
    authProviderUserId: string,
  ): Promise<AccountDeletionRequest> {
    return this.db.$transaction(
      async (transaction) => {
        const existing = await transaction.accountDeletionRequest.findUnique({ where: { userId } });
        if (existing !== null) return existing;

        const user = await transaction.user.findUnique({ where: { id: userId } });
        if (user === null) throw new AccountDeletionDomainError('ACCOUNT_DELETION_NOT_FOUND');
        if (user.role !== 'USER') {
          throw new AccountDeletionDomainError('ACCOUNT_DELETION_ADMIN_UNSUPPORTED');
        }

        const activeOrders = await transaction.order.count({
          where: {
            OR: [{ buyerId: userId }, { sellerId: userId }],
            status: { in: [...activeOrderStatuses] },
          },
        });
        if (activeOrders > 0) {
          throw new AccountDeletionDomainError('ACCOUNT_DELETION_ACTIVE_COMMERCE');
        }

        const activeDisputes = await transaction.dispute.count({
          where: {
            OR: [{ counterpartyId: userId }, { openerId: userId }],
            status: { in: [...activeDisputeStatuses] },
          },
        });
        if (activeDisputes > 0) {
          throw new AccountDeletionDomainError('ACCOUNT_DELETION_ACTIVE_DISPUTE');
        }

        const requestedAt = new Date();
        const request = await transaction.accountDeletionRequest.create({
          data: { authProviderUserId, requestedAt, userId },
        });
        await transaction.user.update({
          data: { accountStatus: 'DEACTIVATED', deletedAt: requestedAt },
          where: { id: userId },
        });
        await transaction.pushDevice.updateMany({
          data: { active: false },
          where: { userId },
        });
        return request;
      },
      { isolationLevel: 'Serializable' },
    );
  }

  public markSessionRevoked(id: string): Promise<AccountDeletionRequest> {
    return this.db.accountDeletionRequest.update({
      data: { sessionRevokedAt: new Date() },
      where: { id },
    });
  }

  public async claim(limit: number, staleLockSeconds: number): Promise<AccountDeletionRequest[]> {
    return this.db.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<Array<{ readonly id: string }>>`
        WITH candidates AS (
          SELECT "id"
          FROM "account_deletion_requests"
          WHERE (
            "status" IN ('REQUESTED', 'RETRY')
            AND "next_attempt_at" <= CURRENT_TIMESTAMP
          ) OR (
            "status" = 'PROCESSING'
            AND "locked_at" < CURRENT_TIMESTAMP - (${staleLockSeconds} * INTERVAL '1 second')
          )
          ORDER BY "requested_at" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${limit}
        )
        UPDATE "account_deletion_requests" AS request
        SET "status" = 'PROCESSING',
            "attempts" = request."attempts" + 1,
            "locked_at" = CURRENT_TIMESTAMP,
            "last_error_code" = NULL,
            "updated_at" = CURRENT_TIMESTAMP
        FROM candidates
        WHERE request."id" = candidates."id"
        RETURNING request."id"
      `;
      if (rows.length === 0) return [];
      return transaction.accountDeletionRequest.findMany({
        orderBy: { requestedAt: 'asc' },
        where: { id: { in: rows.map(({ id }) => id) } },
      });
    });
  }

  public async getMedia(userId: string): Promise<AccountDeletionMedia> {
    const [profile, listingImages] = await Promise.all([
      this.db.profile.findUnique({ select: { profileImageKey: true }, where: { userId } }),
      this.db.listingImage.findMany({
        select: { storageKey: true },
        where: { listing: { sellerId: userId } },
      }),
    ]);
    return {
      listingImageKeys: listingImages.map(({ storageKey }) => storageKey),
      profileImageKey: profile?.profileImageKey ?? null,
    };
  }

  public markMediaDeleted(id: string): Promise<AccountDeletionRequest> {
    return this.db.accountDeletionRequest.update({
      data: { mediaDeletedAt: new Date() },
      where: { id },
    });
  }

  public async anonymizeApplicationData(request: AccountDeletionRequest): Promise<void> {
    const { id: requestId, userId } = request;
    await this.db.$transaction(async (transaction) => {
      const current = await transaction.accountDeletionRequest.findUnique({
        where: { id: requestId },
      });
      if (current === null) throw new AccountDeletionDomainError('ACCOUNT_DELETION_NOT_FOUND');
      if (current.dataAnonymizedAt !== null) return;

      const [ownedListings, buyerOrders] = await Promise.all([
        transaction.listing.findMany({ select: { id: true }, where: { sellerId: userId } }),
        transaction.order.findMany({ select: { id: true }, where: { buyerId: userId } }),
      ]);
      const listingIds = ownedListings.map(({ id }) => id);
      const buyerOrderIds = buyerOrders.map(({ id }) => id);

      await transaction.betaFeedback.deleteMany({ where: { userId } });
      await transaction.aiResponseFeedback.deleteMany({ where: { userId } });
      await transaction.savedOutfit.deleteMany({ where: { userId } });
      await transaction.aiAttributionEvent.deleteMany({ where: { userId } });
      await transaction.aiStylistConversation.deleteMany({ where: { userId } });
      await transaction.recommendationEvent.deleteMany({ where: { userId } });
      await transaction.recommendationFeedback.deleteMany({ where: { userId } });
      await transaction.userStyleProfile.deleteMany({ where: { userId } });
      await transaction.personalizationAudit.updateMany({
        data: { userId: null },
        where: { userId },
      });
      await transaction.personalizationAudit.updateMany({
        data: { actorId: null },
        where: { actorId: userId },
      });

      await transaction.listingLike.deleteMany({ where: { userId } });
      await transaction.savedListing.deleteMany({ where: { userId } });
      await transaction.follow.deleteMany({
        where: { OR: [{ followedId: userId }, { followerId: userId }] },
      });
      await transaction.userBlock.deleteMany({
        where: { OR: [{ blockedUserId: userId }, { blockerId: userId }] },
      });
      await transaction.address.deleteMany({ where: { userId } });
      await transaction.phoneVerificationAttempt.deleteMany({ where: { userId } });

      await transaction.pushDelivery.deleteMany({
        where: { OR: [{ notification: { recipientId: userId } }, { pushDevice: { userId } }] },
      });
      await transaction.pushDevice.deleteMany({ where: { userId } });
      await transaction.notification.deleteMany({ where: { recipientId: userId } });
      await transaction.notification.updateMany({
        data: { actorUserId: null },
        where: { actorUserId: userId },
      });
      await transaction.notificationOutbox.deleteMany({ where: { recipientId: userId } });
      await transaction.notificationOutbox.updateMany({
        data: { actorUserId: null },
        where: { actorUserId: userId },
      });

      if (listingIds.length > 0) {
        await transaction.listingLike.deleteMany({ where: { listingId: { in: listingIds } } });
        await transaction.savedListing.deleteMany({ where: { listingId: { in: listingIds } } });
        await transaction.recommendationEvent.deleteMany({
          where: { listingId: { in: listingIds } },
        });
        await transaction.recommendationFeedback.deleteMany({
          where: { listingId: { in: listingIds } },
        });
        await transaction.listingStyle.deleteMany({ where: { listingId: { in: listingIds } } });
        await transaction.listingImage.deleteMany({ where: { listingId: { in: listingIds } } });
        await transaction.savedOutfitItem.updateMany({
          data: { listingId: null },
          where: { listingId: { in: listingIds } },
        });
        await transaction.listing.updateMany({
          data: {
            archivedAt: new Date(),
            brand: null,
            color: null,
            colorFamily: null,
            description: 'Removed after account deletion.',
            fitType: null,
            garmentRole: null,
            rejectionReason: null,
            size: 'N/A',
            sizeCompatibilityKey: null,
            sizeSystem: null,
            status: 'ARCHIVED',
            title: 'Deleted listing',
          },
          where: { id: { in: listingIds } },
        });
      }

      await transaction.message.updateMany({
        data: { body: '[Removed after account deletion]' },
        where: { senderId: userId },
      });
      await transaction.review.updateMany({ data: { text: null }, where: { reviewerId: userId } });
      await transaction.sellerVerification.updateMany({
        data: { statement: 'Removed after account deletion.', status: 'SUSPENDED' },
        where: { userId },
      });

      if (buyerOrderIds.length > 0) {
        await transaction.shipment.updateMany({
          data: { trackingNumber: null, trackingUrl: null },
          where: { orderId: { in: buyerOrderIds } },
        });
      }
      await transaction.order.updateMany({
        data: {
          addressLine1: 'Redacted',
          addressLine2: null,
          buyerUsername: 'deleted-user',
          city: 'Redacted',
          countryCode: 'ZZ',
          deliveryInstructions: null,
          deliveryPhone: '+10000000000',
          postalCode: null,
          recipientName: 'Deleted account',
          region: 'Redacted',
        },
        where: { buyerId: userId },
      });
      await transaction.order.updateMany({
        data: {
          listingImageKey: null,
          listingTitle: 'Deleted listing',
          sellerUsername: 'deleted-user',
        },
        where: { sellerId: userId },
      });

      await transaction.profile.deleteMany({ where: { userId } });
      await transaction.user.update({
        data: {
          accountStatus: 'DEACTIVATED',
          authProviderUserId: `deleted:${userId}`,
          email: null,
          emailVerified: false,
          fullName: 'Deleted account',
          phone: null,
          phoneVerified: false,
        },
        where: { id: userId },
      });
      await transaction.accountDeletionRequest.update({
        data: { dataAnonymizedAt: new Date() },
        where: { id: requestId },
      });
    });
  }

  public markAuthIdentityDeleted(id: string): Promise<AccountDeletionRequest> {
    return this.db.accountDeletionRequest.update({
      data: { authIdentityDeletedAt: new Date() },
      where: { id },
    });
  }

  public complete(id: string): Promise<AccountDeletionRequest> {
    return this.db.accountDeletionRequest.update({
      data: {
        authProviderUserId: null,
        completedAt: new Date(),
        lastErrorCode: null,
        lockedAt: null,
        status: 'COMPLETED',
      },
      where: { id },
    });
  }

  public fail(
    request: AccountDeletionRequest,
    errorCode: string,
    maxAttempts: number,
  ): Promise<AccountDeletionRequest> {
    const exhausted = request.attempts >= maxAttempts;
    const backoffSeconds = Math.min(3_600, 2 ** Math.min(request.attempts, 10) * 5);
    return this.db.accountDeletionRequest.update({
      data: {
        lastErrorCode: errorCode.slice(0, 64),
        lockedAt: null,
        nextAttemptAt: new Date(Date.now() + backoffSeconds * 1_000),
        status: exhausted ? 'FAILED' : 'RETRY',
      },
      where: { id: request.id },
    });
  }
}
