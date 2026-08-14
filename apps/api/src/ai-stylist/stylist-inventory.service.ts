import { Inject, Injectable } from '@nestjs/common';
import { getPrismaClient, type Prisma, type PrismaClient } from '@thriftage/db';
import type { ListingDetail, StylistIntent } from '@thriftage/shared';

import { ListingPresenter } from '../listings/listing.presenter';
import { ListingRepository, listingArgs } from '../listings/listing.repository';
import { PersonalizationService } from '../personalization/personalization.service';
import type { StylistInventoryCandidate, StylistPersonalizationContext } from './ai-stylist.types';

const MAX_INVENTORY_CANDIDATES = 60;
const stylistListingArgs = {
  include: {
    ...listingArgs.include,
    seller: {
      include: {
        profile: true,
        sellerVerifications: { select: { status: true }, where: { status: 'VERIFIED' } },
      },
    },
  },
} as const satisfies Prisma.ListingDefaultArgs;

@Injectable()
export class StylistInventoryService {
  public constructor(
    @Inject(ListingRepository) private readonly listings: ListingRepository,
    @Inject(ListingPresenter) private readonly presenter: ListingPresenter,
    @Inject(PersonalizationService) private readonly personalization: PersonalizationService,
    private readonly injectedPrisma?: PrismaClient,
  ) {}

  private get prisma(): PrismaClient {
    return this.injectedPrisma ?? getPrismaClient();
  }

  public async personalizationContext(userId: string): Promise<StylistPersonalizationContext> {
    const context = await this.personalization.contextForStylist(userId);
    return {
      budgetMaxMinor: context.budgetMaxMinor,
      budgetMinMinor: context.budgetMinMinor,
      colors: context.colors,
      currency: context.currency,
      fits: context.fits,
      profileVersion: context.profileVersion,
      sizes: context.sizes,
      styles: [
        ...context.styles,
        ...context.recentStyleAffinities
          .filter(({ slug }) => !context.styles.some((style) => style.slug === slug))
          .map(({ score, slug }) => ({ slug, strength: Math.min(5, Math.max(1, score)) })),
      ].slice(0, 10),
    };
  }

  public async search(
    userId: string,
    intent: StylistIntent,
    personalization: StylistPersonalizationContext,
    limit = MAX_INVENTORY_CANDIDATES,
  ): Promise<StylistInventoryCandidate[]> {
    const forcedIds = [intent.anchorListingId, ...intent.lockedListingIds].filter(
      (id): id is string => id !== null,
    );
    const excludedSellerIds = await this.excludedSellerIds(userId);
    const requestedStyles = intent.requestedStyles;
    const eligibility = {
      garmentRole: { not: null },
      seller: {
        accountStatus: 'ACTIVE' as const,
        deletedAt: null,
        restrictions: {
          none: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            revokedAt: null,
            scope: 'SELLING' as const,
            startsAt: { lte: new Date() },
          },
        },
      },
      ...(excludedSellerIds.length === 0 ? {} : { sellerId: { notIn: excludedSellerIds } }),
      status: 'ACTIVE' as const,
    } satisfies Prisma.ListingWhereInput;
    const [forcedRecords, normalRecords] = await Promise.all([
      forcedIds.length === 0
        ? Promise.resolve([])
        : this.prisma.listing.findMany({
            ...stylistListingArgs,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            where: { ...eligibility, id: { in: forcedIds } },
          }),
      this.prisma.listing.findMany({
        ...stylistListingArgs,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: Math.min(MAX_INVENTORY_CANDIDATES, Math.max(1, limit)),
        where: {
          ...eligibility,
          currency: intent.currency,
          ...(forcedIds.length === 0 ? {} : { id: { notIn: forcedIds } }),
          recommendationFeedback: { none: { hiddenAt: { not: null }, userId } },
          sellerId: {
            not: userId,
            ...(excludedSellerIds.length === 0 ? {} : { notIn: excludedSellerIds }),
          },
          ...(intent.budgetMaxMinor === null ? {} : { priceMinor: { lte: intent.budgetMaxMinor } }),
          ...(intent.colors.length === 0 ? {} : { colorFamily: { in: intent.colors } }),
          ...(intent.excludedColors.length === 0
            ? {}
            : { colorFamily: { notIn: intent.excludedColors } }),
          ...(intent.preferredFits.length === 0 ? {} : { fitType: { in: intent.preferredFits } }),
          ...(requestedStyles.length === 0
            ? {}
            : {
                styles: {
                  some: { styleDefinition: { isActive: true, slug: { in: requestedStyles } } },
                },
              }),
        },
      }),
    ]);
    const records = [...forcedRecords, ...normalRecords].slice(0, MAX_INVENTORY_CANDIDATES);
    const ranking = await this.personalization.rankForYou(userId, new Date());
    const matches = new Map(ranking.ranked.map(({ id, match }) => [id, match]));
    return records.flatMap((record) => {
      const sizeConfidence = this.sizeConfidence(record, intent, personalization);
      return sizeConfidence === 'MISMATCH'
        ? []
        : [
            {
              colorFamily: record.colorFamily,
              currency: record.currency,
              fitType: record.fitType,
              garmentRole: record.garmentRole ?? 'OTHER',
              id: record.id,
              match: matches.get(record.id) ?? null,
              priceMinor: record.priceMinor,
              sellerCompletedSales: record.seller.profile?.completedSalesCount ?? 0,
              sellerId: record.sellerId,
              sellerVerified: record.seller.sellerVerifications.length > 0,
              sizeCompatibilityKey: record.sizeCompatibilityKey,
              sizeConfidence,
              sizeSystem: record.sizeSystem,
              styleSlugs: record.styles.map(({ styleDefinition }) => styleDefinition.slug),
            },
          ];
    });
  }

  public async savedCandidates(
    userId: string,
    intent: StylistIntent,
    personalization: StylistPersonalizationContext,
    limit: number,
  ): Promise<StylistInventoryCandidate[]> {
    const rows = await this.prisma.savedListing.findMany({
      orderBy: { createdAt: 'desc' },
      select: { listingId: true },
      take: Math.min(20, Math.max(1, limit)),
      where: { userId },
    });
    if (rows.length === 0) return [];
    const savedIds = new Set(rows.map(({ listingId }) => listingId));
    return (await this.search(userId, intent, personalization, MAX_INVENTORY_CANDIDATES)).filter(
      ({ id }) => savedIds.has(id),
    );
  }

  public async presentEligible(
    userId: string,
    listingIds: readonly string[],
  ): Promise<ReadonlyMap<string, ListingDetail>> {
    if (listingIds.length === 0) return new Map();
    const excludedSellerIds = await this.excludedSellerIds(userId);
    const valid = await this.prisma.listing.findMany({
      select: { id: true },
      where: {
        id: { in: [...new Set(listingIds)] },
        ...(excludedSellerIds.length === 0 ? {} : { sellerId: { notIn: excludedSellerIds } }),
        seller: {
          accountStatus: 'ACTIVE',
          deletedAt: null,
          restrictions: {
            none: {
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              revokedAt: null,
              scope: 'SELLING',
              startsAt: { lte: new Date() },
            },
          },
        },
        status: 'ACTIVE',
      },
    });
    const validIds = valid.map(({ id }) => id);
    const records = await this.listings.findByIds(validIds);
    const viewerState = await this.listings.getViewerState(userId, validIds);
    const ranking = await this.personalization.rankForYou(userId, new Date());
    const matches = new Map(ranking.ranked.map(({ id, match }) => [id, match]));
    const presented = await this.presenter.presentMany(records, viewerState, matches);
    return new Map(presented.map((listing) => [listing.id, listing]));
  }

  private sizeConfidence(
    record: {
      garmentRole: string | null;
      sizeCompatibilityKey: string | null;
      sizeSystem: string | null;
    },
    intent: StylistIntent,
    personalization: StylistPersonalizationContext,
  ): 'MATCH' | 'MISMATCH' | 'UNKNOWN' {
    const constraints =
      intent.sizeConstraints.length > 0 ? intent.sizeConstraints : personalization.sizes;
    const forRole = constraints.filter(({ garmentRole }) => garmentRole === record.garmentRole);
    if (forRole.length === 0 || record.sizeSystem === null || record.sizeCompatibilityKey === null)
      return 'UNKNOWN';
    const comparable = forRole.filter(({ sizeSystem }) => sizeSystem === record.sizeSystem);
    if (comparable.length === 0) return 'UNKNOWN';
    return comparable.some(
      ({ sizeKey }) => sizeKey.toUpperCase() === record.sizeCompatibilityKey?.toUpperCase(),
    )
      ? 'MATCH'
      : 'MISMATCH';
  }

  private async excludedSellerIds(userId: string): Promise<string[]> {
    const blocks = await this.prisma.userBlock.findMany({
      select: { blockedUserId: true, blockerId: true },
      where: { OR: [{ blockerId: userId }, { blockedUserId: userId }] },
    });
    return blocks.map((row) => (row.blockerId === userId ? row.blockedUserId : row.blockerId));
  }
}
