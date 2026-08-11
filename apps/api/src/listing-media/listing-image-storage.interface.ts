export interface ListingImageStorage {
  createSignedUrls(keys: readonly string[]): Promise<ReadonlyMap<string, string>>;
  remove(keys: readonly string[]): Promise<void>;
  upload(key: string, body: Buffer): Promise<void>;
}

export const LISTING_IMAGE_STORAGE = Symbol('LISTING_IMAGE_STORAGE');
