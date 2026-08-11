import { getPrismaClient, type Prisma, type PrismaClient } from '@thriftage/db';
import type { ProfileCreateInput, ProfileUpdateInput } from '@thriftage/shared';

import { ProfileDomainError } from './profile.errors';

export type ProfileWithUser = Prisma.ProfileGetPayload<{ include: { user: true } }>;

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export interface ProfileRepositoryContract {
  clearImage(
    userId: string,
  ): Promise<{ readonly previousKey: string | null; readonly profile: ProfileWithUser }>;
  create(userId: string, input: ProfileCreateInput): Promise<ProfileWithUser>;
  findActiveByUsername(username: string): Promise<ProfileWithUser | null>;
  findByUserId(userId: string): Promise<ProfileWithUser | null>;
  isUsernameAvailable(username: string, excludingUserId?: string): Promise<boolean>;
  setImage(
    userId: string,
    key: string,
    url: string,
  ): Promise<{ readonly previousKey: string | null; readonly profile: ProfileWithUser }>;
  update(userId: string, input: ProfileUpdateInput): Promise<ProfileWithUser>;
}

export class ProfileRepository implements ProfileRepositoryContract {
  public constructor(private readonly prisma?: PrismaClient) {}

  private get client(): PrismaClient {
    return this.prisma ?? getPrismaClient();
  }

  public findByUserId(userId: string): Promise<ProfileWithUser | null> {
    return this.client.profile.findUnique({ include: { user: true }, where: { userId } });
  }

  public findActiveByUsername(username: string): Promise<ProfileWithUser | null> {
    return this.client.profile.findFirst({
      include: { user: true },
      where: {
        username,
        user: { accountStatus: 'ACTIVE', deletedAt: null },
      },
    });
  }

  public async isUsernameAvailable(username: string, excludingUserId?: string): Promise<boolean> {
    const existing = await this.client.profile.findUnique({ where: { username } });
    return existing === null || existing.userId === excludingUserId;
  }

  public async create(userId: string, input: ProfileCreateInput): Promise<ProfileWithUser> {
    try {
      return await this.client.profile.create({
        data: {
          ...(input.bio === undefined ? {} : { bio: input.bio }),
          ...(input.university === undefined ? {} : { university: input.university }),
          userId,
          username: input.username,
        },
        include: { user: true },
      });
    } catch (error: unknown) {
      if (!isUniqueConstraintError(error)) throw error;
      if ((await this.client.profile.findUnique({ where: { userId } })) !== null) {
        throw new ProfileDomainError('PROFILE_ALREADY_EXISTS');
      }
      throw new ProfileDomainError('USERNAME_UNAVAILABLE');
    }
  }

  public async update(userId: string, input: ProfileUpdateInput): Promise<ProfileWithUser> {
    try {
      return await this.client.profile.update({
        data: {
          ...(input.bio === undefined ? {} : { bio: input.bio }),
          ...(input.university === undefined ? {} : { university: input.university }),
          ...(input.username === undefined ? {} : { username: input.username }),
        },
        include: { user: true },
        where: { userId },
      });
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) throw new ProfileDomainError('USERNAME_UNAVAILABLE');
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        throw new ProfileDomainError('PROFILE_NOT_FOUND');
      }
      throw error;
    }
  }

  public async setImage(userId: string, key: string, url: string) {
    const current = await this.findByUserId(userId);
    if (current === null) throw new ProfileDomainError('PROFILE_NOT_FOUND');
    const profile = await this.client.profile.update({
      data: { profileImageKey: key, profileImageUrl: url },
      include: { user: true },
      where: { userId },
    });
    return { previousKey: current.profileImageKey, profile };
  }

  public async clearImage(userId: string) {
    const current = await this.findByUserId(userId);
    if (current === null) throw new ProfileDomainError('PROFILE_NOT_FOUND');
    const profile = await this.client.profile.update({
      data: { profileImageKey: null, profileImageUrl: null },
      include: { user: true },
      where: { userId },
    });
    return { previousKey: current.profileImageKey, profile };
  }
}
