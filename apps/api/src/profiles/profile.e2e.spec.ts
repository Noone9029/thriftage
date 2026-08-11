import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { User } from '@thriftage/db';
import {
  API_VERSION_PREFIX,
  privateUserProfileSchema,
  publicUserProfileSchema,
} from '@thriftage/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApplicationUserResolver } from '../auth/application-user-resolver.service';
import { AuthModule } from '../auth/auth.module';
import { AUTH_TOKEN_VERIFIER } from '../auth/auth-provider.interface';
import { ProfileController } from './profile.controller';
import { ProfileImageService } from './profile-image.service';
import { ProfileService } from './profile.service';

const user = {
  accountStatus: 'ACTIVE',
  authProviderUserId: 'provider-user',
  createdAt: new Date('2026-08-10T00:00:00Z'),
  deletedAt: null,
  email: 'private@example.com',
  emailVerified: true,
  fullName: 'Private Name',
  id: 'f4a24a69-563f-4d76-a657-2f672b2789d2',
  phone: '+923001234567',
  phoneVerified: true,
  role: 'USER',
  updatedAt: new Date('2026-08-11T00:00:00Z'),
} satisfies User;

const profile = {
  bio: 'Public bio',
  completedSalesCount: 0,
  id: user.id,
  memberSince: '2026-08-10T00:00:00.000Z',
  profileImageUrl: null,
  university: 'Example University',
  updatedAt: '2026-08-11T00:00:00.000Z',
  username: 'safe_name',
};

const publicProfile = {
  bio: profile.bio,
  completedSalesCount: profile.completedSalesCount,
  id: profile.id,
  memberSince: profile.memberSince,
  profileImageUrl: profile.profileImageUrl,
  university: profile.university,
  username: profile.username,
};

describe('profile endpoints', () => {
  let app: INestApplication;
  const profiles = {
    availability: vi.fn(),
    create: vi.fn(),
    getMine: vi.fn(),
    getPublic: vi.fn(),
    update: vi.fn(),
  };
  const images = { remove: vi.fn(), upload: vi.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProfileController],
      imports: [AuthModule],
      providers: [
        { provide: ProfileService, useValue: profiles },
        { provide: ProfileImageService, useValue: images },
      ],
    })
      .overrideProvider(AUTH_TOKEN_VERIFIER)
      .useValue({
        verifyAccessToken: vi.fn(async () => ({ authProviderUserId: user.authProviderUserId })),
      })
      .overrideProvider(ApplicationUserResolver)
      .useValue({ resolve: vi.fn(async () => ({ state: 'active', user })) })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_VERSION_PREFIX);
    await app.init();
  });

  beforeEach(() => {
    for (const mock of Object.values(profiles)) mock.mockReset();
    profiles.getMine.mockResolvedValue(profile);
    profiles.getPublic.mockResolvedValue(publicProfile);
    profiles.create.mockResolvedValue(profile);
    profiles.update.mockResolvedValue(profile);
    profiles.availability.mockResolvedValue({ available: true, username: 'safe_name' });
    images.upload.mockReset().mockResolvedValue(profile);
    images.remove.mockReset().mockResolvedValue(profile);
  });

  afterAll(async () => app.close());

  it('creates only the authenticated user profile with strict safe fields', async () => {
    const response = await request(app.getHttpServer())
      .post(`/${API_VERSION_PREFIX}/profiles`)
      .set('Authorization', 'Bearer token')
      .send({ bio: 'Public bio', username: 'Safe_Name' })
      .expect(201);
    expect(privateUserProfileSchema.parse(response.body).id).toBe(user.id);
    expect(profiles.create).toHaveBeenCalledWith(user.id, {
      bio: 'Public bio',
      username: 'safe_name',
    });
  });

  it.each(['userId', 'role', 'accountStatus', 'completedSalesCount', 'profileImageUrl'])(
    'rejects owner-controlled %s profile mutations',
    async (field) => {
      await request(app.getHttpServer())
        .patch(`/${API_VERSION_PREFIX}/profiles/me`)
        .set('Authorization', 'Bearer token')
        .send({ [field]: field === 'completedSalesCount' ? 5 : 'attacker', bio: 'safe' })
        .expect(400);
      expect(profiles.update).not.toHaveBeenCalled();
    },
  );

  it('returns public profile data without authentication or private identity', async () => {
    const response = await request(app.getHttpServer())
      .get(`/${API_VERSION_PREFIX}/profiles/SAFE_NAME`)
      .expect(200);
    expect(publicUserProfileSchema.parse(response.body).username).toBe('safe_name');
    expect(response.body).not.toHaveProperty('email');
    expect(response.body).not.toHaveProperty('phone');
    expect(response.body).not.toHaveProperty('authProviderUserId');
  });

  it('checks normalized availability for the authenticated owner', async () => {
    await request(app.getHttpServer())
      .get(`/${API_VERSION_PREFIX}/profiles/username-availability?username=Safe_Name`)
      .set('Authorization', 'Bearer token')
      .expect(200, { available: true, username: 'safe_name' });
    expect(profiles.availability).toHaveBeenCalledWith('safe_name', user.id);
  });

  it('maps oversized multipart uploads to a stable profile image error', async () => {
    await request(app.getHttpServer())
      .post(`/${API_VERSION_PREFIX}/profiles/me/image`)
      .set('Authorization', 'Bearer token')
      .attach('image', Buffer.alloc(5 * 1024 * 1024 + 1), {
        contentType: 'image/png',
        filename: 'untrusted.png',
      })
      .expect(413)
      .expect(({ body }) => expect(body).toMatchObject({ code: 'PROFILE_IMAGE_TOO_LARGE' }));
    expect(images.upload).not.toHaveBeenCalled();
  });
});
