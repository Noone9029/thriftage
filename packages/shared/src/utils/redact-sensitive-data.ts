const sensitiveKeyPattern =
  /address|authorization|body|cookie|credential|email|evidence|message|otp|password|phone|prompt|secret|session|token/i;
const bearerPattern = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const jwtPattern = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

export function redactSensitiveData(value: unknown, key = ''): unknown {
  if (sensitiveKeyPattern.test(key)) return '[Filtered]';
  if (typeof value === 'string') {
    return value.replace(bearerPattern, 'Bearer [Filtered]').replace(jwtPattern, '[Filtered JWT]');
  }
  if (Array.isArray(value)) return value.map((item) => redactSensitiveData(item));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactSensitiveData(entryValue, entryKey),
      ]),
    );
  }
  return value;
}
