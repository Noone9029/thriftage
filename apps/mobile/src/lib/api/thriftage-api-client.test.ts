import { describe, expect, it, vi } from 'vitest';

import { ThriftageApiClient, type ApiSessionProvider } from './thriftage-api-client';

const account = {
  accountStatus: 'ACTIVE',
  createdAt: '2026-08-10T00:00:00.000Z',
  email: 'user@example.com',
  emailVerified: true,
  fullName: 'Ayesha Khan',
  id: 'f4a24a69-563f-4d76-a657-2f672b2789d2',
  phone: null,
  phoneVerified: false,
  role: 'USER',
  updatedAt: '2026-08-10T00:00:00.000Z',
};

const profile = {
  bio: null,
  completedSalesCount: 0,
  id: account.id,
  memberSince: account.createdAt,
  profileImageUrl: null,
  university: null,
  updatedAt: account.updatedAt,
  username: 'ayesha_khan',
};
const publicProfile = {
  bio: profile.bio,
  completedSalesCount: profile.completedSalesCount,
  id: profile.id,
  memberSince: profile.memberSince,
  profileImageUrl: profile.profileImageUrl,
  university: profile.university,
  username: profile.username,
};

class TestSessionProvider implements ApiSessionProvider {
  public accessToken: string | null = 'access-token';
  public refreshedToken: string | null = 'refreshed-token';
  public readonly refreshAccessToken = vi.fn(async () => {
    this.accessToken = this.refreshedToken;
    return this.refreshedToken;
  });
  public readonly sessionBecameInvalid = vi.fn();

  public async getAccessToken(): Promise<string | null> {
    return this.accessToken;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

describe('ThriftageApiClient', () => {
  it('attaches the current bearer token to authenticated requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(account));
    const client = new ThriftageApiClient(
      'https://api.example.com/api/v1',
      new TestSessionProvider(),
      fetchMock as unknown as typeof fetch,
    );

    await client.getCurrentAccount();
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).get('Authorization')).toBe('Bearer access-token');
  });

  it('omits authorization for explicitly public requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }));
    const client = new ThriftageApiClient(
      'https://api.example.com/api/v1',
      new TestSessionProvider(),
      fetchMock as unknown as typeof fetch,
    );

    await client.getHealth();
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).has('Authorization')).toBe(false);
  });

  it('decodes stable backend errors and preserves machine codes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ code: 'AUTH_IDENTITY_CONFLICT', message: 'hidden detail' }, 409),
      );
    const client = new ThriftageApiClient(
      'https://api.example.com/api/v1',
      new TestSessionProvider(),
      fetchMock as unknown as typeof fetch,
    );

    await expect(client.provisionUser('Ayesha Khan')).rejects.toMatchObject({
      code: 'AUTH_IDENTITY_CONFLICT',
      message: 'Authentication request failed.',
    });
  });

  it('refreshes and retries an expired token at most once', async () => {
    const session = new TestSessionProvider();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 'AUTH_EXPIRED_TOKEN' }, 401))
      .mockResolvedValueOnce(jsonResponse(account));
    const client = new ThriftageApiClient(
      'https://api.example.com/api/v1',
      session,
      fetchMock as unknown as typeof fetch,
    );

    await expect(client.getCurrentAccount()).resolves.toMatchObject({ id: account.id });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(session.refreshAccessToken).toHaveBeenCalledOnce();
  });

  it('does not enter a retry loop and signs out after failed refresh', async () => {
    const session = new TestSessionProvider();
    session.refreshedToken = null;
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => jsonResponse({ code: 'AUTH_INVALID_TOKEN' }, 401));
    const client = new ThriftageApiClient(
      'https://api.example.com/api/v1',
      session,
      fetchMock as unknown as typeof fetch,
    );

    await expect(client.getCurrentAccount()).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(session.sessionBecameInvalid).toHaveBeenCalledOnce();
  });

  it('signs out when the retried request still rejects the refreshed token', async () => {
    const session = new TestSessionProvider();
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => jsonResponse({ code: 'AUTH_INVALID_TOKEN' }, 401));
    const client = new ThriftageApiClient(
      'https://api.example.com/api/v1',
      session,
      fetchMock as unknown as typeof fetch,
    );

    await expect(client.getCurrentAccount()).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(session.refreshAccessToken).toHaveBeenCalledOnce();
    expect(session.sessionBecameInvalid).toHaveBeenCalledOnce();
  });

  it.each(['ACCOUNT_SUSPENDED', 'ACCOUNT_DEACTIVATED'] as const)(
    'does not refresh or retry %s',
    async (code) => {
      const session = new TestSessionProvider();
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ code }, 403));
      const client = new ThriftageApiClient(
        'https://api.example.com/api/v1',
        session,
        fetchMock as unknown as typeof fetch,
      );

      await expect(client.getCurrentAccount()).rejects.toMatchObject({ code });
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(session.refreshAccessToken).not.toHaveBeenCalled();
    },
  );

  it('does not expose a caller-controlled user id or auth subject', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(account));
    const client = new ThriftageApiClient(
      'https://api.example.com/api/v1',
      new TestSessionProvider(),
      fetchMock as unknown as typeof fetch,
    );
    await client.provisionUser('Ayesha Khan');

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({ fullName: 'Ayesha Khan' });
    expect(new Headers(request.headers).has('X-User-Id')).toBe(false);
  });

  it('uses server-owned profile routes and leaves public lookup unauthenticated', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(profile))
      .mockResolvedValueOnce(jsonResponse(publicProfile));
    const client = new ThriftageApiClient(
      'https://api.example.com/api/v1',
      new TestSessionProvider(),
      fetchMock as unknown as typeof fetch,
    );

    await client.updateProfile({ bio: 'Vintage finds' });
    await client.getPublicProfile('ayesha_khan');

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.example.com/api/v1/profiles/me');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      body: JSON.stringify({ bio: 'Vintage finds' }),
      method: 'PATCH',
    });
    expect(
      new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).has('Authorization'),
    ).toBe(false);
  });

  it('does not set a JSON content type for controlled profile image multipart upload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(profile));
    const client = new ThriftageApiClient(
      'https://api.example.com/api/v1',
      new TestSessionProvider(),
      fetchMock as unknown as typeof fetch,
    );
    const form = new FormData();

    await client.uploadProfileImage(form);

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(request.body).toBe(form);
    expect(new Headers(request.headers).has('Content-Type')).toBe(false);
  });
});
