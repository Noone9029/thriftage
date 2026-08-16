import { createHash, randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const domains = {
  evidence: {
    bucketVariable: 'DISPUTE_EVIDENCE_BUCKET',
    defaultBucket: 'dispute-evidence',
    prefix: 'disputes',
    pattern: /^disputes\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/,
    query: 'select storage_key from dispute_evidence where storage_key = any($1::text[])',
  },
  listing: {
    bucketVariable: 'LISTING_IMAGE_BUCKET',
    defaultBucket: 'listing-images',
    prefix: 'listings',
    pattern: /^listings\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/,
    query: 'select storage_key from listing_images where storage_key = any($1::text[])',
  },
  profile: {
    bucketVariable: 'PROFILE_IMAGE_BUCKET',
    defaultBucket: 'profile-images',
    prefix: 'profiles',
    pattern: /^profiles\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/,
    query:
      'select profile_image_key as storage_key from profiles where profile_image_key = any($1::text[])',
  },
};

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function boundedInteger(name, fallback, minimum, maximum) {
  const parsed = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
}

function log(event, fields = {}) {
  process.stdout.write(`${JSON.stringify({ event, ...fields })}\n`);
}

function keyDigest(key) {
  return createHash('sha256').update(key).digest('hex');
}

async function listObjects(bucket, root, maxScanned) {
  const directories = [root];
  const objects = [];
  let scanned = 0;
  while (directories.length > 0 && scanned < maxScanned) {
    const path = directories.shift();
    let offset = 0;
    while (scanned < maxScanned) {
      const { data, error } = await bucket.list(path, {
        limit: Math.min(100, maxScanned - scanned),
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw new Error('STORAGE_LIST_FAILED');
      if (!data || data.length === 0) break;
      scanned += data.length;
      for (const entry of data) {
        const key = `${path}/${entry.name}`;
        if (entry.id == null || entry.metadata == null) directories.push(key);
        else objects.push({ createdAt: entry.created_at ?? entry.updated_at ?? null, key });
      }
      if (data.length < 100) break;
      offset += data.length;
    }
  }
  return { objects, scanLimitReached: scanned >= maxScanned, scanned };
}

async function referencedKeys(database, domain, keys) {
  if (keys.length === 0) return new Set();
  const result = await database.query(domain.query, [keys]);
  return new Set(result.rows.map(({ storage_key: key }) => key));
}

async function main() {
  const runId = randomUUID();
  const apply = process.env.STORAGE_RECONCILIATION_APPLY === 'true';
  const environment = process.env.DEPLOYMENT_ENV ?? 'local';
  if (
    apply &&
    environment === 'production' &&
    process.env.STORAGE_RECONCILIATION_ALLOW_PRODUCTION !== 'true'
  ) {
    throw new Error(
      'Production deletion requires STORAGE_RECONCILIATION_ALLOW_PRODUCTION=true after an approved dry run.',
    );
  }

  const batchSize = boundedInteger('STORAGE_RECONCILIATION_BATCH_SIZE', 100, 1, 200);
  const graceHours = boundedInteger('STORAGE_RECONCILIATION_GRACE_HOURS', 72, 24, 720);
  const maxScanned = boundedInteger('STORAGE_RECONCILIATION_MAX_SCANNED', 5000, 100, 100000);
  const selected = process.env.STORAGE_RECONCILIATION_DOMAIN?.trim() ?? 'all';
  const selectedDomains =
    selected === 'all' ? Object.entries(domains) : [[selected, domains[selected]]];
  if (selectedDomains.some(([, domain]) => domain === undefined)) {
    throw new Error('STORAGE_RECONCILIATION_DOMAIN must be all, profile, listing, or evidence.');
  }

  const databaseUrl = required('DATABASE_URL');
  const supabaseUrl = required('SUPABASE_URL');
  const supabaseSecretKey = required('SUPABASE_SECRET_KEY');
  const database = new pg.Client({ connectionString: databaseUrl });
  const storage = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  }).storage;
  const graceBefore = Date.now() - graceHours * 60 * 60 * 1000;
  let candidateCount = 0;
  let deletedCount = 0;
  let scanLimitReached = false;

  log('media_reconciliation_started', {
    apply,
    batchSize,
    environment,
    graceHours,
    maxScanned,
    runId,
  });
  await database.connect();
  try {
    for (const [name, domain] of selectedDomains) {
      const bucketName = process.env[domain.bucketVariable]?.trim() || domain.defaultBucket;
      const bucket = storage.from(bucketName);
      const listed = await listObjects(bucket, domain.prefix, maxScanned);
      scanLimitReached ||= listed.scanLimitReached;
      const eligible = listed.objects
        .filter(({ createdAt, key }) => {
          const timestamp = createdAt === null ? Number.NaN : Date.parse(createdAt);
          return domain.pattern.test(key) && Number.isFinite(timestamp) && timestamp <= graceBefore;
        })
        .map(({ key }) => key);
      const referenced = await referencedKeys(database, domain, eligible);
      const candidates = eligible.filter((key) => !referenced.has(key)).slice(0, batchSize);
      candidateCount += candidates.length;

      for (const key of candidates) {
        log('media_reconciliation_candidate', {
          bucket: bucketName,
          domain: name,
          keyDigest: keyDigest(key),
          runId,
        });
      }

      if (apply && candidates.length > 0) {
        const rechecked = await referencedKeys(database, domain, candidates);
        const safeToDelete = candidates.filter((key) => !rechecked.has(key));
        if (safeToDelete.length > 0) {
          const { error } = await bucket.remove(safeToDelete);
          if (error) throw new Error('STORAGE_DELETE_FAILED');
          deletedCount += safeToDelete.length;
          log('media_reconciliation_deleted', {
            bucket: bucketName,
            count: safeToDelete.length,
            domain: name,
            runId,
          });
        }
      }
    }
  } finally {
    await database.end().catch(() => undefined);
  }

  log('media_reconciliation_completed', {
    apply,
    candidateCount,
    deletedCount,
    runId,
    scanLimitReached,
  });
  if (scanLimitReached) process.exitCode = 3;
}

main().catch((error) => {
  log('media_reconciliation_failed', {
    code:
      error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'CONFIG_ERROR',
  });
  process.exitCode = 1;
});
