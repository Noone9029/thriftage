export const PHONE_VERIFICATION_PROVIDER = Symbol('PHONE_VERIFICATION_PROVIDER');

export interface PhoneVerificationSendResult {
  readonly providerReference: string | null;
  readonly status: 'PENDING';
}

export interface PhoneVerificationCheckResult {
  readonly status: 'APPROVED' | 'INVALID' | 'EXPIRED';
}

export interface PhoneVerificationProvider {
  sendVerification(phone: string): Promise<PhoneVerificationSendResult>;
  verifyCode(phone: string, code: string): Promise<PhoneVerificationCheckResult>;
}

export type PhoneVerificationProviderFailureCode = 'RATE_LIMITED' | 'EXPIRED' | 'PROVIDER_ERROR';

export class PhoneVerificationProviderError extends Error {
  public constructor(public readonly code: PhoneVerificationProviderFailureCode) {
    super('Phone verification provider request failed.');
    this.name = 'PhoneVerificationProviderError';
  }
}
