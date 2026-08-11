import { Inject, Injectable } from '@nestjs/common';
import { listingDetailSchema, type ListingDetail } from '@thriftage/shared';

import {
  LISTING_IMAGE_STORAGE,
  type ListingImageStorage,
} from '../listing-media/listing-image-storage.interface';
import type { ListingRecord, ViewerListingState } from './listing.repository';

@Injectable()
export class ListingPresenter {
  public constructor(
    @Inject(LISTING_IMAGE_STORAGE) private readonly storage: ListingImageStorage,
  ) {}

  public async presentMany(
    records: readonly ListingRecord[],
    viewerState: ViewerListingState,
  ): Promise<ListingDetail[]> {
    const keys = records.flatMap(({ images }) => images.map(({ storageKey }) => storageKey));
    const urls = await this.storage.createSignedUrls(keys);
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
        likedByViewer: viewerState.likedIds.has(record.id),
        moderatedAt: record.moderatedAt?.toISOString() ?? null,
        priceMinor: record.priceMinor,
        rejectionReason: record.rejectionReason,
        saveCount: record._count.saves,
        savedByViewer: viewerState.savedIds.has(record.id),
        seller: {
          id: record.seller.id,
          profileImageUrl: record.seller.profile?.profileImageUrl ?? null,
          username: record.seller.profile?.username ?? 'unavailable',
        },
        size: record.size,
        status: record.status,
        submittedAt: record.submittedAt?.toISOString() ?? null,
        title: record.title,
        updatedAt: record.updatedAt.toISOString(),
      }),
    );
  }
}
