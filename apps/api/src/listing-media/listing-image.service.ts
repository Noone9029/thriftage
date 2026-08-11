import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { imageOrderInputSchema, type ListingDetail } from '@thriftage/shared';

import { mapMarketplaceError, MarketplaceDomainError } from '../common/marketplace.errors';
import { ListingPresenter } from '../listings/listing.presenter';
import { ListingRepository } from '../listings/listing.repository';
import { ListingImageProcessor, type UploadedListingImage } from './listing-image-processor';
import { LISTING_IMAGE_STORAGE, type ListingImageStorage } from './listing-image-storage.interface';

@Injectable()
export class ListingImageService {
  public constructor(
    @Inject(ListingRepository) private readonly repository: ListingRepository,
    @Inject(ListingPresenter) private readonly presenter: ListingPresenter,
    @Inject(ListingImageProcessor) private readonly processor: ListingImageProcessor,
    @Inject(LISTING_IMAGE_STORAGE) private readonly storage: ListingImageStorage,
  ) {}

  public async upload(
    userId: string,
    listingId: string,
    file: UploadedListingImage | undefined,
  ): Promise<ListingDetail> {
    let key: string | undefined;
    try {
      const owned = await this.repository.findOwned(userId, listingId);
      if (owned === null) {
        throw new MarketplaceDomainError('LISTING_NOT_FOUND');
      }
      const processed = await this.processor.process(file);
      key = `listings/${userId}/${listingId}/${randomUUID()}.webp`;
      await this.storage.upload(key, processed.body);
      const record = await this.repository.addImage(userId, listingId, {
        height: processed.height,
        storageKey: key,
        width: processed.width,
      });
      const state = await this.repository.getViewerState(userId, [listingId]);
      const [result] = await this.presenter.presentMany([record], state);
      if (result === undefined) throw new Error('Listing presentation failed.');
      return result;
    } catch (error: unknown) {
      if (key !== undefined) {
        try {
          await this.storage.remove([key]);
        } catch {
          // The original domain error remains authoritative; orphan cleanup is observable in storage.
        }
      }
      throw mapMarketplaceError(error);
    }
  }

  public async remove(userId: string, listingId: string, imageId: string): Promise<ListingDetail> {
    try {
      const { record, storageKey } = await this.repository.removeImage(userId, listingId, imageId);
      try {
        await this.storage.remove([storageKey]);
      } catch {
        // The database is authoritative; a private orphan is safer than restoring a deleted image.
      }
      const state = await this.repository.getViewerState(userId, [listingId]);
      const [result] = await this.presenter.presentMany([record], state);
      if (result === undefined) throw new Error('Listing presentation failed.');
      return result;
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }

  public async reorder(userId: string, listingId: string, input: unknown): Promise<ListingDetail> {
    try {
      const { imageIds } = imageOrderInputSchema.parse(input);
      const record = await this.repository.reorderImages(userId, listingId, imageIds);
      const state = await this.repository.getViewerState(userId, [listingId]);
      const [result] = await this.presenter.presentMany([record], state);
      if (result === undefined) throw new Error('Listing presentation failed.');
      return result;
    } catch (error: unknown) {
      throw mapMarketplaceError(error);
    }
  }
}
