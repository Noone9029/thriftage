import { Injectable } from '@nestjs/common';

import type { ShippingProvider } from './shipping-provider.interface';

@Injectable()
export class ManualShippingAdapter implements ShippingProvider {
  public validateManualShipment(): Promise<void> {
    return Promise.resolve();
  }
}
