import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { User } from '@thriftage/db';
import { API_VERSION_PREFIX, privateUserAccountSchema } from '@thriftage/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApplicationUserResolver } from './application-user-resolver.service';
import { AuthModule } from './auth.module';
import {
  AUTHORITATIVE_AUTH_USER_PROVIDER,
  AUTH_TOKEN_VERIFIER,
  type AuthTokenVerifier,
} from './auth-provider.interface';
import type { AuthenticatedIdentity } from './auth.types';
import { ProvisionUserService } from './provision-user.service';

const identity: AuthenticatedIdentity = {
  assuranceLevel: 'aal1',
  authProviderUserId: 'provider-user-id',
  email: 'verified@example.com',
  phone: '+923001234567',
  sessionId: 'session-id',
};

const activeUser: User = {
  accountStatus: 'ACTIVE',
  authProviderUserId: identity.authProviderUserId,
  createdAt: new Date('2026-08-10T00:00:00Z'),
  deletedAt: null,
  email: 'verified@example.com',
  emailVerified: true,
  fullName: 'Verified User',
  id: 'f4a24a69-563f-4d76-a657-2f672b2789d2',
  phone: '+923001234567',
  phoneVerified: true,
  role: 'USER',
  updatedAt: new Date('2026-08-10T00:00:00Z'),
};

describe('authentication endpoints', () => {
  let app: INestApplication;
  const verifyAccessToken = vi.fn();
  const provision = vi.fn();
  const resolve = vi.fn();

  beforeAll(async () => {
    const verifier: AuthTokenVerifier = { verifyAccessToken };
    const moduleRef = await Test.createTestingModule({ imports: [AuthModule] })
      .overrideProvider(AUTH_TOKEN_VERIFIER)
      .useValue(verifier)
      .overrideProvider(AUTHORITATIVE_AUTH_USER_PROVIDER)
      .useValue({ getUser: vi.fn() })
      .overrideProvider(ProvisionUserService)
      .useValue({ provision })
      .overrideProvider(ApplicationUserResolver)
      .useValue({ resolve })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_VERSION_PREFIX);
    await app.init();
  });

  beforeEach(() => {
    verifyAccessToken.mockReset().mockResolvedValue(identity);
    provision.mockReset().mockResolvedValue(activeUser);
    resolve.mockReset().mockResolvedValue({ state: 'active', user: activeUser });
  });

  afterAll(async () => {
    await app.close();
  });

  it('provisions from authenticated context and returns the private account contract', async () => {
    const response = await request(app.getHttpServer())
      .post(`/${API_VERSION_PREFIX}/auth/provision`)
      .set('Authorization', 'Bearer verified-token')
      .send({ fullName: 'Verified User' })
      .expect(201);

    expect(privateUserAccountSchema.parse(response.body).id).toBe(activeUser.id);
    expect(response.body).not.toHaveProperty('authProviderUserId');
    expect(provision).toHaveBeenCalledWith(
      { accessToken: 'verified-token', identity },
      { fullName: 'Verified User' },
    );
  });

  it.each([
    ['userId', '4aa115a8-f65d-4022-9797-f13729de210a'],
    ['authProviderUserId', 'other-provider-user'],
    ['email', 'attacker@example.com'],
    ['phone', '+923009999999'],
    ['role', 'ADMIN'],
    ['accountStatus', 'ACTIVE'],
    ['emailVerified', true],
    ['phoneVerified', true],
  ])('rejects client-authoritative %s during provisioning', async (field, value) => {
    await request(app.getHttpServer())
      .post(`/${API_VERSION_PREFIX}/auth/provision`)
      .set('Authorization', 'Bearer verified-token')
      .send({ [field]: value, fullName: 'Verified User' })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'VALIDATION_FAILED' });
      });
    expect(provision).not.toHaveBeenCalled();
  });

  it('returns the linked active user without accepting ownership overrides', async () => {
    const response = await request(app.getHttpServer())
      .get(`/${API_VERSION_PREFIX}/auth/me?userId=4aa115a8-f65d-4022-9797-f13729de210a`)
      .set('Authorization', 'Bearer verified-token')
      .set('X-User-Id', '4aa115a8-f65d-4022-9797-f13729de210a')
      .expect(200);

    expect(privateUserAccountSchema.parse(response.body).id).toBe(activeUser.id);
    expect(response.body).not.toHaveProperty('authProviderUserId');
    expect(resolve).toHaveBeenCalledWith(identity);
  });

  it('rejects unauthenticated access to /auth/me with a stable error', async () => {
    await request(app.getHttpServer())
      .get(`/${API_VERSION_PREFIX}/auth/me`)
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'AUTH_REQUIRED' });
      });
  });

  it.each([
    ['not_provisioned', 'AUTH_USER_NOT_PROVISIONED'],
    ['suspended', 'ACCOUNT_SUSPENDED'],
    ['deactivated', 'ACCOUNT_DEACTIVATED'],
  ] as const)(
    'does not let a valid bearer token bypass the %s application state',
    async (state, code) => {
      resolve.mockResolvedValueOnce(
        state === 'not_provisioned'
          ? { state }
          : {
              state,
              user: {
                ...activeUser,
                accountStatus: state === 'suspended' ? 'SUSPENDED' : 'DEACTIVATED',
              },
            },
      );

      await request(app.getHttpServer())
        .get(`/${API_VERSION_PREFIX}/auth/me`)
        .set('Authorization', 'Bearer verified-token')
        .expect(403)
        .expect(({ body }) => {
          expect(body).toMatchObject({ code });
        });
    },
  );
});
