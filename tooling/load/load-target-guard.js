export function matchesExactHttpsHost(baseUrl, expectedHost) {
  if (!baseUrl || !expectedHost) return false;

  const match = /^https:\/\/([^/?#]+)(?:\/[^?#]*)?$/.exec(baseUrl);
  return match !== null && match[1] === expectedHost;
}
