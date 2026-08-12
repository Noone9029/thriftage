import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { getPrismaClient, Prisma, type PrismaClient } from '@thriftage/db';
import type {
  ListingDraftInput,
  ListingSearchQuery,
  ListingStatus,
  ListingUpdateInput,
  SellerListingQuery,
} from '@thriftage/shared';

import { MarketplaceDomainError } from '../common/marketplace.errors';

export const listingArgs = {
  include: {
    _count: {
      select: {
        likes: true,
        reports: { where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } },
        saves: true,
      },
    },
    category: true,
    images: { orderBy: { position: 'asc' as const } },
    seller: { include: { profile: true } },
  },
} as const satisfies Prisma.ListingDefaultArgs;

export type ListingRecord = Prisma.ListingGetPayload<typeof listingArgs>;

export interface ChronologicalCursor {
  readonly createdAt: Date;
  readonly id: string;
}

export interface SearchCursor extends ChronologicalCursor {
  readonly priceMinor?: number;
}

export interface ViewerListingState {
  readonly likedIds: ReadonlySet<string>;
  readonly savedIds: ReadonlySet<string>;
}

const editableStatuses: readonly ListingStatus[] = ['DRAFT', 'REJECTED'];
const mediaMutationTails = new Map<string, Promise<void>>();

async function serializeMediaMutation<T>(
  listingId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = mediaMutationTails.get(listingId) ?? Promise.resolve();
  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  mediaMutationTails.set(listingId, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (mediaMutationTails.get(listingId) === tail) mediaMutationTails.delete(listingId);
  }
}

@Injectable()
export class ListingRepository {
  public constructor(private readonly prisma?: PrismaClient) {}

  private get client(): PrismaClient {
    return this.prisma ?? getPrismaClient();
  }

  public async createDraft(userId: string, input: ListingDraftInput): Promise<ListingRecord> {
    const category = await this.client.category.findFirst({
      where: { id: input.categoryId, isActive: true },
    });
    if (category === null) throw new MarketplaceDomainError('CATEGORY_UNAVAILABLE');
    return this.client.listing.create({
      ...listingArgs,
      data: {
        ...(input.brand === undefined ? {} : { brand: input.brand }),
        categoryId: input.categoryId,
        ...(input.color === undefined ? {} : { color: input.color }),
        condition: input.condition,
        currency: input.currency,
        description: input.description,
        priceMinor: input.priceMinor,
        sellerId: userId,
        size: input.size,
        title: input.title,
      },
    });
  }

  public async updateDraft(
    userId: string,
    listingId: string,
    input: ListingUpdateInput,
  ): Promise<ListingRecord> {
    return this.client.$transaction(async (transaction) => {
      const listing = await this.lockOwned(transaction, userId, listingId);
      if (!editableStatuses.includes(listing.status)) {
        throw new MarketplaceDomainError('LISTING_NOT_EDITABLE');
      }
      if (input.categoryId !== undefined) {
        const category = await transaction.category.findFirst({
          where: { id: input.categoryId, isActive: true },
        });
        if (category === null) throw new MarketplaceDomainError('CATEGORY_UNAVAILABLE');
      }
      return transaction.listing.update({
        ...listingArgs,
        data: {
          ...(input.brand === undefined ? {} : { brand: input.brand }),
          ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
          ...(input.color === undefined ? {} : { color: input.color }),
          ...(input.condition === undefined ? {} : { condition: input.condition }),
          ...(input.currency === undefined ? {} : { currency: input.currency }),
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.priceMinor === undefined ? {} : { priceMinor: input.priceMinor }),
          ...(input.size === undefined ? {} : { size: input.size }),
          ...(input.title === undefined ? {} : { title: input.title }),
        },
        where: { id: listingId },
      });
    });
  }

  public async deleteDraft(userId: string, listingId: string): Promise<readonly string[]> {
    return this.client.$transaction(async (transaction) => {
      const listing = await this.lockOwned(transaction, userId, listingId);
      if (listing.status !== 'DRAFT') {
        throw new MarketplaceDomainError('LISTING_TRANSITION_INVALID');
      }
      const images = await transaction.listingImage.findMany({ where: { listingId } });
      await transaction.listing.delete({ where: { id: listingId } });
      return images.map(({ storageKey }) => storageKey);
    });
  }

  public async submit(userId: string, listingId: string): Promise<ListingRecord> {
    return this.client.$transaction(async (transaction) => {
      const listing = await this.lockOwned(transaction, userId, listingId);
      if (!editableStatuses.includes(listing.status)) {
        throw new MarketplaceDomainError('LISTING_TRANSITION_INVALID');
      }
      const [imageCount, category] = await Promise.all([
        transaction.listingImage.count({ where: { listingId } }),
        transaction.category.findFirst({ where: { id: listing.categoryId, isActive: true } }),
      ]);
      if (imageCount < 3 || imageCount > 10) {
        throw new MarketplaceDomainError('LISTING_REQUIRES_IMAGES');
      }
      if (category === null) throw new MarketplaceDomainError('CATEGORY_UNAVAILABLE');
      return transaction.listing.update({
        data: { rejectionReason: null, status: 'PENDING_REVIEW', submittedAt: new Date() },
        ...listingArgs,
        where: { id: listingId },
      });
    });
  }

  public async archive(userId: string, listingId: string): Promise<ListingRecord> {
    return this.client.$transaction(async (transaction) => {
      const listing = await this.lockOwned(transaction, userId, listingId);
      if (!['DRAFT', 'REJECTED', 'ACTIVE', 'PENDING_REVIEW'].includes(listing.status)) {
        throw new MarketplaceDomainError('LISTING_TRANSITION_INVALID');
      }
      return transaction.listing.update({
        data: { archivedAt: new Date(), rejectionReason: null, status: 'ARCHIVED' },
        ...listingArgs,
        where: { id: listingId },
      });
    });
  }

  public findOwned(userId: string, listingId: string): Promise<ListingRecord | null> {
    return this.client.listing.findFirst({
      ...listingArgs,
      where: { id: listingId, sellerId: userId },
    });
  }

  public findPublic(listingId: string): Promise<ListingRecord | null> {
    return this.client.listing.findFirst({
      ...listingArgs,
      where: {
        id: listingId,
        status: { in: ['ACTIVE', 'RESERVED', 'SOLD'] },
        seller: { accountStatus: 'ACTIVE', deletedAt: null },
      },
    });
  }

  public async search(
    query: ListingSearchQuery,
    cursor: SearchCursor | null,
    excludedSellerIds: readonly string[] = [],
  ): Promise<{ readonly hasMore: boolean; readonly records: readonly ListingRecord[] }> {
    const categoryIds =
      query.categoryId === undefined ? undefined : await this.findDescendantIds(query.categoryId);
    const textFilter: Prisma.ListingWhereInput =
      query.q === undefined || query.q === ''
        ? {}
        : {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
              { brand: { contains: query.q, mode: 'insensitive' } },
              { category: { name: { contains: query.q, mode: 'insensitive' } } },
            ],
          };
    const cursorFilter = this.searchCursorWhere(query.sort, cursor);
    const where: Prisma.ListingWhereInput = {
      ...(categoryIds === undefined ? {} : { categoryId: { in: [...categoryIds] } }),
      ...(query.condition === undefined ? {} : { condition: query.condition }),
      ...(query.currency === undefined ? {} : { currency: query.currency }),
      ...(query.minPriceMinor === undefined && query.maxPriceMinor === undefined
        ? {}
        : {
            priceMinor: {
              ...(query.minPriceMinor === undefined ? {} : { gte: query.minPriceMinor }),
              ...(query.maxPriceMinor === undefined ? {} : { lte: query.maxPriceMinor }),
            },
          }),
      ...(query.size === undefined
        ? {}
        : { size: { equals: query.size, mode: 'insensitive' as const } }),
      status: 'ACTIVE',
      ...(excludedSellerIds.length === 0 ? {} : { sellerId: { notIn: [...excludedSellerIds] } }),
      seller: { accountStatus: 'ACTIVE', deletedAt: null },
      AND: [textFilter, cursorFilter],
    };
    const rows = await this.client.listing.findMany({
      ...listingArgs,
      orderBy: this.searchOrderBy(query.sort),
      take: query.limit + 1,
      where,
    });
    return { hasMore: rows.length > query.limit, records: rows.slice(0, query.limit) };
  }

  public async listOwned(
    userId: string,
    query: SellerListingQuery,
    cursor: ChronologicalCursor | null,
  ): Promise<{ readonly hasMore: boolean; readonly records: readonly ListingRecord[] }> {
    return this.listBySeller(userId, query.limit, cursor, query.status);
  }

  public async listPublicBySeller(
    sellerId: string,
    limit: number,
    cursor: ChronologicalCursor | null,
  ): Promise<{ readonly hasMore: boolean; readonly records: readonly ListingRecord[] }> {
    return this.listBySeller(sellerId, limit, cursor, 'ACTIVE');
  }

  public async findByIds(ids: readonly string[]): Promise<readonly ListingRecord[]> {
    if (ids.length === 0) return [];
    const records = await this.client.listing.findMany({
      ...listingArgs,
      where: { id: { in: [...ids] } },
    });
    const byId = new Map(records.map((record) => [record.id, record]));
    return ids.flatMap((id) => {
      const record = byId.get(id);
      return record === undefined ? [] : [record];
    });
  }

  public async getViewerState(
    userId: string | undefined,
    listingIds: readonly string[],
  ): Promise<ViewerListingState> {
    if (userId === undefined || listingIds.length === 0) {
      return { likedIds: new Set(), savedIds: new Set() };
    }
    const [likes, saves] = await Promise.all([
      this.client.listingLike.findMany({
        select: { listingId: true },
        where: { listingId: { in: [...listingIds] }, userId },
      }),
      this.client.savedListing.findMany({
        select: { listingId: true },
        where: { listingId: { in: [...listingIds] }, userId },
      }),
    ]);
    return {
      likedIds: new Set(likes.map(({ listingId }) => listingId)),
      savedIds: new Set(saves.map(({ listingId }) => listingId)),
    };
  }

  public async addImage(
    userId: string,
    listingId: string,
    image: { readonly height: number; readonly storageKey: string; readonly width: number },
  ): Promise<ListingRecord> {
    return serializeMediaMutation(listingId, () =>
      this.addImageSerialized(userId, listingId, image),
    );
  }

  private async addImageSerialized(
    userId: string,
    listingId: string,
    image: { readonly height: number; readonly storageKey: string; readonly width: number },
  ): Promise<ListingRecord> {
    const inserted = await this.client.$queryRaw<readonly { id: string }[]>(Prisma.sql`
      WITH target AS MATERIALIZED (
        SELECT l."id"
        FROM "listings" l
        WHERE l."id" = ${listingId}::uuid
          AND l."seller_id" = ${userId}::uuid
          AND l."status" IN ('DRAFT'::"ListingStatus", 'REJECTED'::"ListingStatus")
        FOR UPDATE
      ), next_position AS (
        SELECT target."id", COUNT(images."id")::int AS "position"
        FROM target
        LEFT JOIN "listing_images" images ON images."listing_id" = target."id"
        GROUP BY target."id"
      )
      INSERT INTO "listing_images" ("id", "listing_id", "storage_key", "width", "height", "position")
      SELECT ${randomUUID()}::uuid, next_position."id", ${image.storageKey}, ${image.width}, ${image.height}, next_position."position"
      FROM next_position
      WHERE next_position."position" < 10
      RETURNING "id"
    `);
    if (inserted.length === 0) {
      const listing = await this.client.listing.findUnique({
        where: { id: listingId },
        select: { sellerId: true, status: true, _count: { select: { images: true } } },
      });
      if (!listing) throw new MarketplaceDomainError('LISTING_NOT_FOUND');
      if (listing.sellerId !== userId) throw new MarketplaceDomainError('LISTING_FORBIDDEN');
      if (!editableStatuses.includes(listing.status))
        throw new MarketplaceDomainError('LISTING_NOT_EDITABLE');
      if (listing._count.images >= 10) throw new MarketplaceDomainError('IMAGE_LIMIT_REACHED');
      throw new MarketplaceDomainError('MARKETPLACE_SERVICE_ERROR');
    }
    return this.client.listing.findUniqueOrThrow({ ...listingArgs, where: { id: listingId } });
  }

  public async removeImage(
    userId: string,
    listingId: string,
    imageId: string,
  ): Promise<{ readonly record: ListingRecord; readonly storageKey: string }> {
    return this.client.$transaction(async (transaction) => {
      const listing = await this.lockOwned(transaction, userId, listingId);
      if (!editableStatuses.includes(listing.status)) {
        throw new MarketplaceDomainError('LISTING_NOT_EDITABLE');
      }
      const image = await transaction.listingImage.findFirst({ where: { id: imageId, listingId } });
      if (image === null) throw new MarketplaceDomainError('IMAGE_NOT_FOUND');
      await transaction.listingImage.delete({ where: { id: imageId } });
      const following = await transaction.listingImage.findMany({
        orderBy: { position: 'asc' },
        where: { listingId, position: { gt: image.position } },
      });
      for (const item of following) {
        await transaction.listingImage.update({
          data: { position: item.position - 1 },
          where: { id: item.id },
        });
      }
      const record = await transaction.listing.findUniqueOrThrow({
        ...listingArgs,
        where: { id: listingId },
      });
      return { record, storageKey: image.storageKey };
    });
  }

  public async reorderImages(
    userId: string,
    listingId: string,
    imageIds: readonly string[],
  ): Promise<ListingRecord> {
    return this.client.$transaction(async (transaction) => {
      const listing = await this.lockOwned(transaction, userId, listingId);
      if (!editableStatuses.includes(listing.status)) {
        throw new MarketplaceDomainError('LISTING_NOT_EDITABLE');
      }
      const existing = await transaction.listingImage.findMany({ where: { listingId } });
      if (
        existing.length !== imageIds.length ||
        new Set(imageIds).size !== imageIds.length ||
        imageIds.some((id) => !existing.some((image) => image.id === id))
      ) {
        throw new MarketplaceDomainError('VALIDATION_FAILED');
      }
      await transaction.$executeRaw(
        Prisma.sql`UPDATE "listing_images"
          SET "position" = array_position(
            ARRAY[${Prisma.join(imageIds.map((id) => Prisma.sql`${id}::uuid`))}]::uuid[],
            "id"
          ) - 1
          WHERE "listing_id" = ${listingId}::uuid`,
      );
      return transaction.listing.findUniqueOrThrow({ ...listingArgs, where: { id: listingId } });
    });
  }

  private async lockOwned(
    transaction: Prisma.TransactionClient,
    userId: string,
    listingId: string,
  ): Promise<{
    readonly categoryId: string;
    readonly sellerId: string;
    readonly status: ListingStatus;
  }> {
    const rows = await transaction.$queryRaw<
      { categoryId: string; sellerId: string; status: ListingStatus }[]
    >`SELECT "category_id" AS "categoryId", "seller_id" AS "sellerId", "status"::text AS "status" FROM "listings" WHERE "id" = ${listingId}::uuid FOR UPDATE`;
    const listing = rows[0];
    if (listing === undefined) throw new MarketplaceDomainError('LISTING_NOT_FOUND');
    if (listing.sellerId !== userId) throw new MarketplaceDomainError('LISTING_FORBIDDEN');
    return listing;
  }

  private async findDescendantIds(categoryId: string): Promise<readonly string[]> {
    const categories = await this.client.category.findMany({
      select: { id: true, parentId: true },
    });
    if (!categories.some(({ id }) => id === categoryId)) {
      throw new MarketplaceDomainError('CATEGORY_NOT_FOUND');
    }
    const ids = new Set([categoryId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const category of categories) {
        if (category.parentId !== null && ids.has(category.parentId) && !ids.has(category.id)) {
          ids.add(category.id);
          changed = true;
        }
      }
    }
    return [...ids];
  }

  private searchOrderBy(
    sort: ListingSearchQuery['sort'],
  ): Prisma.ListingOrderByWithRelationInput[] {
    switch (sort) {
      case 'OLDEST':
        return [{ createdAt: 'asc' }, { id: 'asc' }];
      case 'PRICE_LOW':
        return [{ priceMinor: 'asc' }, { id: 'asc' }];
      case 'PRICE_HIGH':
        return [{ priceMinor: 'desc' }, { id: 'desc' }];
      case 'NEWEST':
        return [{ createdAt: 'desc' }, { id: 'desc' }];
    }
  }

  private searchCursorWhere(
    sort: ListingSearchQuery['sort'],
    cursor: SearchCursor | null,
  ): Prisma.ListingWhereInput {
    if (cursor === null) return {};
    if (sort === 'PRICE_LOW' || sort === 'PRICE_HIGH') {
      if (cursor.priceMinor === undefined) throw new MarketplaceDomainError('VALIDATION_FAILED');
      const direction = sort === 'PRICE_LOW' ? 'gt' : 'lt';
      return {
        OR: [
          { priceMinor: { [direction]: cursor.priceMinor } },
          { id: { [direction]: cursor.id }, priceMinor: cursor.priceMinor },
        ],
      };
    }
    const direction = sort === 'OLDEST' ? 'gt' : 'lt';
    return {
      OR: [
        { createdAt: { [direction]: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { [direction]: cursor.id } },
      ],
    };
  }

  private async listBySeller(
    sellerId: string,
    limit: number,
    cursor: ChronologicalCursor | null,
    status: ListingStatus | undefined,
  ): Promise<{ readonly hasMore: boolean; readonly records: readonly ListingRecord[] }> {
    const rows = await this.client.listing.findMany({
      ...listingArgs,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      where: {
        sellerId,
        ...(status === undefined ? {} : { status }),
        ...(cursor === null
          ? {}
          : {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }),
      },
    });
    return { hasMore: rows.length > limit, records: rows.slice(0, limit) };
  }
}
