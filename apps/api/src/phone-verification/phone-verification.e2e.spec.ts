import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { User } from '@thriftage/db';
import { API_VERSION_PREFIX, privateUserAccountSchema } from '@thriftage/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApplicationUserResolver } from '../auth/application-user-resolver.service';
import { AUTH_TOKEN_VERIFIER } from '../auth/auth-provider.interface';
import type { AuthenticatedIdentity } from '../auth/auth.types';
import { AUTH_ADMIN_PROVIDER } from './auth-admin-provider.interface';
import {
  PHONE_VERIFICATION_POLICY,
  PHONE_VERIFICATION_REPOSITORY,
  PhoneLinkingService,
} from './phone-linking.service';
import { PHONE_VERIFICATION_PROVIDER } from './phone-verification-provider.interface';
import { PhoneVerificationModule } from './phone-verification.module';

const identity: AuthenticatedIdentity = {
  assuranceLevel: 'aal1',
  authProviderUserId: 'provider-user-id',
  email: 'user@example.com',
  phone: null,
  sessionId: 'session-id',
};

const activeUser: User = {
  accountStatus: 'ACTIVE',
  authProviderUserId: identity.authProviderUserId,
  createdAt: new Date('2026-08-11T00:00:00.000Z'),
  deletedAt: null,
  email: identity.email,
  emailVerified: true,
  fullName: 'Test User',
  id: 'f4a24a69-563f-4d76-a657-2f672b2789d2',
  phone: null,
  phoneVerified: false,
  role: 'USER',
  updatedAt: new Date('2026-08-11T00:00:00.000Z'),
};

const challenge = {
  attemptId: '0b72b4ca-71f6-4c99-bac3-7a3efc455271',
  expiresAt: '2026-08-11T00:10:00.000Z',
  maskedPhone: '+92******4567',
  resendAvailableAt: '2026-08-11T00:01:00.000Z',
  status: 'PENDING',
} as const;

describe('phone verification endpoints', () => {
  let app: INestApplication;
  const verifyAccessToken = vi.fn();
  const resolve = vi.fn();
  const service = {
    cancel: vi.fn(),
    current: vi.fn(),
    resend: vi.fn(),
    start: vi.fn(),
    verify: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [PhoneVerificationModule] })
      .overrideProvider(AUTH_TOKEN_VERIFIER)
      .useValue({ verifyAccessToken })
      .overrideProvider(ApplicationUserResolver)
      .useValue({ resolve })
      .overrideProvider(PHONE_VERIFICATION_PROVIDER)
      .useValue({})
      .overrideProvider(AUTH_ADMIN_PROVIDER)
      .useValue({})
      .overrideProvider(PHONE_VERIFICATION_REPOSITORY)
      .useValue({})
      .overrideProvider(PHONE_VERIFICATION_POLICY)
      .useValue({})
      .overrideProvider(PhoneLinkingService)
      .useValue(service)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_VERSION_PREFIX);
    await app.init();
  });

  beforeEach(() => {
    verifyAccessToken.mockReset().mockResolvedValue(identity);
    resolve.mockReset().mockResolvedValue({ state: 'active', user: activeUser });
    service.cancel.mockReset().mockResolvedValue(undefined);
    service.current.mockReset().mockResolvedValue(challenge);
    service.resend.mockReset().mockResolvedValue(challenge);
    service.start.mockReset().mockResolvedValue(challenge);
    service.verify.mockReset().mockResolvedValue({
      ...activeUser,
      phone: '+923001234567',
      phoneVerified: true,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('starts for the authenticated active application user only', async () => {
    const response = await request(app.getHttpServer())
      .post(`/${API_VERSION_PREFIX}/auth/phone-verification/start`)
      .set('Authorization', 'Bearer verified-token')
      .set('X-User-Id', 'attacker-selected')
      .send({ phone: '+92 300 1234567' })
      .expect(200);

    expect(response.body).toEqual(challenge);
    expect(service.start).toHaveBeenCalledWith(activeUser, { phone: '+92 300 1234567' });
  });

  it.each(['userId', 'authProviderUserId', 'phoneVerified', 'provider', 'status'])(
    'rejects caller-authoritative start field %s',
    async (field) => {
      await request(app.getHttpServer())
        .post(`/${API_VERSION_PREFIX}/auth/phone-verification/start`)
        .set('Authorization', 'Bearer verified-token')
        .send({ [field]: 'attacker-selected', phone: '+923001234567' })
        .expect(400);
      expect(service.start).not.toHaveBeenCalled();
    },
  );

  it('verifies by owned attempt contract and returns only the private account', async () => {
    const response = await request(app.getHttpServer())
      .post(`/${API_VERSION_PREFIX}/auth/phone-verification/verify`)
      .set('Authorization', 'Bearer verified-token')
      .send({ attemptId: challenge.attemptId, code: '012345' })
      .expect(200);

    expect(privateUserAccountSchema.parse(response.body)).toMatchObject({
      id: activeUser.id,
      phone: '+923001234567',
      phoneVerified: true,
    });
    expect(response.body).not.toHaveProperty('authProviderUserId');
    expect(service.verify).toHaveBeenCalledWith(activeUser, {
      attemptId: challenge.attemptId,
      code: '012345',
    });
  });

  it('supports current, resend, and cancellation without exposing a full phone', async () => {
    const currentResponse = await request(app.getHttpServer())
      .get(`/${API_VERSION_PREFIX}/auth/phone-verification/current`)
      .set('Authorization', 'Bearer verified-token')
      .expect(200);
    await request(app.getHttpServer())
      .post(`/${API_VERSION_PREFIX}/auth/phone-verification/${challenge.attemptId}/resend`)
      .set('Authorization', 'Bearer verified-token')
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/${API_VERSION_PREFIX}/auth/phone-verification/current`)
      .set('Authorization', 'Bearer verified-token')
      .expect(204);

    expect(JSON.stringify(currentResponse.body)).not.toContain('+923001234567');
    expect(service.resend).toHaveBeenCalledWith(activeUser, challenge.attemptId);
    expect(service.cancel).toHaveBeenCalledWith(activeUser);
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .get(`/${API_VERSION_PREFIX}/auth/phone-verification/current`)
      .expect(401)
      .expect(({ body }) => expect(body).toMatchObject({ code: 'AUTH_REQUIRED' }));
  });

  it.each([
    ['suspended', 'ACCOUNT_SUSPENDED'],
    ['deactivated', 'ACCOUNT_DEACTIVATED'],
  ] as const)('blocks %s application accounts', async (state, code) => {
    resolve.mockResolvedValueOnce({
      state,
      user: { ...activeUser, accountStatus: state === 'suspended' ? 'SUSPENDED' : 'DEACTIVATED' },
    });
    await request(app.getHttpServer())
      .post(`/${API_VERSION_PREFIX}/auth/phone-verification/start`)
      .set('Authorization', 'Bearer verified-token')
      .send({ phone: '+923001234567' })
      .expect(403)
      .expect(({ body }) => expect(body).toMatchObject({ code }));
    expect(service.start).not.toHaveBeenCalled();
  });
});
