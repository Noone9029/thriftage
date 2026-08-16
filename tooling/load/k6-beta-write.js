import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = (__ENV.BASE_URL ?? '').replace(/\/$/, '');
const expectedHost = __ENV.EXPECTED_STAGING_HOST ?? '';
const token = __ENV.LOAD_TEST_AUTH_TOKEN ?? '';

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

export const options = {
  scenarios: {
    controlled_writes: { executor: 'constant-vus', duration: '2m', vus: 5 },
  },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  const parsed = new URL(baseUrl);
  if (
    __ENV.TARGET_ENV !== 'staging' ||
    __ENV.ALLOW_STAGING_WRITES !== 'THRIFTAGE_SYNTHETIC_FIXTURES_ONLY' ||
    parsed.protocol !== 'https:' ||
    parsed.host !== expectedHost ||
    token.length < 20 ||
    !__ENV.CONVERSATION_ID
  ) {
    throw new Error(
      'Write test requires an exact staging host, synthetic token, and conversation fixture.',
    );
  }
}

export default function () {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const message = http.post(
    `${baseUrl}/conversations/${__ENV.CONVERSATION_ID}/messages`,
    JSON.stringify({ body: `Synthetic beta load probe ${__VU}-${__ITER}` }),
    { headers, tags: { route: 'message-send' } },
  );
  check(message, { 'message send succeeded': (response) => response.status === 201 });

  if (__ENV.LISTING_ID && __ENV.ADDRESS_ID && __ENV.ENABLE_CHECKOUT_PROBE === 'true') {
    const order = http.post(
      `${baseUrl}/orders`,
      JSON.stringify({
        addressId: __ENV.ADDRESS_ID,
        idempotencyKey: uuid(),
        listingId: __ENV.LISTING_ID,
        paymentMethod: 'COD',
      }),
      { headers, tags: { route: 'checkout' } },
    );
    check(order, {
      'checkout returned an expected concurrency result': (response) =>
        response.status === 201 || response.status === 409,
    });
  }
  sleep(1);
}
