import { Inject, Injectable } from '@nestjs/common';
import { listingDetailSchema, type ListingDetail, type ListingMatch } from '@thriftage/shared';

import {
  LISTING_IMAGE_STORAGE,
  type ListingImageStorage,
} from '../listing-media/listing-image-storage.interface';
import type { ListingRecord, ViewerListingState } from './listing.repository';
import { ReputationReader } from '../trust/reputation.reader';

@Injectable()
export class ListingPresenter {
  public constructor(
    @Inject(LISTING_IMAGE_STORAGE) private readonly storage: ListingImageStorage,
    @Inject(ReputationReader) private readonly reputation: ReputationReader,
  ) {}

  public async presentMany(
    records: readonly ListingRecord[],
    viewerState: ViewerListingState | Promise<ViewerListingState>,
    matches: ReadonlyMap<string, ListingMatch> = new Map(),
  ): Promise<ListingDetail[]> {
    const keys = records.flatMap(({ images }) => images.map(({ storageKey }) => storageKey));
    const sellerIds = records.map((record) => record.sellerId);
    const [resolvedViewerState, urls, ratings, verified] = await Promise.all([
      viewerState,
      this.storage.createSignedUrls(keys),
      this.reputation.summaries(sellerIds, 'BUYER_TO_SELLER'),
      this.reputation.verified(sellerIds),
    ]);
    return records.map((record) =>
      listingDetailSchema.parse({
        activatedAt: record.activatedAt?.toISOString() ?? null,
        archivedAt: record.archivedAt?.toISOString() ?? null,
        brand: record.brand,
        category: {
          description: record.category.description,
          id: record.category.id,
          isActive: record.category.isActive,
          name: record.category.name,
          parentId: record.category.parentId,
          slug: record.category.slug,
          sortOrder: record.category.sortOrder,
        },
        color: record.color,
        condition: record.condition,
        createdAt: record.createdAt.toISOString(),
        currency: record.currency,
        description: record.description,
        id: record.id,
        images: record.images.map((image) => ({
          height: image.height,
          id: image.id,
          position: image.position,
          url: urls.get(image.storageKey),
          width: image.width,
        })),
        likeCount: record._count.likes,
        likedByViewer: resolvedViewerState.likedIds.has(record.id),
        moderatedAt: record.moderatedAt?.toISOString() ?? null,
        priceMinor: record.priceMinor,
        stockAvailable: record.stockAvailable,
        stockReserved: record.stockReserved,
        stockSold: record.stockSold,
        stockQuantity: record.stockAvailable + record.stockReserved + record.stockSold,
        rejectionReason: record.rejectionReason,
        saveCount: record._count.saves,
        savedByViewer: resolvedViewerState.savedIds.has(record.id),
        seller: {
          id: record.seller.id,
          profileImageUrl: record.seller.profile?.profileImageUrl ?? null,
          username: record.seller.profile?.username ?? 'unavailable',
          sellerRating: ratings.get(record.sellerId),
          sellerVerified: verified.has(record.sellerId),
        },
        size: record.size,
        status: record.status,
        submittedAt: record.submittedAt?.toISOString() ?? null,
        title: record.title,
        updatedAt: record.updatedAt.toISOString(),
        personalization:
          record.colorFamily === null ||
          record.fitType === null ||
          record.garmentRole === null ||
          record.sizeCompatibilityKey === null ||
          record.sizeSystem === null ||
          record.styles.length === 0
            ? null
            : {
                colorFamily: record.colorFamily,
                fitType: record.fitType,
                garmentRole: record.garmentRole,
                sizeCompatibilityKey: record.sizeCompatibilityKey,
                sizeSystem: record.sizeSystem,
                styles: record.styles.map(({ styleDefinition }) => ({
                  description: styleDefinition.description,
                  displayName: styleDefinition.displayName,
                  id: styleDefinition.id,
                  isActive: styleDefinition.isActive,
                  slug: styleDefinition.slug,
                  sortOrder: styleDefinition.sortOrder,
                })),
              },
        match: matches.get(record.id) ?? null,
      }),
    );
  }
}
