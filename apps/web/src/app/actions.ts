'use server';

import { headers } from 'next/headers';
import { ZodError } from 'zod';

import {
  MarketingLeadRateLimitError,
  MarketingLeadUnavailableError,
  submitBetaLead,
  submitSellerLead,
} from '../lib/marketing-leads';
import type { MarketingFormState } from '../lib/marketing-form-state';

function value(formData: FormData, key: string): string | undefined {
  const field = formData.get(key);
  return typeof field === 'string' ? field : undefined;
}

async function requestFingerprint(): Promise<string> {
  const requestHeaders = await headers();
  const forwarded =
    requestHeaders.get('x-vercel-forwarded-for') ??
    requestHeaders.get('x-forwarded-for') ??
    requestHeaders.get('x-real-ip') ??
    'unknown';
  const firstAddress = forwarded.split(',')[0]?.trim() || 'unknown';
  const userAgent = requestHeaders.get('user-agent')?.slice(0, 300) ?? 'unknown';
  return `${firstAddress}|${userAgent}`;
}

function success(status: 'CREATED' | 'ALREADY_REGISTERED'): MarketingFormState {
  return status === 'CREATED'
    ? {
        fieldErrors: {},
        message: "You're on the list. We'll be in touch when your beta place is ready.",
        status: 'SUCCESS',
      }
    : {
        fieldErrors: {},
        message: "You're already on this list. No need to submit again.",
        status: 'DUPLICATE',
      };
}

function failure(error: unknown): MarketingFormState {
  if (error instanceof ZodError) {
    return {
      fieldErrors: error.flatten().fieldErrors,
      message: 'Check the highlighted fields and try again.',
      status: 'VALIDATION_ERROR',
    };
  }
  if (error instanceof MarketingLeadRateLimitError) {
    return {
      fieldErrors: {},
      message: 'Too many submissions were received from this connection. Try again later.',
      status: 'RATE_LIMITED',
    };
  }
  if (error instanceof MarketingLeadUnavailableError) {
    return {
      fieldErrors: {},
      message: 'The form is temporarily unavailable. Please try again shortly.',
      status: 'ERROR',
    };
  }
  return {
    fieldErrors: {},
    message: 'Something went wrong. Please try again.',
    status: 'ERROR',
  };
}

export async function submitBetaInterestAction(
  _previous: MarketingFormState,
  formData: FormData,
): Promise<MarketingFormState> {
  try {
    const receipt = await submitBetaLead(
      {
        audience: value(formData, 'audience'),
        city: value(formData, 'city'),
        email: value(formData, 'email'),
        source: 'public-web:/beta',
        styleInterest: value(formData, 'styleInterest'),
        website: value(formData, 'website'),
      },
      await requestFingerprint(),
    );
    return success(receipt.status);
  } catch (error: unknown) {
    return failure(error);
  }
}

export async function submitSellerInterestAction(
  _previous: MarketingFormState,
  formData: FormData,
): Promise<MarketingFormState> {
  try {
    const receipt = await submitSellerLead(
      {
        city: value(formData, 'city'),
        email: value(formData, 'email'),
        itemVolume: value(formData, 'itemVolume'),
        message: value(formData, 'message'),
        name: value(formData, 'name'),
        sellerType: value(formData, 'sellerType'),
        source: 'public-web:/sell',
        storeUrl: value(formData, 'storeUrl'),
        website: value(formData, 'website'),
      },
      await requestFingerprint(),
    );
    return success(receipt.status);
  } catch (error: unknown) {
    return failure(error);
  }
}
