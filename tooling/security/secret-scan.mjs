import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const trackedFiles = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);

const excludedFile = /(?:^|\/)(?:pnpm-lock\.yaml|.*\.env(?:\.[^/]+)?\.example)$/;
const allowedLine =
  /secret-scan:\s*allow|backend-only|change-me|example\.com|legacy-service-role|not-a-real|placeholder|replace-with|stagingvalue|restricted-staging|your-project|0{16,}/i;
const rules = [
  { name: 'OpenAI API key', pattern: /\bsk-[A-Za-z0-9_-]{24,}\b/g },
  { name: 'Supabase secret key', pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g },
  { name: 'Sentry auth token', pattern: /\bsntrys_[A-Za-z0-9_-]{20,}\b/g },
  { name: 'private key material', pattern: /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/g },
  {
    name: 'database credential',
    pattern: /postgres(?:ql)?:\/\/[^:\s/]+:[^@\s/]{8,}@[^\s"']+/gi,
  },
  {
    name: 'named backend secret',
    pattern:
      /(?:OPENAI_API_KEY|SUPABASE_SECRET_KEY|TWILIO_API_KEY_SECRET|SENTRY_AUTH_TOKEN|SMTP_PASSWORD)(?:\s*=\s*["']?([^\s"',}]{16,})|\s*:\s*["']([^"']{16,})["'])/gi,
  },
];

const findings = [];
for (const file of trackedFiles) {
  const normalized = file.replaceAll('\\', '/');
  if (excludedFile.test(normalized)) continue;
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (text.includes('\0')) continue;
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (allowedLine.test(line)) continue;
    for (const rule of rules) {
      rule.pattern.lastIndex = 0;
      if (
        rule.pattern.test(line) &&
        !(rule.name === 'database credential' && /@(localhost|127\.0\.0\.1)(?::|\/)/i.test(line))
      ) {
        findings.push(`${normalized}:${index + 1} ${rule.name}`);
      }
    }
  }
}

if (findings.length > 0) {
  console.error('Potential committed secrets found:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(`Secret scan passed (${trackedFiles.length} tracked files inspected).`);
}
