# Marketplace Finance and Inventory

This document is the implementation contract for the monetized Lahore beta. It does not constitute legal, tax, payment-provider, or courier approval.

## Commercial model

- Every account may buy and sell. A seller is a user with listing activity; there is no vendor subtype.
- Thriftage charges the seller 10% (1,000 basis points) of the item subtotal when an order completes.
- The buyer pays the snapshotted Lahore delivery charge. Delivery is not commissionable and is not payable to the seller.
- Listing and buyer service fees are zero. Provider and payout processing costs belong to Thriftage.
- Seller net is `item subtotal - commission - approved withholding`. Commission uses integer minor units and half-up rounding.
- Withholding is zero unless an approved, versioned rule is configured. Code must never infer a tax rate.

Every order snapshots quantity one, item subtotal, delivery fee, delivery-rate version, total, commission rate and amount, withholding rate and amount, seller net, currency, and policy versions. Later configuration changes never rewrite an order snapshot.

## Inventory invariants

Listings have `stock_available`, `stock_reserved`, and `stock_sold`; all values are non-negative and total stock is 1–999. One order reserves one unit.

- Checkout locks the listing row, decrements available, increments reserved, and appends a `RESERVED` movement.
- Cancellation or PayFast expiry decrements reserved, increments available, and appends `RELEASED`.
- Completion decrements reserved, increments sold, and appends `SOLD`.
- An inspected return may decrement sold, increment available, and append `RESTOCKED`.
- Status is `ACTIVE` while available is positive, `RESERVED` when units remain but all are held, and `SOLD` when no unit is available or reserved.

Inventory movements and financial entries are append-only at the database layer. Corrections use compensating entries.

## Payment, settlement, and payout

PayFast orders start in `AWAITING_PAYMENT`; the reservation expires after exactly 15 minutes. Only a signature-verified callback followed by an authoritative provider status query may mark payment collected. Provider event IDs are deduplicated and the exact callback bytes are hashed before parsing/trust.

PayFast's public material advertises PKR bank, wallet, card, and Raast acceptance, pricing from 0.60% to 3.50% excluding tax, and merchant settlement around T+2/3. These are provider statements, not Thriftage runtime guarantees. See [PayFast pricing](https://gopayfast.com/pricing/) and [PayFast FAQ](https://gopayfast.com/faqs/). The public documentation describes settlement to the merchant; Thriftage must not infer split payments or marketplace seller payouts from it. Written marketplace approval and the approved integration pack remain launch gates.

COD orders start `PENDING`, but COD is available only when the contracted courier deposits itemized buyer funds into Thriftage's bank account. Direct seller settlement and physical cash handover to Thriftage are prohibited.

Settlement matching records PayFast or courier deposits against the immutable buyer total. A mismatch is retained as an exception and cannot make an order payout-eligible. Provider cost, courier cost, commission, withholding, seller payable, refund, and payout entries are recorded separately.

An order is eligible for a weekly payout only when it is completed, its 48-hour dispute window has ended, no dispute is open, incoming funds match exactly, and an active payout destination has cleared its hold. One authorized person creates a batch and another approves it.

## Refunds and returns

Only full refunds exist. Before shipment, a valid participant cancellation may request a refund. After delivery and within 48 hours, reasons are limited to non-delivery, wrong item, counterfeit, or material mismatch. There is no partial or change-of-mind refund.

A refund reverses commission. Shipped stock remains out of available inventory until an authorized operator records return receipt and inspection evidence.

## Sensitive payout data

Payout destinations are AES-256-GCM encrypted with a server-only key. APIs return only a masked label. Easypaisa and JazzCash destinations must exactly match the seller's verified account phone. Creating or changing a destination requires recent authentication, admin review, a 72-hour hold, and a user notification before activation. Production key custody and rotation require an approved secret-management procedure.
