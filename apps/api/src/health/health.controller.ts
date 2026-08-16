import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { HealthResponse, PublicRuntimeConfig, ReadinessResponse } from '@thriftage/shared';

import { HealthService } from './health.service';

@Controller()
export class HealthController {
  public constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get('health')
  public getHealth(): HealthResponse {
    return this.healthService.getHealth();
  }

  @Get('runtime-config')
  public getRuntimeConfig(): PublicRuntimeConfig {
    return this.healthService.getRuntimeConfig();
  }

  @Get('readiness')
  public async getReadiness(): Promise<ReadinessResponse> {
    try {
      return await this.healthService.getReadiness();
    } catch {
      throw new ServiceUnavailableException({
        code: 'SERVICE_NOT_READY',
        message: 'The service is not ready to accept traffic.',
      });
    }
  }
}
