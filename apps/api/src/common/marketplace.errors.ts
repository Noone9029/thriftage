import { HttpException, HttpStatus } from '@nestjs/common';
import type { MarketplaceErrorCode } from '@thriftage/shared';
import { ZodError } from 'zod';

const definitions: Record<
  MarketplaceErrorCode,
  { readonly message: string; readonly status: HttpStatus }
> = {
  CATEGORY_IN_USE: {
    message: 'This category is still used by marketplace inventory.',
    status: HttpStatus.CONFLICT,
  },
  CATEGORY_NOT_FOUND: { message: 'Category not found.', status: HttpStatus.NOT_FOUND },
  CATEGORY_SLUG_UNAVAILABLE: {
    message: 'This category slug is already in use.',
    status: HttpStatus.CONFLICT,
  },
  CATEGORY_UNAVAILABLE: {
    message: 'Select an active marketplace category.',
    status: HttpStatus.CONFLICT,
  },
  DUPLICATE_REPORT: {
    message: 'You already have an open report for this target.',
    status: HttpStatus.CONFLICT,
  },
  IMAGE_INVALID: {
    message: 'Upload a valid single-page JPEG, PNG, or WebP image.',
    status: HttpStatus.BAD_REQUEST,
  },
  IMAGE_LIMIT_REACHED: {
    message: 'A listing may contain at most 10 images.',
    status: HttpStatus.CONFLICT,
  },
  IMAGE_NOT_FOUND: { message: 'Listing image not found.', status: HttpStatus.NOT_FOUND },
  IMAGE_TOO_LARGE: {
    message: 'Listing images must be no larger than 5 MB.',
    status: HttpStatus.PAYLOAD_TOO_LARGE,
  },
  LISTING_FORBIDDEN: {
    message: 'You are not allowed to change this listing.',
    status: HttpStatus.FORBIDDEN,
  },
  LISTING_NOT_EDITABLE: {
    message: 'Only draft or rejected listings may be edited.',
    status: HttpStatus.CONFLICT,
  },
  LISTING_NOT_FOUND: { message: 'Listing not found.', status: HttpStatus.NOT_FOUND },
  LISTING_NOT_PUBLIC: {
    message: 'This listing is not publicly available.',
    status: HttpStatus.NOT_FOUND,
  },
  LISTING_REQUIRES_IMAGES: {
    message: 'Add between 3 and 10 images before submitting this listing.',
    status: HttpStatus.CONFLICT,
  },
  LISTING_TRANSITION_INVALID: {
    message: 'This listing status change is not allowed.',
    status: HttpStatus.CONFLICT,
  },
  MARKETPLACE_SERVICE_ERROR: {
    message: 'Marketplace service is temporarily unavailable.',
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
  MEDIA_STORAGE_ERROR: {
    message: 'Listing media storage is temporarily unavailable.',
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
  REPORT_NOT_FOUND: { message: 'Report not found.', status: HttpStatus.NOT_FOUND },
  SELLER_NOT_FOUND: { message: 'Seller not found.', status: HttpStatus.NOT_FOUND },
  SELF_INTERACTION_FORBIDDEN: {
    message: 'You cannot perform this action on your own marketplace content.',
    status: HttpStatus.CONFLICT,
  },
  VALIDATION_FAILED: { message: 'Request validation failed.', status: HttpStatus.BAD_REQUEST },
};

export class MarketplaceDomainError extends Error {
  public constructor(public readonly code: MarketplaceErrorCode) {
    super(code);
    this.name = 'MarketplaceDomainError';
  }
}

export class MarketplaceApiException extends HttpException {
  public constructor(public readonly code: MarketplaceErrorCode) {
    const definition = definitions[code];
    super({ code, message: definition.message, statusCode: definition.status }, definition.status);
  }
}

export function mapMarketplaceError(error: unknown): MarketplaceApiException {
  if (error instanceof MarketplaceApiException) return error;
  if (error instanceof MarketplaceDomainError) return new MarketplaceApiException(error.code);
  if (error instanceof ZodError) return new MarketplaceApiException('VALIDATION_FAILED');
  return new MarketplaceApiException('MARKETPLACE_SERVICE_ERROR');
}
