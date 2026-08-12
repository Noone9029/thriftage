import { describe, expect, it } from 'vitest';

import { CashOnDeliveryAdapter } from './cash-on-delivery.adapter';

describe('CashOnDeliveryAdapter', () => {
  const adapter = new CashOnDeliveryAdapter();
  it('keeps COD pending at placement and collects only at completion', async () => {
    await expect(adapter.createPayment({ orderId: 'order-1' })).resolves.toMatchObject({
      status: 'PENDING_COLLECTION',
    });
    await expect(adapter.collect({ orderId: 'order-1' })).resolves.toMatchObject({
      status: 'COLLECTED',
    });
    await expect(adapter.cancel({ orderId: 'order-1' })).resolves.toMatchObject({
      status: 'CANCELLED',
    });
  });
});
