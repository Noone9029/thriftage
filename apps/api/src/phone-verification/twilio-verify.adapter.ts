import { loadApiConfig } from '@thriftage/config/api';
import twilio from 'twilio';

import {
  PhoneVerificationProviderError,
  type PhoneVerificationProvider,
} from './phone-verification-provider.interface';

export interface TwilioVerifyClient {
  checkVerification(phone: string, code: string): Promise<{ readonly status: string }>;
  sendVerification(
    phone: string,
  ): Promise<{ readonly sid?: string | null; readonly status: string }>;
}

const rateLimitCodes = new Set([60202, 60203, 60207, 60624, 60626]);
const expiredCodes = new Set([20404, 60623]);

function numericProperty(error: unknown, property: 'code' | 'status'): number | null {
  if (typeof error !== 'object' || error === null || !(property in error)) return null;
  const value = (error as Record<string, unknown>)[property];
  return typeof value === 'number' ? value : null;
}

function mapProviderError(error: unknown): PhoneVerificationProviderError {
  const code = numericProperty(error, 'code');
  const status = numericProperty(error, 'status');
  if ((code !== null && rateLimitCodes.has(code)) || status === 429) {
    return new PhoneVerificationProviderError('RATE_LIMITED');
  }
  if (code !== null && expiredCodes.has(code)) {
    return new PhoneVerificationProviderError('EXPIRED');
  }
  return new PhoneVerificationProviderError('PROVIDER_ERROR');
}

export class TwilioVerifyAdapter implements PhoneVerificationProvider {
  public constructor(private readonly configuredClient?: TwilioVerifyClient) {}

  private getClient(): TwilioVerifyClient {
    if (this.configuredClient !== undefined) return this.configuredClient;
    const config = loadApiConfig(process.env);
    const { twilioAccountSid, twilioApiKeySecret, twilioApiKeySid, twilioVerifyServiceSid } =
      config;
    if (
      !config.phoneAuthEnabled ||
      twilioAccountSid === undefined ||
      twilioApiKeySecret === undefined ||
      twilioApiKeySid === undefined ||
      twilioVerifyServiceSid === undefined
    ) {
      throw new PhoneVerificationProviderError('PROVIDER_ERROR');
    }
    const client = twilio(twilioApiKeySid, twilioApiKeySecret, {
      accountSid: twilioAccountSid,
    });
    const service = client.verify.v2.services(twilioVerifyServiceSid);
    return {
      checkVerification: async (phone, code) =>
        service.verificationChecks.create({ code, to: phone }),
      sendVerification: async (phone) =>
        service.verifications.create({ channel: 'sms', to: phone }),
    };
  }

  public async sendVerification(phone: string) {
    try {
      const result = await this.getClient().sendVerification(phone);
      if (result.status.toLowerCase() !== 'pending') {
        throw new PhoneVerificationProviderError('PROVIDER_ERROR');
      }
      return {
        providerReference: result.sid?.trim() || null,
        status: 'PENDING' as const,
      };
    } catch (error: unknown) {
      if (error instanceof PhoneVerificationProviderError) throw error;
      throw mapProviderError(error);
    }
  }

  public async verifyCode(phone: string, code: string) {
    try {
      const result = await this.getClient().checkVerification(phone, code);
      switch (result.status.toLowerCase()) {
        case 'approved':
          return { status: 'APPROVED' as const };
        case 'pending':
          return { status: 'INVALID' as const };
        case 'expired':
        case 'canceled':
        case 'max_attempts_reached':
          return { status: 'EXPIRED' as const };
        default:
          throw new PhoneVerificationProviderError('PROVIDER_ERROR');
      }
    } catch (error: unknown) {
      if (error instanceof PhoneVerificationProviderError) throw error;
      throw mapProviderError(error);
    }
  }
}

export function createTwilioVerifyAdapter(): TwilioVerifyAdapter {
  return new TwilioVerifyAdapter();
}
