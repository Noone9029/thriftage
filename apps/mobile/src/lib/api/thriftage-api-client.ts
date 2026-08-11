import {
  phoneVerificationChallengeSchema,
  privateUserAccountSchema,
  privateUserProfileSchema,
  publicUserProfileSchema,
  usernameAvailabilitySchema,
  type PhoneVerificationChallenge,
  type PrivateUserAccount,
  type PrivateUserProfile,
  type ProfileCreateInput,
  type ProfileUpdateInput,
  type PublicUserProfile,
  type UsernameAvailability,
} from '@thriftage/shared';

import { decodeApiError, MobileApiError } from './mobile-api-error';

export interface ApiSessionProvider {
  getAccessToken(): Promise<string | null>;
  refreshAccessToken(): Promise<string | null>;
  sessionBecameInvalid(): void;
}

interface RequestOptions {
  readonly authenticated?: boolean;
  readonly body?: unknown;
  readonly method?: 'DELETE' | 'GET' | 'PATCH' | 'POST';
}

const refreshableCodes = new Set(['AUTH_EXPIRED_TOKEN', 'AUTH_INVALID_TOKEN']);

export class ThriftageApiClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly sessionProvider: ApiSessionProvider,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  public async getCurrentAccount(): Promise<PrivateUserAccount> {
    return privateUserAccountSchema.parse(await this.request('/auth/me'));
  }

  public async provisionUser(fullName: string): Promise<PrivateUserAccount> {
    return privateUserAccountSchema.parse(
      await this.request('/auth/provision', { body: { fullName }, method: 'POST' }),
    );
  }

  public async getHealth(): Promise<unknown> {
    return this.request('/health', { authenticated: false });
  }

  public async getCurrentPhoneVerification(): Promise<PhoneVerificationChallenge | null> {
    const result = await this.request('/auth/phone-verification/current');
    return result === null ? null : phoneVerificationChallengeSchema.parse(result);
  }

  public async startPhoneVerification(phone: string): Promise<PhoneVerificationChallenge> {
    return phoneVerificationChallengeSchema.parse(
      await this.request('/auth/phone-verification/start', { body: { phone }, method: 'POST' }),
    );
  }

  public async verifyPhone(attemptId: string, code: string): Promise<PrivateUserAccount> {
    return privateUserAccountSchema.parse(
      await this.request('/auth/phone-verification/verify', {
        body: { attemptId, code },
        method: 'POST',
      }),
    );
  }

  public async resendPhoneVerification(attemptId: string): Promise<PhoneVerificationChallenge> {
    return phoneVerificationChallengeSchema.parse(
      await this.request(`/auth/phone-verification/${attemptId}/resend`, { method: 'POST' }),
    );
  }

  public async cancelPhoneVerification(): Promise<void> {
    await this.request('/auth/phone-verification/current', { method: 'DELETE' });
  }

  public async getCurrentProfile(): Promise<PrivateUserProfile> {
    return privateUserProfileSchema.parse(await this.request('/profiles/me'));
  }

  public async createProfile(input: ProfileCreateInput): Promise<PrivateUserProfile> {
    return privateUserProfileSchema.parse(
      await this.request('/profiles', { body: input, method: 'POST' }),
    );
  }

  public async updateProfile(input: ProfileUpdateInput): Promise<PrivateUserProfile> {
    return privateUserProfileSchema.parse(
      await this.request('/profiles/me', { body: input, method: 'PATCH' }),
    );
  }

  public async getUsernameAvailability(username: string): Promise<UsernameAvailability> {
    return usernameAvailabilitySchema.parse(
      await this.request(
        `/profiles/username-availability?username=${encodeURIComponent(username)}`,
      ),
    );
  }

  public async getPublicProfile(username: string): Promise<PublicUserProfile> {
    return publicUserProfileSchema.parse(
      await this.request(`/profiles/${encodeURIComponent(username)}`, { authenticated: false }),
    );
  }

  public async uploadProfileImage(form: FormData): Promise<PrivateUserProfile> {
    return privateUserProfileSchema.parse(
      await this.request('/profiles/me/image', { body: form, method: 'POST' }),
    );
  }

  public async removeProfileImage(): Promise<PrivateUserProfile> {
    return privateUserProfileSchema.parse(
      await this.request('/profiles/me/image', { method: 'DELETE' }),
    );
  }

  private async request(
    path: string,
    options: RequestOptions = {},
    mayRefresh = true,
  ): Promise<unknown> {
    const authenticated = options.authenticated ?? true;
    const accessToken = authenticated ? await this.sessionProvider.getAccessToken() : null;
    if (authenticated && accessToken === null) {
      throw new MobileApiError('AUTH_REQUIRED', 'Authentication is required.', 401);
    }

    const headers = new Headers({ Accept: 'application/json' });
    const multipart = typeof FormData !== 'undefined' && options.body instanceof FormData;
    if (options.body !== undefined && !multipart) headers.set('Content-Type', 'application/json');
    if (accessToken !== null) headers.set('Authorization', `Bearer ${accessToken}`);
    const response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
      ...(options.body === undefined
        ? {}
        : { body: multipart ? (options.body as FormData) : JSON.stringify(options.body) }),
      headers,
      method: options.method ?? 'GET',
    });
    if (response.ok) {
      return response.status === 204 ? null : response.json();
    }

    const error = await decodeApiError(response);
    if (authenticated && refreshableCodes.has(error.code) && !mayRefresh) {
      this.sessionProvider.sessionBecameInvalid();
      throw new MobileApiError('AUTH_REQUIRED', 'Authentication is required.', 401);
    }
    if (authenticated && mayRefresh && refreshableCodes.has(error.code)) {
      try {
        const refreshedToken = await this.sessionProvider.refreshAccessToken();
        if (refreshedToken !== null) {
          return this.request(path, options, false);
        }
      } catch {
        // Refresh failure is handled as a local sign-out below.
      }
      this.sessionProvider.sessionBecameInvalid();
      throw new MobileApiError('AUTH_REQUIRED', 'Authentication is required.', 401);
    }
    throw error;
  }
}
