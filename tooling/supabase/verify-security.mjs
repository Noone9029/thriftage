import pg from 'pg';

const databaseUrl = process.env.SUPABASE_MIGRATION_DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error('SUPABASE_MIGRATION_DATABASE_URL is required. No remote checks were run.');
  process.exit(2);
}

const url = new URL(databaseUrl);
if (!['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode') ?? '')) {
  console.error('The verification connection must explicitly require TLS with sslmode.');
  process.exit(2);
}

const client = new pg.Client({ connectionString: databaseUrl });
const failures = [];

try {
  await client.connect();
  const ssl = await client.query('select ssl from pg_stat_ssl where pid = pg_backend_pid()');
  if (ssl.rows[0]?.ssl !== true) failures.push('Database connection is not using TLS.');

  const rls = await client.query(`
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename <> '_prisma_migrations'
      and not rowsecurity
    order by tablename
  `);
  for (const row of rls.rows) failures.push(`RLS is disabled on public.${row.tablename}.`);

  const grants = await client.query(`
    select grantee, table_name, privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated', 'service_role')
    order by grantee, table_name, privilege_type
  `);
  for (const row of grants.rows) {
    failures.push(
      `Unexpected ${row.privilege_type} grant for ${row.grantee} on public.${row.table_name}.`,
    );
  }

  const policies = await client.query(`
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename <> '_prisma_migrations'
      and not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and pg_policies.tablename = pg_tables.tablename
          and policyname = 'thriftage_runtime_server_access'
      )
    order by tablename
  `);
  for (const row of policies.rows) {
    failures.push(`Runtime server policy is missing on public.${row.tablename}.`);
  }

  const buckets = await client.query(`
    select id, public, file_size_limit, allowed_mime_types
    from storage.buckets
    where id in ('profile-images', 'listing-images', 'dispute-evidence')
    order by id
  `);
  const expectedBuckets = new Map([
    ['dispute-evidence', false],
    ['listing-images', false],
    ['profile-images', true],
  ]);
  for (const [id, isPublic] of expectedBuckets) {
    const bucket = buckets.rows.find((row) => row.id === id);
    if (!bucket) failures.push(`Storage bucket ${id} is missing.`);
    else if (bucket.public !== isPublic)
      failures.push(`Storage bucket ${id} has wrong visibility.`);
    else if (Number(bucket.file_size_limit) !== 5_242_880) {
      failures.push(`Storage bucket ${id} must enforce a 5 MiB limit.`);
    } else if (!bucket.allowed_mime_types?.includes('image/webp')) {
      failures.push(`Storage bucket ${id} must allow processed WebP objects.`);
    }
  }

  const realtime = await client.query(`
    select 1
    from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'thriftage_conversation_participant_receive'
  `);
  if (realtime.rowCount !== 1)
    failures.push('Realtime conversation authorization policy is missing.');

  const realtimeFunction = await client.query(`
    select
      p.prosecdef,
      p.proconfig,
      has_function_privilege(
        'authenticated',
        'thriftage_security.can_receive_conversation_topic(text)',
        'EXECUTE'
      ) as authenticated_execute,
      has_function_privilege(
        'anon',
        'thriftage_security.can_receive_conversation_topic(text)',
        'EXECUTE'
      ) as anon_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'thriftage_security'
      and p.proname = 'can_receive_conversation_topic'
  `);
  const authorizationFunction = realtimeFunction.rows[0];
  if (!authorizationFunction) {
    failures.push('Realtime conversation authorization function is missing.');
  } else {
    if (authorizationFunction.prosecdef !== true)
      failures.push('Realtime authorization function must be SECURITY DEFINER.');
    if (
      !Array.isArray(authorizationFunction.proconfig) ||
      !authorizationFunction.proconfig.includes('search_path=pg_catalog, public')
    )
      failures.push('Realtime authorization function does not lock its search_path.');
    if (authorizationFunction.authenticated_execute !== true)
      failures.push('Authenticated role cannot execute Realtime authorization function.');
    if (authorizationFunction.anon_execute === true)
      failures.push('Anonymous role must not execute Realtime authorization function.');
  }
} finally {
  await client.end().catch(() => undefined);
}

if (failures.length > 0) {
  console.error('Supabase security verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Supabase security verification passed without reading application rows.');
}
