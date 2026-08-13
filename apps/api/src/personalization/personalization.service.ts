import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { getPrismaClient, type PrismaClient } from '@thriftage/db';
import {
  privacyStatusSchema,
  recommendationFeedbackSchema,
  styleDefinitionSchema,
  styleProfileSchema,
  styleQuizCompleteSchema,
  styleQuizSaveSchema,
  type RecommendationEventInput,
  type RecommendationConfigurationInput,
  type PersonalizationAdminSummary,
  type StyleDefinition,
  type StyleProfile,
} from '@thriftage/shared';
import {
  rankRecommendations,
  type BehaviorContext,
  type RecommendationCandidate,
  type RecommendationProfile,
} from './recommendation-engine';

const profileInclude = {
  colors: true,
  fits: { orderBy: { rank: 'asc' as const } },
  sizes: true,
  styles: { include: { styleDefinition: true }, orderBy: { strength: 'desc' as const } },
} as const;

@Injectable()
export class PersonalizationService {
  public constructor(private readonly injectedPrisma?: PrismaClient) {}

  private get prisma(): PrismaClient {
    return this.injectedPrisma ?? getPrismaClient();
  }

  public async definitions(includeInactive = false): Promise<StyleDefinition[]> {
    const rows = await this.prisma.styleDefinition.findMany({
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
      ...(includeInactive ? {} : { where: { isActive: true } }),
    });
    return rows.map((row) => this.presentDefinition(row));
  }

  public async get(userId: string): Promise<StyleProfile> {
    const row = await this.prisma.userStyleProfile.upsert({
      create: { userId },
      include: profileInclude,
      update: {},
      where: { userId },
    });
    return this.present(row);
  }

  public async save(userId: string, inputValue: unknown, complete: boolean): Promise<StyleProfile> {
    const input = (complete ? styleQuizCompleteSchema : styleQuizSaveSchema).parse(inputValue);
    await this.assertActiveStyles(input.styles.map(({ styleDefinitionId }) => styleDefinitionId));
    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.userStyleProfile.findUnique({ where: { userId } });
      const profile = await tx.userStyleProfile.upsert({
        create: {
          budgetMaxMinor: input.budgetMaxMinor ?? null,
          budgetMinMinor: input.budgetMinMinor ?? null,
          completedAt: complete ? new Date() : null,
          currency: input.currency,
          expressions: input.expressions,
          lifestyles: input.lifestyles,
          priorities: input.priorities,
          quizStatus: complete ? 'COMPLETED' : 'IN_PROGRESS',
          quizStep: input.quizStep,
          userId,
        },
        update: {
          budgetMaxMinor: input.budgetMaxMinor ?? null,
          budgetMinMinor: input.budgetMinMinor ?? null,
          completedAt: complete ? new Date() : (existing?.completedAt ?? null),
          currency: input.currency,
          expressions: input.expressions,
          lifestyles: input.lifestyles,
          priorities: input.priorities,
          profileVersion: { increment: 1 },
          quizStatus: complete ? 'COMPLETED' : 'IN_PROGRESS',
          quizStep: input.quizStep,
        },
        where: { userId },
      });
      await Promise.all([
        tx.userStylePreference.deleteMany({ where: { profileId: profile.id } }),
        tx.userColorPreference.deleteMany({ where: { profileId: profile.id } }),
        tx.userFitPreference.deleteMany({ where: { profileId: profile.id } }),
        tx.userSizePreference.deleteMany({ where: { profileId: profile.id } }),
      ]);
      await Promise.all([
        input.styles.length === 0
          ? Promise.resolve()
          : tx.userStylePreference.createMany({
              data: input.styles.map((value) => ({ ...value, profileId: profile.id })),
            }),
        input.colors.length === 0
          ? Promise.resolve()
          : tx.userColorPreference.createMany({
              data: input.colors.map((value) => ({ ...value, profileId: profile.id })),
            }),
        input.fits.length === 0
          ? Promise.resolve()
          : tx.userFitPreference.createMany({
              data: input.fits.map((fitType, index) => ({
                fitType,
                profileId: profile.id,
                rank: index + 1,
              })),
            }),
        input.sizes.length === 0
          ? Promise.resolve()
          : tx.userSizePreference.createMany({
              data: input.sizes.map((value) => ({ ...value, profileId: profile.id })),
            }),
      ]);
      await tx.personalizationAudit.create({
        data: {
          action: complete ? 'QUIZ_COMPLETED' : existing === null ? 'QUIZ_STARTED' : 'QUIZ_SAVED',
          actorId: userId,
          userId,
        },
      });
      return tx.userStyleProfile.findUniqueOrThrow({
        include: profileInclude,
        where: { id: profile.id },
      });
    });
    return this.present(row);
  }

  public async resetProfile(userId: string): Promise<StyleProfile> {
    await this.prisma.$transaction(async (tx) => {
      await tx.userStyleProfile.deleteMany({ where: { userId } });
      await tx.personalizationAudit.create({
        data: { action: 'PROFILE_RESET', actorId: userId, userId },
      });
    });
    return this.get(userId);
  }

  public async resetLearnedSignals(userId: string) {
    const behavioralResetAt = new Date();
    await this.prisma.$transaction([
      this.prisma.userStyleProfile.upsert({
        create: { behavioralResetAt, userId },
        update: { behavioralResetAt, profileVersion: { increment: 1 } },
        where: { userId },
      }),
      this.prisma.personalizationAudit.create({
        data: { action: 'LEARNED_SIGNALS_RESET', actorId: userId, userId },
      }),
    ]);
    return { behavioralResetAt: behavioralResetAt.toISOString() };
  }

  public async privacy(userId: string) {
    const profile = await this.prisma.userStyleProfile.findUnique({ where: { userId } });
    const since = profile?.behavioralResetAt ?? new Date(0);
    const counts = await Promise.all([
      this.prisma.recommendationEvent.count({ where: { occurredAt: { gt: since }, userId } }),
      this.prisma.listingLike.count({ where: { createdAt: { gt: since }, userId } }),
      this.prisma.savedListing.count({ where: { createdAt: { gt: since }, userId } }),
      this.prisma.follow.count({ where: { createdAt: { gt: since }, followerId: userId } }),
      this.prisma.message.count({ where: { createdAt: { gt: since }, senderId: userId } }),
      this.prisma.order.count({ where: { buyerId: userId, createdAt: { gt: since } } }),
    ]);
    return privacyStatusSchema.parse({
      behavioralResetAt: profile?.behavioralResetAt?.toISOString() ?? null,
      hasLearnedSignals: counts.some((count) => count > 0),
      profileCompleted: profile?.quizStatus === 'COMPLETED',
    });
  }

  public async setNotInterested(userId: string, listingId: string, hidden: boolean) {
    await this.assertEligibleListing(listingId);
    const row = await this.prisma.$transaction(async (tx) => {
      const feedback = await tx.recommendationFeedback.upsert({
        create: { hiddenAt: hidden ? new Date() : null, listingId, userId },
        update: { hiddenAt: hidden ? new Date() : null },
        where: { userId_listingId: { listingId, userId } },
      });
      await tx.personalizationAudit.create({
        data: {
          action: hidden ? 'NOT_INTERESTED' : 'NOT_INTERESTED_UNDONE',
          actorId: userId,
          userId,
        },
      });
      if (hidden) {
        await tx.recommendationEvent.create({
          data: {
            algorithmVersion: 'rules-v1',
            listingId,
            source: 'FOR_YOU',
            type: 'NOT_INTERESTED',
            userId,
          },
        });
      }
      return feedback;
    });
    return recommendationFeedbackSchema.parse({
      hidden: row.hiddenAt !== null,
      listingId,
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  public async recordEvent(
    userId: string,
    input: RecommendationEventInput,
  ): Promise<{ accepted: true }> {
    await this.assertEligibleListing(input.listingId);
    await this.prisma.recommendationEvent.create({
      data: { ...input, algorithmVersion: 'rules-v1', userId },
    });
    return { accepted: true };
  }

  public async recordImpressions(
    userId: string,
    items: readonly { id: string; matchScore: number }[],
    algorithmVersion: string,
  ): Promise<void> {
    if (items.length === 0) return;
    await this.prisma.recommendationEvent.createMany({
      data: items.map(({ id, matchScore }) => ({
        algorithmVersion,
        listingId: id,
        matchScore,
        source: 'FOR_YOU' as const,
        type: 'IMPRESSION' as const,
        userId,
      })),
    });
  }

  public async rankForYou(userId: string, asOf: Date) {
    const [profileRow, configuration, blocks] = await Promise.all([
      this.prisma.userStyleProfile.findUnique({ include: profileInclude, where: { userId } }),
      this.prisma.recommendationConfiguration.findFirst({ where: { isActive: true } }),
      this.prisma.userBlock.findMany({
        select: { blockedUserId: true, blockerId: true },
        where: { OR: [{ blockerId: userId }, { blockedUserId: userId }] },
      }),
    ]);
    const config = configuration ?? {
      behaviorWeight: 15,
      candidateLimit: 200,
      engagementWeight: 7,
      explorationWeight: 5,
      explorationPercent: 10,
      freshnessWeight: 12,
      maxPerSeller: 2,
      maxPerStyle: 4,
      personalWeight: 45,
      sellerWeight: 8,
      trustWeight: 8,
      version: 'rules-v1',
    };
    const excludedSellerIds = blocks.map((block) =>
      block.blockerId === userId ? block.blockedUserId : block.blockerId,
    );
    const candidates = await this.prisma.listing.findMany({
      include: {
        _count: { select: { likes: true, saves: true } },
        seller: {
          include: {
            profile: true,
            sellerVerifications: { select: { status: true }, where: { status: 'VERIFIED' } },
          },
        },
        styles: {
          include: { styleDefinition: true },
          orderBy: { styleDefinition: { sortOrder: 'asc' } },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: config.candidateLimit,
      where: {
        recommendationFeedback: { none: { hiddenAt: { not: null }, userId } },
        seller: {
          accountStatus: 'ACTIVE',
          deletedAt: null,
          restrictions: {
            none: {
              OR: [{ expiresAt: null }, { expiresAt: { gt: asOf } }],
              revokedAt: null,
              scope: 'SELLING',
              startsAt: { lte: asOf },
            },
          },
        },
        sellerId: {
          not: userId,
          ...(excludedSellerIds.length === 0 ? {} : { notIn: excludedSellerIds }),
        },
        status: 'ACTIVE',
      },
    });
    const resetAt = profileRow?.behavioralResetAt ?? new Date(0);
    const ninetyDaysAgo = new Date(asOf.getTime() - 90 * 86_400_000);
    const since = resetAt > ninetyDaysAgo ? resetAt : ninetyDaysAgo;
    const [follows, events, likes, saves, purchases, messages] = await Promise.all([
      this.prisma.follow.findMany({
        select: { followedId: true },
        where: { createdAt: { gt: since, lte: asOf }, followerId: userId },
      }),
      this.prisma.recommendationEvent.findMany({
        include: { listing: { include: { styles: true } } },
        where: { occurredAt: { gt: since, lte: asOf }, userId },
      }),
      this.prisma.listingLike.findMany({
        include: { listing: { include: { styles: true } } },
        where: { createdAt: { gt: since, lte: asOf }, userId },
      }),
      this.prisma.savedListing.findMany({
        include: { listing: { include: { styles: true } } },
        where: { createdAt: { gt: since, lte: asOf }, userId },
      }),
      this.prisma.order.findMany({
        include: { listing: { include: { styles: true } } },
        where: {
          buyerId: userId,
          createdAt: { gt: since, lte: asOf },
          status: { in: ['DELIVERED', 'COMPLETED'] },
        },
      }),
      this.prisma.message.findMany({
        include: { conversation: { include: { listing: { include: { styles: true } } } } },
        where: { createdAt: { gt: since, lte: asOf }, senderId: userId },
      }),
    ]);
    const styleAffinity = new Map<string, number>();
    const addAffinity = (
      styles: readonly { styleDefinitionId: string }[],
      weight: number,
      at: Date,
    ) => {
      const ageDays = Math.max(0, (asOf.getTime() - at.getTime()) / 86_400_000);
      const value = weight * Math.max(0.1, 1 - ageDays / 90);
      for (const { styleDefinitionId } of styles)
        styleAffinity.set(styleDefinitionId, (styleAffinity.get(styleDefinitionId) ?? 0) + value);
    };
    const eventWeights = {
      CHECKOUT: 6,
      FOLLOW_SELLER: 4,
      IMPRESSION: 0.1,
      LIKE: 3,
      MESSAGE_SELLER: 5,
      NOT_INTERESTED: -5,
      PURCHASE: 9,
      SAVE: 4,
      VIEW: 1,
    } as const;
    for (const event of events)
      addAffinity(event.listing.styles, eventWeights[event.type], event.occurredAt);
    for (const like of likes) addAffinity(like.listing.styles, 3, like.createdAt);
    for (const save of saves) addAffinity(save.listing.styles, 4, save.createdAt);
    for (const order of purchases) addAffinity(order.listing.styles, 9, order.createdAt);
    for (const message of messages)
      addAffinity(message.conversation.listing.styles, 5, message.createdAt);

    const profile: RecommendationProfile = {
      budgetMaxMinor: profileRow?.budgetMaxMinor ?? null,
      budgetMinMinor: profileRow?.budgetMinMinor ?? null,
      colors: new Map(
        profileRow?.colors.map(({ colorFamily, sentiment }) => [colorFamily, sentiment]) ?? [],
      ),
      fits: new Set(profileRow?.fits.map(({ fitType }) => fitType) ?? []),
      profileVersion: profileRow?.profileVersion ?? 1,
      sizes: new Set(
        profileRow?.sizes.map(
          ({ garmentRole, sizeKey, sizeSystem }) =>
            `${garmentRole}:${sizeSystem}:${sizeKey.toUpperCase()}`,
        ) ?? [],
      ),
      styles: new Map(
        profileRow?.styles.map(({ strength, styleDefinitionId }) => [
          styleDefinitionId,
          strength,
        ]) ?? [],
      ),
    };
    const behavior: BehaviorContext = {
      followedSellerIds: new Set(follows.map(({ followedId }) => followedId)),
      listingAffinity: new Map(),
      styleAffinity,
    };
    const engineCandidates: RecommendationCandidate[] = candidates.map((listing) => ({
      colorFamily: listing.colorFamily,
      createdAt: listing.createdAt,
      fitType: listing.fitType,
      garmentRole: listing.garmentRole,
      id: listing.id,
      likeCount: listing._count.likes,
      priceMinor: listing.priceMinor,
      saveCount: listing._count.saves,
      sellerCompletedSales: listing.seller.profile?.completedSalesCount ?? 0,
      sellerId: listing.sellerId,
      sellerVerified: listing.seller.sellerVerifications.length > 0,
      sizeCompatibilityKey: listing.sizeCompatibilityKey,
      sizeSystem: listing.sizeSystem,
      styleIds: listing.styles.map(({ styleDefinitionId }) => styleDefinitionId),
    }));
    return {
      configurationVersion: config.version,
      profileVersion: profile.profileVersion,
      ranked: rankRecommendations(engineCandidates, profile, behavior, config, asOf),
    };
  }

  public async matchForListing(userId: string, listingId: string) {
    const result = await this.rankForYou(userId, new Date());
    const match = result.ranked.find(({ id }) => id === listingId)?.match;
    return match === undefined || match.contributions.length === 0 ? null : match;
  }

  public async similarListingIds(
    viewerId: string | undefined,
    listingId: string,
    limit: number,
  ): Promise<string[]> {
    const source = await this.prisma.listing.findFirst({
      include: { styles: true },
      where: {
        id: listingId,
        seller: { accountStatus: 'ACTIVE', deletedAt: null },
        status: { in: ['ACTIVE', 'RESERVED', 'SOLD'] },
      },
    });
    if (source === null) throw new NotFoundException({ code: 'LISTING_NOT_AVAILABLE' });
    const blocked =
      viewerId === undefined
        ? []
        : await this.prisma.userBlock.findMany({
            select: { blockedUserId: true, blockerId: true },
            where: { OR: [{ blockerId: viewerId }, { blockedUserId: viewerId }] },
          });
    const excluded =
      viewerId === undefined
        ? []
        : blocked.map((row) => (row.blockerId === viewerId ? row.blockedUserId : row.blockerId));
    const styleIds = source.styles.map(({ styleDefinitionId }) => styleDefinitionId);
    const candidates = await this.prisma.listing.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
      take: limit,
      where: {
        id: { not: listingId },
        OR: [
          ...(styleIds.length === 0
            ? []
            : [{ styles: { some: { styleDefinitionId: { in: styleIds } } } }]),
          { categoryId: source.categoryId },
          ...(source.garmentRole === null ? [] : [{ garmentRole: source.garmentRole }]),
        ],
        seller: { accountStatus: 'ACTIVE', deletedAt: null },
        ...(excluded.length === 0 ? {} : { sellerId: { notIn: excluded } }),
        status: 'ACTIVE',
      },
    });
    return candidates.map(({ id }) => id);
  }

  public async adminSummary(): Promise<PersonalizationAdminSummary> {
    const [profiles, completed, events, hidden, styles, impressions, audits] = await Promise.all([
      this.prisma.userStyleProfile.count(),
      this.prisma.userStyleProfile.count({ where: { quizStatus: 'COMPLETED' } }),
      this.prisma.recommendationEvent.groupBy({ by: ['type'], _count: { _all: true } }),
      this.prisma.recommendationFeedback.count({ where: { hiddenAt: { not: null } } }),
      this.prisma.userStylePreference.groupBy({
        by: ['styleDefinitionId'],
        _count: { _all: true },
      }),
      this.prisma.recommendationEvent.aggregate({
        _avg: { matchScore: true },
        _count: { matchScore: true },
        where: { type: 'IMPRESSION' },
      }),
      this.prisma.personalizationAudit.groupBy({ by: ['action'], _count: { _all: true } }),
    ]);
    return {
      completedProfiles: completed,
      events,
      hiddenRecommendations: hidden,
      impressionMatchAverage: impressions._avg.matchScore,
      impressionMatchCount: impressions._count.matchScore,
      profiles,
      styleSelectionCounts: styles,
      audits,
    };
  }

  public async configuration() {
    return this.prisma.recommendationConfiguration.findMany({ orderBy: { createdAt: 'desc' } });
  }

  public async activateConfiguration(actorId: string, input: RecommendationConfigurationInput) {
    return this.prisma.$transaction(async (tx) => {
      await tx.recommendationConfiguration.updateMany({
        data: { isActive: false },
        where: { isActive: true },
      });
      const configuration = await tx.recommendationConfiguration.create({
        data: { ...input, isActive: true },
      });
      await tx.personalizationAudit.create({
        data: {
          action: 'CONFIG_ACTIVATED',
          actorId,
          metadata: { version: input.version },
        },
      });
      return configuration;
    });
  }

  public async updateDefinition(
    actorId: string,
    id: string,
    input: {
      displayName?: string | undefined;
      description?: string | null | undefined;
      isActive?: boolean | undefined;
      sortOrder?: number | undefined;
    },
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const data = {
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        };
        const style = await tx.styleDefinition.update({ data, where: { id } });
        await tx.personalizationAudit.create({
          data: { action: 'TAXONOMY_UPDATED', actorId, metadata: { styleDefinitionId: id } },
        });
        return this.presentDefinition(style);
      });
    } catch {
      throw new NotFoundException({ code: 'STYLE_DEFINITION_NOT_FOUND' });
    }
  }

  private async assertActiveStyles(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    const count = await this.prisma.styleDefinition.count({
      where: { id: { in: [...ids] }, isActive: true },
    });
    if (count !== ids.length) throw new BadRequestException({ code: 'STYLE_DEFINITION_INVALID' });
  }

  private presentDefinition(style: {
    description: string | null;
    displayName: string;
    id: string;
    isActive: boolean;
    slug: string;
    sortOrder: number;
  }): StyleDefinition {
    return styleDefinitionSchema.parse({
      description: style.description,
      displayName: style.displayName,
      id: style.id,
      isActive: style.isActive,
      slug: style.slug,
      sortOrder: style.sortOrder,
    });
  }

  private async assertEligibleListing(listingId: string): Promise<void> {
    const listing = await this.prisma.listing.findFirst({
      select: { id: true },
      where: {
        id: listingId,
        seller: { accountStatus: 'ACTIVE', deletedAt: null },
        status: 'ACTIVE',
      },
    });
    if (listing === null) throw new NotFoundException({ code: 'LISTING_NOT_AVAILABLE' });
  }

  private present(
    row: Awaited<ReturnType<PersonalizationService['loadForPresent']>>,
  ): StyleProfile {
    const presentStyle = (style: (typeof row.styles)[number]['styleDefinition']) => ({
      description: style.description,
      displayName: style.displayName,
      id: style.id,
      isActive: style.isActive,
      slug: style.slug,
      sortOrder: style.sortOrder,
    });
    return styleProfileSchema.parse({
      behavioralResetAt: row.behavioralResetAt?.toISOString() ?? null,
      budgetMaxMinor: row.budgetMaxMinor,
      budgetMinMinor: row.budgetMinMinor,
      colors: row.colors.map(({ colorFamily, sentiment }) => ({ colorFamily, sentiment })),
      completedAt: row.completedAt?.toISOString() ?? null,
      currency: row.currency,
      expressions: row.expressions,
      fits: row.fits.map(({ fitType }) => fitType),
      id: row.id,
      lifestyles: row.lifestyles,
      priorities: row.priorities,
      profileVersion: row.profileVersion,
      quizStatus: row.quizStatus,
      quizStep: row.quizStep,
      result: {
        preferredFits: row.fits.map(({ fitType }) => fitType),
        primaryStyle:
          row.styles[0] === undefined ? null : presentStyle(row.styles[0].styleDefinition),
        recommendedColors: row.colors
          .filter(({ sentiment }) => sentiment === 'PREFER')
          .map(({ colorFamily }) => colorFamily),
        recommendedGarmentRoles: [...new Set(row.sizes.map(({ garmentRole }) => garmentRole))],
        secondaryStyle:
          row.styles[1] === undefined ? null : presentStyle(row.styles[1].styleDefinition),
      },
      sizes: row.sizes.map(({ garmentRole, sizeKey, sizeSystem }) => ({
        garmentRole,
        sizeKey,
        sizeSystem,
      })),
      styles: row.styles.map(({ styleDefinition, styleDefinitionId, strength }) => ({
        style: presentStyle(styleDefinition),
        styleDefinitionId,
        strength,
      })),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  private loadForPresent() {
    return this.prisma.userStyleProfile.findFirstOrThrow({ include: profileInclude });
  }
}
