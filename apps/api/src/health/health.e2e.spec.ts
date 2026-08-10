import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { API_VERSION_PREFIX, healthResponseSchema } from '@thriftage/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';

describe('health endpoint', () => {
  let app: INestApplication;

  beforeAll(async () => {
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
      service: 'thriftage-api',
      status: 'ok',
    });
  });
});
