import { Inject, Injectable } from '@nestjs/common';
import {
  orderDetailSchema,
  orderSummarySchema,
  type OrderDetail,
  type OrderSummary,
} from '@thriftage/shared';

import {
  LISTING_IMAGE_STORAGE,
  type ListingImageStorage,
} from '../listing-media/listing-image-storage.interface';
import type { OrderRecord } from './order.repository';

@Injectable()
export class OrderPresenter {
  public constructor(
    @Inject(LISTING_IMAGE_STORAGE) private readonly storage: ListingImageStorage,
  ) {}

  private async base(record: OrderRecord) {
    const urls = await this.storage.createSignedUrls(
      record.listingImageKey === null ? [] : [record.listingImageKey],
    );
    return {
      buyer: {
        id: record.buyerId,
        profileImageUrl: record.buyer.profile?.profileImageUrl ?? null,
        username: record.buyerUsername,
      },
      cancellationReason: record.cancellationReason,
      cancelledAt: record.cancelledAt?.toISOString() ?? null,
      completedAt: record.completedAt?.toISOString() ?? null,
      confirmedAt: record.confirmedAt?.toISOString() ?? null,
      conversationId: record.conversationId,
      createdAt: record.createdAt.toISOString(),
      currency: record.currency,
      deliveredAt: record.deliveredAt?.toISOString() ?? null,
      deliveryRateVersion: record.deliveryRateVersion,
      id: record.id,
      listingId: record.listingId,
      listingImageUrl:
        record.listingImageKey === null ? null : (urls.get(record.listingImageKey) ?? null),
      listingTitle: record.listingTitle,
      orderNumber: record.orderNumber,
      paymentMethod: record.paymentMethod,
      paymentExpiresAt: record.paymentExpiresAt?.toISOString() ?? null,
      priceMinor: record.priceMinor,
      quantity: record.quantity,
      itemSubtotalMinor: record.itemSubtotalMinor,
      commissionBps: record.commissionBps,
      commissionMinor: record.commissionMinor,
      withholdingBps: record.withholdingBps,
      withholdingMinor: record.withholdingMinor,
      sellerNetMinor: record.sellerNetMinor,
      financialPolicyVersion: record.financialPolicyVersion,
      withholdingRuleVersion: record.withholdingRuleVersion,
      disputeWindowEndsAt: record.disputeWindowEndsAt?.toISOString() ?? null,
      payoutEligibleAt: record.payoutEligibleAt?.toISOString() ?? null,
      seller: {
        id: record.sellerId,
        profileImageUrl: record.seller.profile?.profileImageUrl ?? null,
        username: record.sellerUsername,
      },
      shippedAt: record.shippedAt?.toISOString() ?? null,
      shippingMinor: record.shippingMinor,
      status: record.status,
      totalMinor: record.totalMinor,
      updatedAt: record.updatedAt.toISOString(),
    } as const;
  }

  public async summary(record: OrderRecord): Promise<OrderSummary> {
    return orderSummarySchema.parse(await this.base(record));
  }

  public async detail(record: OrderRecord): Promise<OrderDetail> {
    if (record.payment === null) throw new Error('Order payment invariant violated.');
    return orderDetailSchema.parse({
      ...(await this.base(record)),
      address: {
        addressLine1: record.addressLine1,
        addressLine2: record.addressLine2,
        city: record.city,
        countryCode: record.countryCode,
        deliveryInstructions: record.deliveryInstructions,
        phone: record.deliveryPhone,
        postalCode: record.postalCode,
        recipientName: record.recipientName,
        region: record.region,
      },
      events: record.events.map((event) => ({
        actorId: event.actorId,
        actorType: event.actorType,
        createdAt: event.createdAt.toISOString(),
        id: event.id,
        nextState: event.nextState,
        previousState: event.previousState,
        reason: event.reason,
        type: event.type,
      })),
      payment: {
        amountMinor: record.payment.amountMinor,
        checkoutUrl: record.payment.checkoutUrl,
        collectedAt: record.payment.collectedAt?.toISOString() ?? null,
        createdAt: record.payment.createdAt.toISOString(),
        currency: record.payment.currency,
        expiresAt: record.payment.expiresAt?.toISOString() ?? null,
        failureCode: record.payment.failureCode,
        id: record.payment.id,
        method: record.payment.method,
        provider: record.payment.provider,
        providerReference: record.payment.providerReference,
        refundedAt: record.payment.refundedAt?.toISOString() ?? null,
        status: record.payment.status,
        updatedAt: record.payment.updatedAt.toISOString(),
      },
      shipment:
        record.shipment === null
          ? null
          : {
              bookedAt: record.shipment.bookedAt?.toISOString() ?? null,
              courierReference: record.shipment.courierReference,
              createdAt: record.shipment.createdAt.toISOString(),
              deliveredAt: record.shipment.deliveredAt?.toISOString() ?? null,
              evidenceReference: record.shipment.evidenceReference,
              feeMinor: record.shipment.feeMinor,
              id: record.shipment.id,
              providerDisplayName: record.shipment.providerDisplayName,
              providerCode: record.shipment.providerCode,
              pickedUpAt: record.shipment.pickedUpAt?.toISOString() ?? null,
              returnedAt: record.shipment.returnedAt?.toISOString() ?? null,
              shippedAt: record.shipment.shippedAt?.toISOString() ?? null,
              status: record.shipment.status,
              trackingNumber: record.shipment.trackingNumber,
              trackingUrl: record.shipment.trackingUrl,
              updatedAt: record.shipment.updatedAt.toISOString(),
            },
    });
  }
}
