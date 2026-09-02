import type { OrderStatus } from '@thriftage/shared';

import { CommerceDomainError } from './commerce.errors';

export type OrderActor = 'BUYER' | 'SELLER' | 'SYSTEM';
export type OrderAction = 'CANCEL' | 'CONFIRM' | 'CONFIRM_DELIVERY' | 'COMPLETE' | 'SHIP';

const transitions: Readonly<
  Record<OrderAction, readonly { actor: OrderActor; from: OrderStatus; to: OrderStatus }[]>
> = {
  CANCEL: [
    { actor: 'BUYER', from: 'AWAITING_PAYMENT', to: 'CANCELLED' },
    { actor: 'BUYER', from: 'PENDING', to: 'CANCELLED' },
    { actor: 'SELLER', from: 'PENDING', to: 'CANCELLED' },
    { actor: 'SELLER', from: 'CONFIRMED', to: 'CANCELLED' },
  ],
  CONFIRM: [{ actor: 'SELLER', from: 'PENDING', to: 'CONFIRMED' }],
  CONFIRM_DELIVERY: [{ actor: 'BUYER', from: 'SHIPPED', to: 'DELIVERED' }],
  COMPLETE: [{ actor: 'SYSTEM', from: 'DELIVERED', to: 'COMPLETED' }],
  SHIP: [{ actor: 'SELLER', from: 'CONFIRMED', to: 'SHIPPED' }],
};

export function transitionOrder(
  status: OrderStatus,
  action: OrderAction,
  actor: OrderActor,
): OrderStatus {
  const transition = transitions[action].find(
    (candidate) => candidate.actor === actor && candidate.from === status,
  );
  if (transition === undefined) {
    throw new CommerceDomainError(
      action === 'CANCEL' ? 'ORDER_NOT_CANCELLABLE' : 'ORDER_INVALID_TRANSITION',
    );
  }
  return transition.to;
}
