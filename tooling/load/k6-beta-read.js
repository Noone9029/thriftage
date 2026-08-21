import http from 'k6/http';
import { check, sleep } from 'k6';

import { matchesExactHttpsHost } from './load-target-guard.js';
import { selectReadRoute } from './read-route-selector.js';

const baseUrl = (__ENV.BASE_URL ?? '').replace(/\/$/, '');
const expectedHost = __ENV.EXPECTED_STAGING_HOST ?? '';
const token = __ENV.LOAD_TEST_AUTH_TOKEN ?? '';
const readLatencyThresholds = ['p(50)<250', 'p(95)<600', 'p(99)<1500'];

function assertStagingTarget() {
  if (
    __ENV.TARGET_ENV !== 'staging' ||
    __ENV.ALLOW_STAGING_LOAD_TEST !== 'THRIFTAGE_STAGING_ONLY'
  ) {
    throw new Error('Set TARGET_ENV=staging and ALLOW_STAGING_LOAD_TEST=THRIFTAGE_STAGING_ONLY.');
  }
  if (!matchesExactHttpsHost(baseUrl, expectedHost) || token.length < 20) {
    throw new Error('Use the exact HTTPS staging host and a synthetic tester access token.');
  }
}

export const options = {
  scenarios: {
    beta_reads: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 30 },
        { duration: '3m', target: 30 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_duration: readLatencyThresholds,
    'http_req_duration{route:feed}': readLatencyThresholds,
    'http_req_duration{route:personalized-feed}': readLatencyThresholds,
    'http_req_duration{route:search}': readLatencyThresholds,
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  assertStagingTarget();
  const ready = http.get(`${baseUrl}/readiness`);
  if (ready.status !== 200) throw new Error('Staging API is not ready.');
}

export default function () {
  const headers = { Authorization: `Bearer ${token}` };
  const route = selectReadRoute(__VU, __ITER);
  const path =
    route === 'feed'
      ? '/feed?mode=NEW&limit=20'
      : route === 'search'
        ? '/listings?sort=NEWEST&limit=20'
        : '/feed?mode=RECOMMENDED&limit=20';
  const response = http.get(`${baseUrl}${path}`, { headers, tags: { route } });
  check(response, { 'read request succeeded': (item) => item.status === 200 });

  if (__ENV.LISTING_ID) {
    const listing = http.get(`${baseUrl}/listings/${__ENV.LISTING_ID}`, {
      headers,
      tags: { route: 'listing-detail' },
    });
    check(listing, { 'listing detail succeeded': (response) => response.status === 200 });
  }
  if (__ENV.CONVERSATION_ID) {
    const messages = http.get(
      `${baseUrl}/conversations/${__ENV.CONVERSATION_ID}/messages?limit=30`,
      { headers, tags: { route: 'message-history' } },
    );
    check(messages, { 'message history succeeded': (response) => response.status === 200 });
  }
  sleep(1);
}
