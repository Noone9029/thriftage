import { describe, expect, it, vi } from 'vitest';

import { OrderFinalizationWorker } from './order-finalization.worker';
import type { OrderRepository } from './order.repository';

describe('OrderFinalizationWorker resilience', () => {
  it('releases its run lock after failure so a later poll can recover', async () => {
    const finalizeDelivered = vi
      .fn()
      .mockRejectedValueOnce(new Error('private database detail'))
      .mockResolvedValueOnce(1);
    const worker = new OrderFinalizationWorker({
      finalizeDelivered,
    } as unknown as OrderRepository);

    await worker.tick();
    await worker.tick();

    expect(finalizeDelivered).toHaveBeenCalledTimes(2);
  });
});
