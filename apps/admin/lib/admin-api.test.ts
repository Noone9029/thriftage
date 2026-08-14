import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminApi } from './admin-api';

const configuration = {
  dailyBudgetMicroUsd: 250_000,
  dailyUserLimit: 20,
  enabled: true,
  evalVersion: 'thriftage-stylist-eval-v1',
  maxConcurrentGenerations: 50,
  maxInputCharacters: 2000,
  maxOutfitOptions: 3,
  maxOutputTokens: 1800,
  maxRequestsPerMinute: 4,
  maxToolCalls: 6,
  model: 'gpt-5.6-terra',
  promptVersion: 'thriftage-stylist-v1',
  reasoningEffort: 'medium',
  sessionTurnLimit: 40,
  timeoutMs: 20_000,
  toolSchemaVersion: 'tools-v1',
};

const metrics = {
  activeUsers: 7,
  attribution: [{ count: 4, key: 'OPEN' }],
  averageLatencyMs: 1200,
  cachedInputTokens: 500,
  configuration,
  estimatedCostMicroUsd: 42_000,
  fallbackRate: 0.1,
  generations: 10,
  generationsByModel: [{ count: 10, key: 'gpt-5.6-terra' }],
  generationsByStatus: [{ count: 9, key: 'SUCCEEDED' }],
  inputTokens: 4000,
  latencyP50Ms: 900,
  latencyP95Ms: 2100,
  listingClickThroughRate: 0.4,
  outfitSaveRate: 0.3,
  outputTokens: 1200,
  providerErrorRate: 0,
  savedOutfits: 3,
};

afterEach(() => vi.unstubAllGlobals());

describe('AdminApi AI Stylist operations', () => {
  it('loads aggregate metrics through an authenticated admin route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(metrics), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = new AdminApi('https://api.example.com/api/v1', 'admin-token');

    await expect(api.getAiStylistMetrics()).resolves.toMatchObject({
      configuration: { promptVersion: 'thriftage-stylist-v1' },
      generations: 10,
      latencyP95Ms: 2100,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.example.com/api/v1/admin/ai-stylist/metrics',
    );
    expect(
      new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get('Authorization'),
    ).toBe('Bearer admin-token');
  });

  it('rejects accidental transcript data at the strict aggregate boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ...metrics, transcripts: ['private message'] }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      ),
    );
    const api = new AdminApi('https://api.example.com/api/v1', 'admin-token');

    await expect(api.getAiStylistMetrics()).rejects.toThrow();
  });
});
