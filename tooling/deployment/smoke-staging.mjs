function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sensitiveKey(value) {
  return /credential|database|dsn|key|openai|password|secret|token|twilio/i.test(value);
}

function findSensitiveKeys(value, path = 'response') {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findSensitiveKeys(item, `${path}[${index}]`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => [
      ...(sensitiveKey(key) ? [`${path}.${key}`] : []),
      ...findSensitiveKeys(child, `${path}.${key}`),
    ]);
  }
  return [];
}

async function getJson(baseUrl, path, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${path} did not return JSON (HTTP ${response.status}).`);
  }
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}.`);
  return body;
}

async function main() {
  assert(process.env.TARGET_ENV === 'staging', 'TARGET_ENV must equal staging.');
  assert(
    process.env.ALLOW_STAGING_SMOKE === 'THRIFTAGE_STAGING_ONLY',
    'ALLOW_STAGING_SMOKE must equal THRIFTAGE_STAGING_ONLY.',
  );

  const configuredUrl = new URL(required('STAGING_API_URL'));
  const expectedHost = required('EXPECTED_STAGING_HOST').toLowerCase();
  const expectedRelease = required('EXPECTED_RELEASE_VERSION');
  assert(configuredUrl.protocol === 'https:', 'Staging smoke requires HTTPS.');
  assert(
    configuredUrl.hostname.toLowerCase() === expectedHost,
    'STAGING_API_URL does not match EXPECTED_STAGING_HOST.',
  );
  assert(!/prod(?:uction)?/i.test(expectedHost), 'Refusing a production-looking host.');

  const baseUrl = configuredUrl.toString().replace(/\/$/, '');
  const health = await getJson(baseUrl, '/health');
  assert(health.status === 'ok', 'Health status is not ok.');
  assert(health.environment === 'staging', 'Health environment is not staging.');
  assert(health.releaseVersion === expectedRelease, 'Health release does not match expected SHA.');

  const readiness = await getJson(baseUrl, '/readiness');
  assert(readiness.status === 'ready', 'Readiness status is not ready.');
  assert(readiness.environment === 'staging', 'Readiness environment is not staging.');
  assert(
    readiness.releaseVersion === expectedRelease,
    'Readiness release does not match expected SHA.',
  );

  const runtime = await getJson(baseUrl, '/runtime-config');
  assert(runtime.environment === 'staging', 'Runtime config environment is not staging.');
  assert(
    runtime.releaseVersion === expectedRelease,
    'Runtime config release does not match expected SHA.',
  );
  assert(findSensitiveKeys(runtime).length === 0, 'Runtime config contains a sensitive key name.');

  const token = process.env.STAGING_SMOKE_AUTH_TOKEN?.trim();
  if (token) await getJson(baseUrl, '/auth/me', token);

  console.log(
    `Staging smoke passed for ${configuredUrl.hostname} at release ${expectedRelease}${token ? ' with an authenticated probe' : ''}.`,
  );
}

main().catch((error) => {
  console.error(
    `Staging smoke failed: ${error instanceof Error ? error.message : 'UNKNOWN_ERROR'}`,
  );
  process.exitCode = 1;
});
