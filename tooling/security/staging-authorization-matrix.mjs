const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function requiredUuid(name) {
  const value = required(name);
  if (!uuidPattern.test(value)) throw new Error(`${name} must be a UUID.`);
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function probe(baseUrl, check) {
  const response = await fetch(`${baseUrl}${check.path}`, {
    body: check.body === undefined ? undefined : JSON.stringify(check.body),
    headers: {
      authorization: `Bearer ${check.token}`,
      ...(check.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    method: check.method ?? 'GET',
    signal: AbortSignal.timeout(10_000),
  });
  if (!check.expected.includes(response.status)) {
    throw new Error(
      `${check.name} returned HTTP ${response.status}; expected ${check.expected.join(' or ')}.`,
    );
  }
  console.log(`PASS ${check.name}: HTTP ${response.status}`);
}

async function main() {
  assert(process.env.TARGET_ENV === 'staging', 'TARGET_ENV must equal staging.');
  assert(
    process.env.ALLOW_STAGING_AUTHORIZATION_MATRIX === 'THRIFTAGE_SYNTHETIC_FIXTURES_ONLY',
    'ALLOW_STAGING_AUTHORIZATION_MATRIX must equal THRIFTAGE_SYNTHETIC_FIXTURES_ONLY.',
  );
  const configuredUrl = new URL(required('STAGING_API_URL'));
  const expectedHost = required('EXPECTED_STAGING_HOST').toLowerCase();
  assert(configuredUrl.protocol === 'https:', 'Authorization matrix requires HTTPS.');
  assert(
    configuredUrl.hostname.toLowerCase() === expectedHost,
    'STAGING_API_URL does not match EXPECTED_STAGING_HOST.',
  );
  assert(!/prod(?:uction)?/i.test(expectedHost), 'Refusing a production-looking host.');

  const baseUrl = configuredUrl.toString().replace(/\/$/, '');
  const userA = required('USER_A_TOKEN');
  const userB = required('USER_B_TOKEN');
  const admin = required('ADMIN_TOKEN');
  const listingId = requiredUuid('USER_A_DRAFT_LISTING_ID');
  const aiConversationId = requiredUuid('USER_A_AI_CONVERSATION_ID');
  const savedOutfitId = requiredUuid('USER_A_SAVED_OUTFIT_ID');
  const privateConversationId = requiredUuid('USER_A_PRIVATE_CONVERSATION_ID');
  const disputeId = requiredUuid('USER_A_DISPUTE_ID');
  const blockedConversationId = requiredUuid('BLOCKED_CONVERSATION_ID');
  const listingTitle = required('USER_A_DRAFT_LISTING_TITLE');

  const checks = [
    { name: 'User A identity is valid', path: '/auth/me', token: userA, expected: [200] },
    { name: 'User B identity is valid', path: '/auth/me', token: userB, expected: [200] },
    {
      name: 'Admin identity and role are valid',
      path: '/admin/access',
      token: admin,
      expected: [200],
    },
    {
      name: 'User A cannot invoke admin API',
      path: '/admin/access',
      token: userA,
      expected: [403],
    },
    {
      name: 'User B cannot invoke admin API',
      path: '/admin/access',
      token: userB,
      expected: [403],
    },
    {
      name: 'User B cannot read User A seller-private listing',
      path: `/seller/listings/${listingId}`,
      token: userB,
      expected: [403, 404],
    },
    {
      name: 'User B cannot modify User A draft listing',
      path: `/seller/listings/${listingId}`,
      method: 'PATCH',
      body: { title: listingTitle },
      token: userB,
      expected: [403, 404],
    },
    {
      name: 'User B cannot read User A AI conversation',
      path: `/ai-stylist/conversations/${aiConversationId}`,
      token: userB,
      expected: [403, 404],
    },
    {
      name: 'User B cannot read User A saved outfit',
      path: `/ai-stylist/saved-outfits/${savedOutfitId}`,
      token: userB,
      expected: [403, 404],
    },
    {
      name: 'Stranger cannot read a private conversation',
      path: `/conversations/${privateConversationId}`,
      token: userB,
      expected: [403, 404],
    },
    {
      name: 'Stranger cannot read dispute evidence context',
      path: `/disputes/${disputeId}`,
      token: userB,
      expected: [403, 404],
    },
    {
      name: 'Blocked relationship cannot send a message',
      path: `/conversations/${blockedConversationId}/messages`,
      method: 'POST',
      body: { body: 'Authorization matrix probe with synthetic fixture only.' },
      token: userB,
      expected: [403],
    },
  ];

  for (const check of checks) await probe(baseUrl, check);
  console.log(`Staging authorization matrix passed (${checks.length} checks).`);
}

main().catch((error) => {
  console.error(
    `Staging authorization matrix failed: ${error instanceof Error ? error.message : 'UNKNOWN_ERROR'}`,
  );
  process.exitCode = 1;
});
