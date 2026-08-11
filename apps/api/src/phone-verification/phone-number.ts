import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

import { PhoneVerificationDomainError } from './phone-verification.errors';

export function normalizePhoneNumber(input: string): string {
  const phoneNumber = parsePhoneNumberFromString(input.trim());
  if (phoneNumber === undefined || !phoneNumber.isValid()) {
    throw new PhoneVerificationDomainError(
      'PHONE_INVALID',
      'Enter a valid international phone number.',
    );
  }
  return phoneNumber.number;
}

export function maskPhoneNumber(normalizedPhone: string): string {
  const phoneNumber = parsePhoneNumberFromString(normalizedPhone);
  if (phoneNumber === undefined || !phoneNumber.isValid()) {
    throw new PhoneVerificationDomainError('PHONE_INVALID', 'Phone number is invalid.');
  }

  const visibleSuffixLength = Math.min(4, phoneNumber.nationalNumber.length);
  const hiddenLength = Math.max(2, phoneNumber.nationalNumber.length - visibleSuffixLength);
  return `+${phoneNumber.countryCallingCode}${'*'.repeat(hiddenLength)}${phoneNumber.nationalNumber.slice(-visibleSuffixLength)}`;
}
