import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  API_VERSION_PREFIX,
  healthResponseSchema,
  publicRuntimeConfigSchema,
} from '@thriftage/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';

describe('health endpoint', () => {
  let app: INestApplication;

  beforeAll(async () => {
    Object.assign(process.env, {
      SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'a'.repeat(24)}`,
      SUPABASE_SECRET_KEY: `sb_secret_${'b'.repeat(24)}`,
      SUPABASE_URL: 'http://127.0.0.1:54321',
      TWILIO_ACCOUNT_SID: `AC${'a'.repeat(32)}`,
      TWILIO_API_KEY_SECRET: 'local-test-secret-placeholder',
      TWILIO_API_KEY_SID: `SK${'b'.repeat(32)}`,
      TWILIO_VERIFY_SERVICE_SID: `VA${'c'.repeat(32)}`,
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_VERSION_PREFIX);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports a contract-valid healthy response', async () => {
    const response = await request(app.getHttpServer())
      .get(`/${API_VERSION_PREFIX}/health`)
      .expect(200);

    expect(healthResponseSchema.parse(response.body)).toMatchObject({
      environment: 'local',
      releaseVersion: 'development',
      service: 'thriftage-api',
      status: 'ok',
    });
  });

  it('exposes only safe runtime flags and public links', async () => {
    const response = await request(app.getHttpServer())
      .get(`/${API_VERSION_PREFIX}/runtime-config`)
      .expect(200);

    expect(publicRuntimeConfigSchema.parse(response.body)).toMatchObject({
      environment: 'local',
      features: {
        phoneAuth: true,
        registration: true,
      },
      releaseVersion: 'development',
    });
    expect(JSON.stringify(response.body)).not.toMatch(/secret|token|key|dsn/i);
  });
});
