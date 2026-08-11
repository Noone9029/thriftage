import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { User } from '@thriftage/db';
import { adminAccessSchema, API_VERSION_PREFIX } from '@thriftage/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApplicationUserResolver } from '../auth/application-user-resolver.service';
import { AuthModule } from '../auth/auth.module';
import { AUTH_TOKEN_VERIFIER } from '../auth/auth-provider.interface';
import { AdminAccessController } from './admin-access.controller';

const baseUser = {
  accountStatus: 'ACTIVE',
  authProviderUserId: 'provider-user',
  createdAt: new Date(),
  deletedAt: null,
  email: null,
  emailVerified: true,
  fullName: 'Role Test',
  id: 'f4a24a69-563f-4d76-a657-2f672b2789d2',
  phone: '+923001234567',
  phoneVerified: true,
  role: 'USER',
  updatedAt: new Date(),
} satisfies User;

describe('PostgreSQL-backed admin authorization', () => {
  let app: INestApplication;
  const resolve = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminAccessController],
      imports: [AuthModule],
    })
      .overrideProvider(AUTH_TOKEN_VERIFIER)
      .useValue({ verifyAccessToken: vi.fn(async () => ({ authProviderUserId: 'provider-user' })) })
      .overrideProvider(ApplicationUserResolver)
      .useValue({ resolve })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_VERSION_PREFIX);
    await app.init();
  });

  beforeEach(() => resolve.mockReset());
  afterAll(async () => app.close());

  it('denies a normal USER even if client headers claim ADMIN', async () => {
    resolve.mockResolvedValue({ state: 'active', user: baseUser });
    await request(app.getHttpServer())
      .get(`/${API_VERSION_PREFIX}/admin/access`)
      .set('Authorization', 'Bearer token')
      .set('X-Role', 'ADMIN')
      .expect(403)
      .expect(({ body }) => expect(body).toMatchObject({ code: 'ADMIN_PERMISSION_DENIED' }));
  });

  it('allows a PostgreSQL ADMIN', async () => {
    resolve.mockResolvedValue({ state: 'active', user: { ...baseUser, role: 'ADMIN' } });
    const response = await request(app.getHttpServer())
      .get(`/${API_VERSION_PREFIX}/admin/access`)
      .set('Authorization', 'Bearer token')
      .expect(200);
    expect(adminAccessSchema.parse(response.body)).toEqual({ authorized: true, role: 'ADMIN' });
  });

  it('does not let a suspended ADMIN reach role authorization', async () => {
    resolve.mockResolvedValue({
      state: 'suspended',
      user: { ...baseUser, accountStatus: 'SUSPENDED', role: 'ADMIN' },
    });
    await request(app.getHttpServer())
      .get(`/${API_VERSION_PREFIX}/admin/access`)
      .set('Authorization', 'Bearer token')
      .expect(403)
      .expect(({ body }) => expect(body).toMatchObject({ code: 'ACCOUNT_SUSPENDED' }));
  });
});
