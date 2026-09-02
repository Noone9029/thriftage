# Commerce, Courier, Reconciliation, and Payout Runbook

Live money stays disabled until the Commercial, Ownership/Infrastructure, Engineering/Staging, and First-Money gates in `docs/release/monetized-lahore-beta.md` are evidenced.

## Roles

Admin role alone is insufficient for money operations. Grant narrowly scoped `OPERATIONS`, `FINANCE_RECONCILIATION`, `PAYOUT_CREATE`, and `PAYOUT_APPROVE` permissions through an audited operator procedure. The payout creator and approver must be different user IDs. The founder is Release and Billing Owner; a second named person must hold payout approval.

Never paste payout encryption keys, provider credentials, tokens, bank evidence, or identity documents into tickets, chat, logs, or source control.

## PayFast prepayment

1. Confirm `PAYFAST_ENABLED=true` only in the environment with approved sandbox/live credentials. `PAYFAST_LIVE_ENABLED` stays false until a written marketplace approval reference and commercial approval reference are configured.
2. Mobile creates an order, then requests the server-owned hosted checkout. The API never accepts client-calculated totals.
3. Receive the callback as exact raw bytes. Reject an invalid signature, duplicate provider event, order/reference mismatch, amount mismatch, currency mismatch, or disagreement with authoritative status.
4. On success, move `AWAITING_PAYMENT` to `PENDING`. At 15 minutes, query status. A confirmed failed/cancelled status releases stock; an outage retains the reservation for manual reconciliation.
5. Match the later merchant settlement against the exact buyer total and record the provider cost separately. Do not assume PayFast supports split settlement; written approval is required for marketplace collection followed by seller payout.

The runtime gateway is deliberately unavailable until the approved PayFast integration pack defines the exact signature, token/session, callback, status, and refund contract. Implement and sandbox-test that adapter before enabling the flag.

## Manual Lahore courier and COD

1. Confirm the order is `PENDING` or `CONFIRMED` and the snapshotted delivery fee matches the approved Lahore rate card.
2. Operations books pickup by phone/WhatsApp outside the app. Store only the courier reference, structured status, fee, timestamps, and a durable evidence reference.
3. Progress through `BOOKED`, `PICKED_UP`, `IN_TRANSIT`, and `DELIVERED`; use `FAILED`, `RETURNING`, `RETURNED`, or `LOST` for exceptions.
4. For COD, enable `COD_ENABLED` only after the courier agreement and an exact itemized deposit drill. Record each bank deposit as `COURIER_COD`; a mismatch stays an exception. Never permit direct-to-seller courier settlement.

## Full refund

1. Confirm the request is before shipment with valid cancellation, or within 48 hours of delivery with one allowed problem reason.
2. Finance approves or rejects with a documented reason. Approval does not itself claim provider success.
3. Submit the full buyer total through the approved provider/bank process, then record success with the external reference. The ledger appends the negative refund and commission reversal.
4. If shipped, keep stock unavailable. Only after documented receipt and inspection may operations record restoration; the service appends a `RESTOCKED` movement.

## Weekly payout

1. Reconcile incoming funds and resolve every exception.
2. Confirm completion, expiry of the 48-hour window, no open dispute, exact matched settlement, and an active destination beyond its hold.
3. A `PAYOUT_CREATE` operator creates a batch from explicit order IDs.
4. A different `PAYOUT_APPROVE` operator reviews seller, masked destination, amount, reconciliation evidence, and liabilities before approval.
5. Execute the bank/wallet transfer using the approved controlled process and append payout references. Do not mark a batch paid from an instruction file or spreadsheet alone.
6. Compare batch total, bank debit, payout entries, and remaining seller liability. Escalate any difference and stop the next batch.

## Daily first-money review

For the first five PayFast live orders and all orders in the first live week, manually review the order snapshot, stock movements, payment events, settlement, shipment evidence, dispute state, financial entries, and payout eligibility. The first week is capped at ten total live orders. Raise the cap only after seven clean days and a signed reconciliation.

Admin reporting uses domain tables for financial truth. Analytics events support funnels and retention but never override orders, settlements, or the ledger. Always say **contribution margin**, not profit.
