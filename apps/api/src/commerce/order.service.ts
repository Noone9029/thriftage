import { Inject, Injectable } from '@nestjs/common';
import {
  adminOrderQuerySchema,
  checkoutInputSchema,
  orderCancellationInputSchema,
  orderPageSchema,
  orderQuerySchema,
  shipmentInputSchema,
  type AdminOrderQuery,
  type CheckoutInput,
  type OrderCancellationInput,
  type OrderDetail,
  type OrderPage,
  type ShipmentInput,
} from '@thriftage/shared';
import { z } from 'zod';

import { encodeCursor } from '../common/cursor';
import { CommerceDomainError, mapCommerceError } from './commerce.errors';
import {
  MARKETPLACE_EVENT_PUBLISHER,
  type MarketplaceEventPublisher,
} from '../common/marketplace-event-publisher';
import { OrderPresenter } from './order.presenter';
import { OrderRepository } from './order.repository';
import { SafetyService } from '../trust/safety.service';
import { PersonalizationService } from '../personalization/personalization.service';

const orderCursorSchema = z.strictObject({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
});

function decodeOrderCursor(cursor: string | undefined) {
  if (cursor === undefined) return null;
  try {
    return orderCursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
  } catch {
    throw new CommerceDomainError('COMMERCE_VALIDATION_FAILED');
  }
}

@Injectable()
export class OrderService {
  public constructor(
    @Inject(OrderRepository) private readonly repository: OrderRepository,
    @Inject(OrderPresenter) private readonly presenter: OrderPresenter,
    @Inject(MARKETPLACE_EVENT_PUBLISHER) private readonly events: MarketplaceEventPublisher,
    @Inject(SafetyService) private readonly safety: SafetyService,
    @Inject(PersonalizationService) private readonly personalization: PersonalizationService,
  ) {}

  private async requireParticipant(userId: string, orderId: string): Promise<OrderDetail> {
    const order = await this.repository.findParticipant(userId, orderId);
    if (order === null) throw new CommerceDomainError('ORDER_NOT_FOUND');
    return this.presenter.detail(order);
  }

  public async place(userId: string, input: CheckoutInput): Promise<OrderDetail> {
    try {
      const parsed = checkoutInputSchema.parse(input);
      await this.safety.assertScopeAllowed(userId, 'BUYING');
      await this.safety.assertListingPairAllowed(userId, parsed.listingId);
      this.events.publish({
        actorId: userId,
        listingId: parsed.listingId,
        name: 'checkout_started',
      });
      const order = await this.presenter.detail(await this.repository.placeOrder(userId, parsed));
      this.events.publish({
        actorId: userId,
        listingId: order.listingId,
        name: 'order_created',
        orderId: order.id,
      });
      this.events.publish({ actorId: userId, name: 'payment_started', orderId: order.id });
      void this.personalization
        .recordEvent(userId, {
          listingId: order.listingId,
          source: 'LISTING_DETAIL',
          type: 'PURCHASE',
        })
        .catch(() => undefined);
      return order;
    } catch (error) {
      throw mapCommerceError(error);
    }
  }
  public async get(userId: string, orderId: string): Promise<OrderDetail> {
    try {
      return await this.requireParticipant(userId, orderId);
    } catch (error) {
      throw mapCommerceError(error);
    }
  }
  public async getAdmin(orderId: string): Promise<OrderDetail> {
    try {
      const order = await this.repository.findAdmin(orderId);
      if (order === null) throw new CommerceDomainError('ORDER_NOT_FOUND');
      return await this.presenter.detail(order);
    } catch (error) {
      throw mapCommerceError(error);
    }
  }
  public async list(userId: string, role: 'buyer' | 'seller', input: unknown): Promise<OrderPage> {
    try {
      const query = orderQuerySchema.parse(input);
      const cursor = decodeOrderCursor(query.cursor);
      const result = await this.repository.listParticipant(
        userId,
        role,
        query,
        cursor === null ? undefined : { createdAt: new Date(cursor.createdAt), id: cursor.id },
      );
      const last = result.records.at(-1);
      return orderPageSchema.parse({
        items: await Promise.all(result.records.map((record) => this.presenter.summary(record))),
        nextCursor:
          result.hasMore && last !== undefined
            ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
            : null,
      });
    } catch (error) {
      throw mapCommerceError(error);
    }
  }
  public async listAdmin(input: unknown): Promise<OrderPage> {
    try {
      const query: AdminOrderQuery = adminOrderQuerySchema.parse(input);
      const cursor = decodeOrderCursor(query.cursor);
      const result = await this.repository.listAdmin(
        query,
        cursor === null ? undefined : { createdAt: new Date(cursor.createdAt), id: cursor.id },
      );
      const last = result.records.at(-1);
      return orderPageSchema.parse({
        items: await Promise.all(result.records.map((record) => this.presenter.summary(record))),
        nextCursor:
          result.hasMore && last !== undefined
            ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
            : null,
      });
    } catch (error) {
      throw mapCommerceError(error);
    }
  }
  public async confirm(userId: string, orderId: string): Promise<OrderDetail> {
    try {
      const order = await this.presenter.detail(
        await this.repository.transition(orderId, userId, 'confirm'),
      );
      this.events.publish({ actorId: userId, name: 'order_confirmed', orderId });
      return order;
    } catch (error) {
      throw mapCommerceError(error);
    }
  }
  public async cancelBuyer(
    userId: string,
    orderId: string,
    input: OrderCancellationInput,
  ): Promise<OrderDetail> {
    try {
      const parsed = orderCancellationInputSchema.parse(input);
      const order = await this.presenter.detail(
        await this.repository.transition(orderId, userId, 'cancelBuyer', parsed.reason),
      );
      this.events.publish({ actorId: userId, name: 'order_cancelled', orderId });
      return order;
    } catch (error) {
      throw mapCommerceError(error);
    }
  }
  public async cancelSeller(
    userId: string,
    orderId: string,
    input: OrderCancellationInput,
  ): Promise<OrderDetail> {
    try {
      const parsed = orderCancellationInputSchema.parse(input);
      const order = await this.presenter.detail(
        await this.repository.transition(orderId, userId, 'cancelSeller', parsed.reason),
      );
      this.events.publish({ actorId: userId, name: 'order_cancelled', orderId });
      return order;
    } catch (error) {
      throw mapCommerceError(error);
    }
  }
  public async ship(userId: string, orderId: string, input: ShipmentInput): Promise<OrderDetail> {
    try {
      const order = await this.presenter.detail(
        await this.repository.ship(orderId, userId, shipmentInputSchema.parse(input)),
      );
      this.events.publish({ actorId: userId, name: 'order_shipped', orderId });
      return order;
    } catch (error) {
      throw mapCommerceError(error);
    }
  }
  public async confirmDelivery(userId: string, orderId: string): Promise<OrderDetail> {
    try {
      const order = await this.presenter.detail(
        await this.repository.confirmDelivery(orderId, userId),
      );
      this.events.publish({ actorId: userId, name: 'order_delivered', orderId });
      return order;
    } catch (error) {
      throw mapCommerceError(error);
    }
  }
}
