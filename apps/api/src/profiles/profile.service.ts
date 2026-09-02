import {
  profileCreateInputSchema,
  profileUpdateInputSchema,
  serializePrivateUserProfile,
  serializePublicUserProfile,
  usernameSchema,
  type PrivateUserProfile,
  type ProfileCreateInput,
  type ProfileUpdateInput,
  type PublicUserProfile,
  type UsernameAvailability,
} from '@thriftage/shared';

import { mapProfileError, ProfileApiException, ProfileDomainError } from './profile.errors';
import type { ProfileRepositoryContract } from './profile.repository';
import type { MarketplaceEventPublisher } from '../common/marketplace-event-publisher';

export class ProfileService {
  public constructor(
    private readonly repository: ProfileRepositoryContract,
    private readonly events?: MarketplaceEventPublisher,
  ) {}

  public async getMine(userId: string): Promise<PrivateUserProfile> {
    try {
      const profile = await this.repository.findByUserId(userId);
      if (profile === null) throw new ProfileDomainError('PROFILE_NOT_FOUND');
      return serializePrivateUserProfile(profile);
    } catch (error: unknown) {
      if (error instanceof ProfileApiException) throw error;
      throw mapProfileError(error);
    }
  }

  public async getPublic(usernameInput: string): Promise<PublicUserProfile> {
    try {
      const username = usernameSchema.parse(usernameInput);
      const profile = await this.repository.findActiveByUsername(username);
      if (profile === null) throw new ProfileDomainError('PROFILE_NOT_FOUND');
      return serializePublicUserProfile(profile);
    } catch (error: unknown) {
      throw mapProfileError(error);
    }
  }

  public async availability(usernameInput: string, userId: string): Promise<UsernameAvailability> {
    const username = usernameSchema.parse(usernameInput);
    return { available: await this.repository.isUsernameAvailable(username, userId), username };
  }

  public async create(userId: string, input: ProfileCreateInput): Promise<PrivateUserProfile> {
    try {
      const profile = serializePrivateUserProfile(
        await this.repository.create(userId, profileCreateInputSchema.parse(input)),
      );
      this.events?.publish({ actorId: userId, name: 'profile_completed' });
      return profile;
    } catch (error: unknown) {
      throw mapProfileError(error);
    }
  }

  public async update(userId: string, input: ProfileUpdateInput): Promise<PrivateUserProfile> {
    try {
      return serializePrivateUserProfile(
        await this.repository.update(userId, profileUpdateInputSchema.parse(input)),
      );
    } catch (error: unknown) {
      throw mapProfileError(error);
    }
  }
}
