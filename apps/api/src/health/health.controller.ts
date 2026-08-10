import { Controller, Get, Inject } from '@nestjs/common';
import type { HealthResponse } from '@thriftage/shared';

import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  public constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  public getHealth(): HealthResponse {
    return this.healthService.getHealth();
  }
}
