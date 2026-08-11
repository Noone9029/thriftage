import { Injectable } from '@nestjs/common';
import { getPrismaClient, type PrismaClient } from '@thriftage/db';

import { MarketplaceDomainError } from '../common/marketplace.errors';
import { listingArgs, type ListingRecord } from '../listings/listing.repository';

export interface SavedCursor {
  readonly listingId: string;
  readonly savedAt: Date;
}

export interface SellerProfileRecord {
  readonly bio: string | null;
  readonly completedSalesCount: number;
  readonly followerCount: number;
  readonly followedByViewer: boolean;
  readonly followingCount: number;
  readonly id: string;
  readonly listingCount: number;
  readonly memberSince: Date;
  readonly profileImageUrl: string | null;
  readonly university: string | null;
  readonly username: string;
}

@Injectable()
export class SocialRepository {
  public constructor(private readonly prisma?: PrismaClient) {}

  private get client(): PrismaClient {
    return this.prisma ?? getPrismaClient();
  }

  public async setLike(
    userId: string,
    listingId: string,
    active: boolean,
  ): Promise<{ readonly active: boolean; readonly changed: boolean; readonly count: number }> {
    return this.client.$transaction(async (transaction) => {
      const listing = await transaction.listing.findFirst({
        select: { sellerId: true },
        where: { id: listingId, status: 'ACTIVE' },
      });
      if (listing === null) throw new MarketplaceDomainError('LISTING_NOT_PUBLIC');
      if (listing.sellerId === userId) {
        throw new MarketplaceDomainError('SELF_INTERACTION_FORBIDDEN');
      }
      let changed = false;
      if (active) {
        const existing = await transaction.listingLike.findUnique({
          where: { userId_listingId: { listingId, userId } },
        });
        if (existing === null) {
          await transaction.listingLike.create({ data: { listingId, userId } });
          changed = true;
        }
      } else {
        const result = await transaction.listingLike.deleteMany({ where: { listingId, userId } });
        changed = result.count > 0;
      }
      return {
        active,
        changed,
        count: await transaction.listingLike.count({ where: { listingId } }),
      };
    });
  }

  public async setSaved(
    userId: string,
    listingId: string,
    active: boolean,
  ): Promise<{ readonly active: boolean; readonly changed: boolean; readonly count: number }> {
    return this.client.$transaction(async (transaction) => {
      const listing = await transaction.listing.findFirst({
        select: { sellerId: true },
        where: { id: listingId, status: 'ACTIVE' },
      });
      if (listing === null) throw new MarketplaceDomainError('LISTING_NOT_PUBLIC');
      if (listing.sellerId === userId) {
        throw new MarketplaceDomainError('SELF_INTERACTION_FORBIDDEN');
      }
      let changed = false;
      if (active) {
        const existing = await transaction.savedListing.findUnique({
          where: { userId_listingId: { listingId, userId } },
        });
        if (existing === null) {
          await transaction.savedListing.create({ data: { listingId, userId } });
          changed = true;
        }
      } else {
        const result = await transaction.savedListing.deleteMany({ where: { listingId, userId } });
        changed = result.count > 0;
      }
      return {
        active,
        changed,
        count: await transaction.savedListing.count({ where: { listingId } }),
      };
    });
  }

  public async setFollow(
    userId: string,
    targetUserId: string,
    active: boolean,
  ): Promise<{ readonly active: boolean; readonly changed: boolean; readonly count: number }> {
    if (userId === targetUserId) throw new MarketplaceDomainError('SELF_INTERACTION_FORBIDDEN');
    return this.client.$transaction(async (transaction) => {
      const target = await transaction.user.findFirst({
        where: {
          accountStatus: 'ACTIVE',
          deletedAt: null,
          id: targetUserId,
          profile: { isNot: null },
        },
      });
      if (target === null) throw new MarketplaceDomainError('SELLER_NOT_FOUND');
      let changed = false;
      if (active) {
        const existing = await transaction.follow.findUnique({
          where: { followerId_followedId: { followedId: targetUserId, followerId: userId } },
        });
        if (existing === null) {
          await transaction.follow.create({
            data: { followedId: targetUserId, followerId: userId },
          });
          changed = true;
        }
      } else {
        const result = await transaction.follow.deleteMany({
          where: { followedId: targetUserId, followerId: userId },
        });
        changed = result.count > 0;
      }
      return {
        active,
        changed,
        count: await transaction.follow.count({ where: { followedId: targetUserId } }),
      };
    });
  }

  public async findSellerProfile(
    username: string,
    viewerId?: string,
  ): Promise<SellerProfileRecord | null> {
    const profile = await this.client.profile.findFirst({
      include: { user: true },
      where: {
        username,
        user: { accountStatus: 'ACTIVE', deletedAt: null },
      },
    });
    if (profile === null) return null;
    const [followerCount, followingCount, listingCount, viewerFollow] = await Promise.all([
      this.client.follow.count({ where: { followedId: profile.userId } }),
      this.client.follow.count({ where: { followerId: profile.userId } }),
      this.client.listing.count({ where: { sellerId: profile.userId, status: 'ACTIVE' } }),
      viewerId === undefined
        ? Promise.resolve(null)
        : this.client.follow.findUnique({
            where: {
              followerId_followedId: { followedId: profile.userId, followerId: viewerId },
            },
          }),
    ]);
    return {
      bio: profile.bio,
      completedSalesCount: profile.completedSalesCount,
      followerCount,
      followedByViewer: viewerFollow !== null,
      followingCount,
      id: profile.userId,
      listingCount,
      memberSince: profile.user.createdAt,
      profileImageUrl: profile.profileImageUrl,
      university: profile.university,
      username: profile.username,
    };
  }

  public async listSaved(
    userId: string,
    limit: number,
    cursor: SavedCursor | null,
  ): Promise<{
    readonly hasMore: boolean;
    readonly records: readonly ListingRecord[];
    readonly rows: readonly { readonly listingId: string; readonly savedAt: Date }[];
  }> {
    const saved = await this.client.savedListing.findMany({
      include: { listing: listingArgs },
      orderBy: [{ createdAt: 'desc' }, { listingId: 'desc' }],
      take: limit + 1,
      where: {
        userId,
        listing: { status: 'ACTIVE' },
        ...(cursor === null
          ? {}
          : {
              OR: [
                { createdAt: { lt: cursor.savedAt } },
                { createdAt: cursor.savedAt, listingId: { lt: cursor.listingId } },
              ],
            }),
      },
    });
    const page = saved.slice(0, limit);
    return {
      hasMore: saved.length > limit,
      records: page.map(({ listing }) => listing),
      rows: page.map(({ createdAt, listingId }) => ({ listingId, savedAt: createdAt })),
    };
  }
}
