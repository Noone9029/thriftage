import { Inject, Injectable, Optional } from '@nestjs/common';
import { getPrismaClient, type PrismaClient, type User } from '@thriftage/db';

import type { AuthenticatedIdentity } from './auth.types';

export type ApplicationUserResolution =
  | { readonly state: 'not_provisioned' }
  | { readonly state: 'active'; readonly user: User }
  | { readonly state: 'suspended'; readonly user: User }
  | { readonly state: 'deactivated'; readonly user: User };

const activeStandardUserCacheTtlMs = 2_000;
const maximumActiveStandardUserCacheEntries = 5_000;
const applicationUserResolverPrisma = Symbol('APPLICATION_USER_RESOLVER_PRISMA');

interface ActiveUserCacheEntry {
  readonly expiresAt: number;
  readonly user: User;
}

@Injectable()
export class ApplicationUserResolver {
  private readonly activeUsers = new Map<string, ActiveUserCacheEntry>();
  private readonly resolving = new Map<string, Promise<ApplicationUserResolution>>();

  public constructor(
    @Optional()
    @Inject(applicationUserResolverPrisma)
    private readonly prisma?: PrismaClient,
  ) {}

  private get client(): PrismaClient {
    return this.prisma ?? getPrismaClient();
  }

  public async resolve(identity: AuthenticatedIdentity): Promise<ApplicationUserResolution> {
    const providerUserId = identity.authProviderUserId;
    const cached = this.cachedActiveUser(providerUserId);
    if (cached !== undefined) return { state: 'active', user: cached };

    const current = this.resolving.get(providerUserId);
    if (current !== undefined) return current;

    const resolution = this.resolveAuthoritatively(providerUserId).finally(() => {
      if (this.resolving.get(providerUserId) === resolution) {
        this.resolving.delete(providerUserId);
      }
    });
    this.resolving.set(providerUserId, resolution);
    return resolution;
  }

  private async resolveAuthoritatively(
    authProviderUserId: string,
  ): Promise<ApplicationUserResolution> {
    const user = await this.client.user.findUnique({ where: { authProviderUserId } });

    if (user === null) {
      return { state: 'not_provisioned' };
    }

    switch (user.accountStatus) {
      case 'ACTIVE':
        // Privileged identities always hit Postgres. Standard-user caching is deliberately
        // shorter than a normal screen transition so suspension propagation stays bounded.
        if (user.role === 'USER') this.cacheActiveUser(authProviderUserId, user);
        return { state: 'active', user };
      case 'SUSPENDED':
        return { state: 'suspended', user };
      case 'DEACTIVATED':
        return { state: 'deactivated', user };
    }
  }

  private cachedActiveUser(authProviderUserId: string): User | undefined {
    const entry = this.activeUsers.get(authProviderUserId);
    if (entry === undefined) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.activeUsers.delete(authProviderUserId);
      return undefined;
    }
    return entry.user;
  }

  private cacheActiveUser(authProviderUserId: string, user: User): void {
    this.activeUsers.delete(authProviderUserId);
    this.activeUsers.set(authProviderUserId, {
      expiresAt: Date.now() + activeStandardUserCacheTtlMs,
      user,
    });
    while (this.activeUsers.size > maximumActiveStandardUserCacheEntries) {
      const oldest = this.activeUsers.keys().next().value as string | undefined;
      if (oldest === undefined) return;
      this.activeUsers.delete(oldest);
    }
  }
}
