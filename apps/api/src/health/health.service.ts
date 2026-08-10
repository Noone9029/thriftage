import { Injectable } from '@nestjs/common';
import { API_SERVICE_NAME } from '@thriftage/shared';
import type { HealthResponse } from '@thriftage/shared';

@Injectable()
export class HealthService {
  public getHealth(): HealthResponse {
    return {
      service: API_SERVICE_NAME,
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
