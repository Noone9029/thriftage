import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { HealthController } from './health.controller';
import type { HealthService } from './health.service';

describe('HealthController database outage behavior', () => {
  it('returns a stable public failure and succeeds after the dependency recovers', async () => {
    const getReadiness = vi
      .fn<HealthService['getReadiness']>()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED postgres://private-host:5432'))
      .mockResolvedValueOnce({
        environment: 'staging',
        releaseVersion: 'release-sha',
        service: 'thriftage-api',
        status: 'ready',
        timestamp: '2026-08-16T00:00:00.000Z',
      });
    const service = { getReadiness } as Pick<HealthService, 'getReadiness'> as HealthService;
    const controller = new HealthController(service);

    let failure: unknown;
    try {
      await controller.getReadiness();
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(ServiceUnavailableException);
    expect((failure as ServiceUnavailableException).getResponse()).toEqual({
      code: 'SERVICE_NOT_READY',
      message: 'The service is not ready to accept traffic.',
    });
    expect(JSON.stringify((failure as ServiceUnavailableException).getResponse())).not.toContain(
      'private-host',
    );
    await expect(controller.getReadiness()).resolves.toMatchObject({ status: 'ready' });
  });
});
