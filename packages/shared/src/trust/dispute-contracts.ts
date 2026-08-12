import { z } from 'zod';

export const disputeReasonValues = [
  'ITEM_NOT_RECEIVED',
  'ITEM_NOT_AS_DESCRIBED',
  'DAMAGED_ITEM',
  'COUNTERFEIT_SUSPECTED',
  'DELIVERY_PROBLEM',
  'PAYMENT_OR_COD_ISSUE',
  'HARASSMENT_OR_SAFETY',
  'OTHER',
] as const;
export const disputeStatusValues = [
  'OPEN',
  'UNDER_REVIEW',
  'AWAITING_INFORMATION',
  'RESOLVED',
  'REJECTED',
  'CLOSED',
] as const;
export const disputeCreateInputSchema = z.strictObject({
  orderId: z.string().uuid(),
  reason: z.enum(disputeReasonValues),
  description: z.string().trim().min(20).max(3000),
});
export const disputeEvidenceSchema = z.strictObject({
  id: z.string().uuid(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  createdAt: z.string().datetime({ offset: true }),
  url: z.string().url(),
});
export const disputeEventSchema = z.strictObject({
  id: z.string().uuid(),
  type: z.enum([
    'OPENED',
    'EVIDENCE_ADDED',
    'STATUS_CHANGED',
    'INFORMATION_REQUESTED',
    'RESOLUTION_RECORDED',
    'INTERNAL_NOTE',
  ]),
  visibility: z.enum(['PARTICIPANTS', 'INTERNAL']),
  message: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  actorId: z.string().uuid().nullable(),
});
export const disputeSummarySchema = z.strictObject({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  orderNumber: z.string(),
  openerId: z.string().uuid(),
  counterpartyId: z.string().uuid(),
  reason: z.enum(disputeReasonValues),
  status: z.enum(disputeStatusValues),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export const disputeDetailSchema = disputeSummarySchema.extend({
  description: z.string(),
  resolution: z.string().nullable(),
  listingTitle: z.string(),
  paymentStatus: z.string(),
  shipmentStatus: z.string(),
  evidence: z.array(disputeEvidenceSchema),
  timeline: z.array(disputeEventSchema),
});
export const disputePageSchema = z.strictObject({
  items: z.array(disputeSummarySchema),
  nextCursor: z.string().nullable(),
});
export const disputeAdminActionSchema = z.strictObject({
  action: z.enum([
    'START_REVIEW',
    'REQUEST_INFORMATION',
    'RESOLVE',
    'REJECT',
    'CLOSE',
    'REOPEN',
    'ADD_INTERNAL_NOTE',
  ]),
  note: z.string().trim().min(3).max(2000),
  resolution: z.string().trim().min(3).max(2000).optional(),
});
export const disputeQuerySchema = z.strictObject({
  status: z.enum(disputeStatusValues).optional(),
  query: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type DisputeCreateInput = z.infer<typeof disputeCreateInputSchema>;
export type DisputeAdminAction = z.infer<typeof disputeAdminActionSchema>;
export type DisputeDetail = z.infer<typeof disputeDetailSchema>;
export type DisputePage = z.infer<typeof disputePageSchema>;
export type DisputeEvidence = z.infer<typeof disputeEvidenceSchema>;
