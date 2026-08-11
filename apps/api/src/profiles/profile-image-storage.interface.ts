export const PROFILE_IMAGE_STORAGE = Symbol('PROFILE_IMAGE_STORAGE');

export interface ProfileImageStorage {
  getPublicUrl(key: string): string;
  remove(key: string): Promise<void>;
  upload(key: string, body: Buffer): Promise<void>;
}
