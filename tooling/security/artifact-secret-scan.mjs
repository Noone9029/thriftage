import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const roots = ['apps/api/dist', 'apps/admin/.next', 'apps/mobile/dist'];
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
    name: 'inlined named secret',
    pattern:
      /(?:OPENAI_API_KEY|SUPABASE_SECRET_KEY|TWILIO_API_KEY_SECRET|SENTRY_AUTH_TOKEN|SMTP_PASSWORD)["']?\s*[:=]\s*["'][^"']{16,}["']/gi,
  },
];

const likelyTextExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.mjs',
  '.txt',
  '.xml',
]);

function filesUnder(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...filesUnder(path));
    else if (entry.isFile() && likelyTextExtensions.has(extname(entry.name).toLowerCase())) {
      files.push(path);
    }
  }
  return files;
}

const missing = roots.filter((root) => !existsSync(root));
if (missing.length > 0) {
  console.error(`Artifact scan requires completed builds: ${missing.join(', ')}`);
  process.exit(2);
}

const files = roots.flatMap(filesUnder);
const findings = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(text)) {
      findings.push(`${relative(process.cwd(), file).replaceAll('\\', '/')} ${rule.name}`);
    }
  }
}

if (findings.length > 0) {
  console.error('Potential secrets found in generated artifacts:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(`Artifact secret scan passed (${files.length} generated text files inspected).`);
}
