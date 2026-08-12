import { HttpException, HttpStatus } from '@nestjs/common';
import type { CommerceErrorCode } from '@thriftage/shared';
import { ZodError } from 'zod';

const definitions: Record<
  CommerceErrorCode,
  { readonly message: string; readonly status: HttpStatus }
> = {
  ADDRESS_FORBIDDEN: { message: 'You cannot access this address.', status: HttpStatus.FORBIDDEN },
  ADDRESS_INVALID: { message: 'Check the delivery address.', status: HttpStatus.BAD_REQUEST },
  ADDRESS_NOT_FOUND: { message: 'Delivery address not found.', status: HttpStatus.NOT_FOUND },
  COMMERCE_SERVICE_ERROR: {
    message: 'Commerce is temporarily unavailable.',
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
  COMMERCE_VALIDATION_FAILED: {
    message: 'Check the commerce request.',
    status: HttpStatus.BAD_REQUEST,
  },
  LISTING_NOT_AVAILABLE: {
    message: 'This item is no longer available.',
    status: HttpStatus.CONFLICT,
  },
  ORDER_FORBIDDEN: { message: 'You cannot access this order.', status: HttpStatus.FORBIDDEN },
  ORDER_INVALID_TRANSITION: {
    message: 'This order action is not available.',
    status: HttpStatus.CONFLICT,
  },
  ORDER_NOT_CANCELLABLE: {
    message: 'This order can no longer be cancelled.',
    status: HttpStatus.CONFLICT,
  },
  ORDER_NOT_FOUND: { message: 'Order not found.', status: HttpStatus.NOT_FOUND },
  PAYMENT_FAILED: { message: 'Payment could not be completed.', status: HttpStatus.CONFLICT },
  PAYMENT_PROVIDER_UNAVAILABLE: {
    message: 'Payment provider is unavailable.',
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
  SELF_PURCHASE_NOT_ALLOWED: {
    message: 'You cannot purchase your own listing.',
    status: HttpStatus.CONFLICT,
  },
  SHIPMENT_INVALID_STATE: {
    message: 'Shipment cannot be updated in this state.',
    status: HttpStatus.CONFLICT,
  },
};

export class CommerceDomainError extends Error {
  public constructor(public readonly code: CommerceErrorCode) {
    super(code);
    this.name = 'CommerceDomainError';
  }
}

export class CommerceApiException extends HttpException {
  public constructor(public readonly code: CommerceErrorCode) {
    const definition = definitions[code];
    super({ code, message: definition.message, statusCode: definition.status }, definition.status);
  }
}

export function mapCommerceError(error: unknown): CommerceApiException {
  if (error instanceof CommerceApiException) return error;
  if (error instanceof CommerceDomainError) return new CommerceApiException(error.code);
  if (error instanceof ZodError) return new CommerceApiException('COMMERCE_VALIDATION_FAILED');
  return new CommerceApiException('COMMERCE_SERVICE_ERROR');
}
