import { describe, expect, it } from 'vitest';

import { transitionOrder } from './order-state-machine';

describe('transitionOrder', () => {
  it('allows only the approved actor lifecycle', () => {
    expect(transitionOrder('PENDING', 'CONFIRM', 'SELLER')).toBe('CONFIRMED');
    expect(transitionOrder('CONFIRMED', 'SHIP', 'SELLER')).toBe('SHIPPED');
    expect(transitionOrder('SHIPPED', 'CONFIRM_DELIVERY', 'BUYER')).toBe('DELIVERED');
    expect(transitionOrder('DELIVERED', 'COMPLETE', 'SYSTEM')).toBe('COMPLETED');
  });

  it('rejects unauthorized and invalid transitions', () => {
    expect(() => transitionOrder('PENDING', 'CONFIRM', 'BUYER')).toThrow();
    expect(() => transitionOrder('SHIPPED', 'CANCEL', 'SELLER')).toThrow();
  });
});
