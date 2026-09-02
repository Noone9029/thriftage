import { Injectable } from '@nestjs/common';

import type { PayFastGateway } from './payfast-gateway.interface';

@Injectable()
export class UnavailablePayFastGateway implements PayFastGateway {
  public createHostedSession(): Promise<never> {
    return Promise.reject(new Error('PAYFAST_APPROVED_INTEGRATION_PACK_REQUIRED'));
  }

  public getAuthoritativeStatus(): Promise<never> {
    return Promise.reject(new Error('PAYFAST_APPROVED_INTEGRATION_PACK_REQUIRED'));
  }

  public verifyCallback(): Promise<never> {
    return Promise.reject(new Error('PAYFAST_APPROVED_INTEGRATION_PACK_REQUIRED'));
  }
}
