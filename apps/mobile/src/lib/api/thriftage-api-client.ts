import { privateUserAccountSchema, type PrivateUserAccount } from '@thriftage/shared';

import { decodeApiError, MobileApiError } from './mobile-api-error';

export interface ApiSessionProvider {
  getAccessToken(): Promise<string | null>;
  refreshAccessToken(): Promise<string | null>;
  sessionBecameInvalid(): void;
}

interface RequestOptions {
  readonly authenticated?: boolean;
  readonly body?: unknown;
  readonly method?: 'GET' | 'POST';
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
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    if (accessToken !== null) headers.set('Authorization', `Bearer ${accessToken}`);
    const response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
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
