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
const stylistListing = {
  activatedAt: account.createdAt,
  archivedAt: null,
  brand: null,
  category: {
    description: null,
    id: '98e72de2-657a-4f94-b606-d7dfc55f6980',
    isActive: true,
    name: 'Shoes',
    parentId: null,
    slug: 'shoes',
    sortOrder: 20,
  },
  color: 'Black',
  condition: 'GOOD',
  createdAt: account.createdAt,
  currency: 'PKR',
  description: 'Marketplace listing data.',
  id: '0feeea8c-0345-4672-b044-76c44cb3dbb5',
  images: [],
  likeCount: 0,
  likedByViewer: false,
  match: null,
  moderatedAt: account.createdAt,
  personalization: {
    colorFamily: 'BLACK',
    fitType: 'REGULAR',
    garmentRole: 'SHOES',
    sizeCompatibilityKey: '42',
    sizeSystem: 'EU',
    styles: [],
  },
  priceMinor: 300_000,
  rejectionReason: null,
  saveCount: 0,
  savedByViewer: false,
  seller: {
    id: '38d69ce0-af68-4e3a-bcfe-62137ccbfa50',
    profileImageUrl: null,
    sellerRating: {
      average: 4.5,
      count: 2,
      distribution: { '1': 0, '2': 0, '3': 0, '4': 1, '5': 1 },
    },
    sellerVerified: true,
    username: 'closet_pk',
  },
  size: '42',
  status: 'ACTIVE',
  submittedAt: account.createdAt,
  title: 'Black sneakers',
  updatedAt: account.updatedAt,
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

  it('validates public runtime flags without sending a bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        environment: 'staging',
        features: {
          accountDeletion: true,
          aiStylist: false,
          phoneAuth: true,
          pushNotifications: false,
          registration: true,
          sellerVerification: true,
        },
        links: {
          accountDeletion: 'https://privacy.example.com/delete-account',
          communityGuidelines: 'https://legal.example.com/community',
          privacyPolicy: 'https://legal.example.com/privacy',
          support: 'https://support.example.com',
          termsOfUse: 'https://legal.example.com/terms',
        },
        releaseVersion: 'abc123',
      }),
    );
    const client = new ThriftageApiClient(
      'https://api.example.com/api/v1',
      new TestSessionProvider(),
      fetchMock as unknown as typeof fetch,
    );

    await expect(client.getRuntimeConfig()).resolves.toMatchObject({
      environment: 'staging',
      features: { aiStylist: false, registration: true },
    });
    expect(
      new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).has('Authorization'),
    ).toBe(false);
  });

  it('uses idempotent authenticated marketplace action endpoints', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ active: true, count: 1 }));
    const client = new ThriftageApiClient(
      'https://api.example.com/api/v1',
      new TestSessionProvider(),
      fetchMock as unknown as typeof fetch,
    );
    const listingId = '0feeea8c-0345-4672-b044-76c44cb3dbb5';

    await expect(client.setSaved(listingId, true)).resolves.toEqual({ active: true, count: 1 });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `https://api.example.com/api/v1/listings/${listingId}/save`,
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('PUT');
    expect(
      new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get('Authorization'),
    ).toBe('Bearer access-token');
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

  it('sends idempotent Stylist generations with cancellation and no provider credentials', async () => {
    const conversationId = '89b7f85e-c62c-4c14-b54b-5b5652cf6718';
    const generationId = '2ce24594-00ee-455c-bf36-c9a4afc78b39';
    const requestId = '0a5b5558-7856-4719-9811-6f42fdf27ad5';
    const now = '2026-08-13T20:00:00.000Z';
    const response = {
      conversation: {
        archivedAt: null,
        createdAt: now,
        id: conversationId,
        preview: 'Build me a university outfit.',
        title: 'University outfit',
        updatedAt: now,
      },
      message: {
        assistantPayload: {
          fallbackUsed: true,
          generationId,
          kind: 'OUTFITS',
          outfits: [
            {
              currency: 'PKR',
              explanation: 'A grounded sneaker anchor from current inventory.',
              id: 'fd0a754f-71c9-421c-a5e9-b59d4e9f0bb7',
              items: [
                {
                  available: true,
                  listing: stylistListing,
                  position: 0,
                  role: 'SHOES',
                  uncertainConstraints: [],
                },
              ],
              matchScore: 82,
              title: 'Campus sneakers',
              totalPriceMinor: 300_000,
              unmetConstraints: [],
            },
          ],
          promptVersion: 'thriftage-stylist-v1',
          quickRefinements: ['ANOTHER_OPTION'],
        },
        content: 'No eligible pieces matched yet.',
        createdAt: now,
        id: '0aa5a5a9-f881-4c6a-9532-3c8f8019fd33',
        role: 'ASSISTANT',
      },
      status: 'FALLBACK',
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));
    const client = new ThriftageApiClient(
      'https://api.example.com/api/v1',
      new TestSessionProvider(),
      fetchMock as unknown as typeof fetch,
    );
    const controller = new AbortController();

    await expect(
      client.sendStylistMessage(
        conversationId,
        { body: 'Build me a university outfit.', requestId },
        controller.signal,
      ),
    ).resolves.toMatchObject({
      message: {
        assistantPayload: {
          outfits: [{ items: [{ available: true }], title: 'Campus sneakers' }],
        },
      },
      status: 'FALLBACK',
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `https://api.example.com/api/v1/ai-stylist/conversations/${conversationId}/messages`,
    );
    expect(request.signal).toBe(controller.signal);
    expect(JSON.parse(String(request.body))).toEqual({
      body: 'Build me a university outfit.',
      requestId,
    });
    expect(new Headers(request.headers).has('X-OpenAI-Key')).toBe(false);
  });

  it('records only server-validated Stylist attribution fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new ThriftageApiClient(
      'https://api.example.com/api/v1',
      new TestSessionProvider(),
      fetchMock as unknown as typeof fetch,
    );
    const input = {
      event: 'OPEN' as const,
      generationId: '2ce24594-00ee-455c-bf36-c9a4afc78b39',
      listingId: '0feeea8c-0345-4672-b044-76c44cb3dbb5',
    };

    await expect(client.recordStylistAttribution(input)).resolves.toBeUndefined();

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.example.com/api/v1/ai-stylist/attribution',
    );
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual(input);
  });

  it('preserves stable Stylist rate-limit and ownership errors for mobile recovery UX', async () => {
    const session = new TestSessionProvider();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 'AI_RATE_LIMITED' }, 429))
      .mockResolvedValueOnce(jsonResponse({ code: 'AI_CONVERSATION_FORBIDDEN' }, 403));
    const client = new ThriftageApiClient(
      'https://api.example.com/api/v1',
      session,
      fetchMock as unknown as typeof fetch,
    );

    await expect(
      client.getStylistConversation('89b7f85e-c62c-4c14-b54b-5b5652cf6718'),
    ).rejects.toMatchObject({
      code: 'AI_RATE_LIMITED',
      status: 429,
    });
    await expect(
      client.getStylistConversation('89b7f85e-c62c-4c14-b54b-5b5652cf6718'),
    ).rejects.toMatchObject({
      code: 'AI_CONVERSATION_FORBIDDEN',
      status: 403,
    });
    expect(session.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('starts anchored conversations and parses unavailable saved-outfit history', async () => {
    const now = '2026-08-13T20:00:00.000Z';
    const conversationId = '89b7f85e-c62c-4c14-b54b-5b5652cf6718';
    const listingId = '0feeea8c-0345-4672-b044-76c44cb3dbb5';
    const conversation = {
      archivedAt: null,
      createdAt: now,
      id: conversationId,
      messages: [],
      preview: null,
      title: 'Style this item',
      updatedAt: now,
    };
    const saved = {
      createdAt: now,
      id: '3783f205-0107-4a5e-b6fc-05a644e3dc14',
      items: [
        {
          available: false,
          id: 'a58bb2dd-f12c-421b-b54d-ed555e4a2200',
          listing: null,
          listingReferenceId: listingId,
          position: 0,
          role: 'OUTERWEAR',
        },
      ],
      sourceGenerationId: null,
      sourceOutfitId: '006e9775-9f4a-48e5-8432-1f5dd6f0920f',
      title: 'Saved layered look',
      updatedAt: now,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(conversation))
      .mockResolvedValueOnce(jsonResponse({ items: [saved], nextCursor: null }));
    const client = new ThriftageApiClient(
      'https://api.example.com/api/v1',
      new TestSessionProvider(),
      fetchMock as unknown as typeof fetch,
    );

    await expect(
      client.createStylistConversation({ anchorListingId: listingId }),
    ).resolves.toMatchObject({
      id: conversationId,
    });
    await expect(client.getSavedStylistOutfits()).resolves.toMatchObject({
      items: [{ items: [{ available: false, listing: null }] }],
    });

    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      anchorListingId: listingId,
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://api.example.com/api/v1/ai-stylist/saved-outfits',
    );
  });
});
