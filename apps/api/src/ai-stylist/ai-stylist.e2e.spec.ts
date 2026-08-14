import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { User } from '@thriftage/db';
import { API_VERSION_PREFIX } from '@thriftage/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApplicationUserResolver } from '../auth/application-user-resolver.service';
import { AuthModule } from '../auth/auth.module';
import { AUTH_TOKEN_VERIFIER } from '../auth/auth-provider.interface';
import {
  AiStylistAdminController,
  AiStylistAttributionController,
  AiStylistConversationController,
  AiStylistSavedOutfitController,
} from './ai-stylist.controller';
import { AiStylistDomainError } from './ai-stylist.errors';
import { AiStylistService } from './ai-stylist.service';

const user = {
  accountStatus: 'ACTIVE',
  authProviderUserId: 'provider-ai-user',
  createdAt: new Date('2026-08-13T00:00:00Z'),
  deletedAt: null,
  email: 'private@example.com',
  emailVerified: true,
  fullName: 'AI User',
  id: '10000000-0000-4000-8000-000000000001',
  phone: '+923001234567',
  phoneVerified: true,
  role: 'USER',
  updatedAt: new Date('2026-08-13T00:00:00Z'),
} satisfies User;
const conversationId = '20000000-0000-4000-8000-000000000001';

const summary = {
  archivedAt: null,
  createdAt: '2026-08-13T00:00:00.000Z',
  id: conversationId,
  preview: null,
  title: 'New outfit',
  updatedAt: '2026-08-13T00:00:00.000Z',
};

describe('AI Stylist authenticated HTTP resources', () => {
  let app: INestApplication;
  const resolve = vi.fn();
  const service = {
    adminMetrics: vi.fn(),
    archiveConversation: vi.fn(),
    conversation: vi.fn(),
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    deleteSavedOutfit: vi.fn(),
    generate: vi.fn(),
    listConversations: vi.fn(),
    recordAttribution: vi.fn(),
    replaceSavedOutfitItem: vi.fn(),
    runtimeConfiguration: vi.fn(),
    saveOutfit: vi.fn(),
    savedOutfit: vi.fn(),
    savedOutfits: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        AiStylistAdminController,
        AiStylistAttributionController,
        AiStylistConversationController,
        AiStylistSavedOutfitController,
      ],
      imports: [AuthModule],
      providers: [{ provide: AiStylistService, useValue: service }],
    })
      .overrideProvider(AUTH_TOKEN_VERIFIER)
      .useValue({
        verifyAccessToken: vi.fn(async () => ({ authProviderUserId: user.authProviderUserId })),
      })
      .overrideProvider(ApplicationUserResolver)
      .useValue({ resolve })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_VERSION_PREFIX);
    await app.init();
  });

  beforeEach(() => {
    for (const mock of Object.values(service)) mock.mockReset();
    resolve.mockReset().mockResolvedValue({ state: 'active', user });
    service.createConversation.mockResolvedValue({ ...summary, messages: [] });
    service.listConversations.mockResolvedValue({ items: [summary], nextCursor: null });
    service.generate.mockResolvedValue({
      conversation: summary,
      message: {
        assistantPayload: null,
        content: 'Result',
        createdAt: '2026-08-13T00:00:01.000Z',
        id: '30000000-0000-4000-8000-000000000001',
        role: 'ASSISTANT',
      },
      status: 'SUCCEEDED',
    });
  });

  afterAll(async () => app.close());

  it('requires authentication and uses the linked server-side user identity', async () => {
    await request(app.getHttpServer())
      .get(`/${API_VERSION_PREFIX}/ai-stylist/conversations`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/${API_VERSION_PREFIX}/ai-stylist/conversations`)
      .set('Authorization', 'Bearer token')
      .send({})
      .expect(201);
    expect(service.createConversation).toHaveBeenCalledWith(user.id, {});
  });

  it('rejects owner IDs and unknown fields in strict client payloads', async () => {
    await request(app.getHttpServer())
      .post(`/${API_VERSION_PREFIX}/ai-stylist/conversations`)
      .set('Authorization', 'Bearer token')
      .send({ userId: 'attacker' })
      .expect(400);
    expect(service.createConversation).not.toHaveBeenCalled();
  });

  it('accepts an idempotent message request and forwards only authenticated ownership', async () => {
    const input = {
      body: 'Build a university outfit under PKR 8,000',
      requestId: '40000000-0000-4000-8000-000000000001',
    };
    await request(app.getHttpServer())
      .post(`/${API_VERSION_PREFIX}/ai-stylist/conversations/${conversationId}/messages`)
      .set('Authorization', 'Bearer token')
      .send(input)
      .expect(201);
    expect(service.generate).toHaveBeenCalledWith(user.id, conversationId, input);
  });

  it('maps cross-user domain denial without exposing another conversation', async () => {
    service.conversation.mockRejectedValue(new AiStylistDomainError('AI_CONVERSATION_FORBIDDEN'));
    await request(app.getHttpServer())
      .get(`/${API_VERSION_PREFIX}/ai-stylist/conversations/${conversationId}`)
      .set('Authorization', 'Bearer token')
      .expect(403)
      .expect(({ body }) => expect(body).toMatchObject({ code: 'AI_CONVERSATION_FORBIDDEN' }));
  });

  it('keeps aggregate operations data behind the PostgreSQL ADMIN role', async () => {
    await request(app.getHttpServer())
      .get(`/${API_VERSION_PREFIX}/admin/ai-stylist/metrics`)
      .set('Authorization', 'Bearer token')
      .expect(403);
    resolve.mockResolvedValue({ state: 'active', user: { ...user, role: 'ADMIN' } });
    service.adminMetrics.mockResolvedValue({ generations: 0 });
    await request(app.getHttpServer())
      .get(`/${API_VERSION_PREFIX}/admin/ai-stylist/metrics`)
      .set('Authorization', 'Bearer token')
      .expect(200, { generations: 0 });
    expect(service.adminMetrics).toHaveBeenCalledOnce();
  });
});
