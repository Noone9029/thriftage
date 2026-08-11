import { Injectable } from '@nestjs/common';
import { getPrismaClient, type User } from '@thriftage/db';

import type { AuthenticatedIdentity } from './auth.types';

export type ApplicationUserResolution =
  | { readonly state: 'not_provisioned' }
  | { readonly state: 'active'; readonly user: User }
  | { readonly state: 'suspended'; readonly user: User }
  | { readonly state: 'deactivated'; readonly user: User };

@Injectable()
export class ApplicationUserResolver {
  public async resolve(identity: AuthenticatedIdentity): Promise<ApplicationUserResolution> {
    const user = await getPrismaClient().user.findUnique({
      where: { authProviderUserId: identity.authProviderUserId },
    });

    if (user === null) {
      return { state: 'not_provisioned' };
    }

    switch (user.accountStatus) {
      case 'ACTIVE':
        return { state: 'active', user };
      case 'SUSPENDED':
        return { state: 'suspended', user };
      case 'DEACTIVATED':
        return { state: 'deactivated', user };
    }
  }
}
