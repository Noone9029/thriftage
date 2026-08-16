import pg from 'pg';

function requiredTlsUrl(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required. No remote checks were run.`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL.`);
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error(`${name} must use the PostgreSQL protocol.`);
  }
  if (!['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode') ?? '')) {
    throw new Error(`${name} must explicitly require TLS with sslmode.`);
  }
  return value;
}

function roleNames(value) {
  if (Array.isArray(value)) return value;
  return String(value ?? '')
    .replace(/^\{|\}$/g, '')
    .split(',')
    .map((role) => role.replace(/^"|"$/g, '').trim())
    .filter(Boolean);
}

function exactRoles(value, expected) {
  const actual = roleNames(value).sort();
  return (
    actual.length === expected.length &&
    actual.every((role, index) => role === [...expected].sort()[index])
  );
}

const failures = [];

async function verifyMigrationBoundary(connectionString) {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    const ssl = await client.query('select ssl from pg_stat_ssl where pid = pg_backend_pid()');
    if (ssl.rows[0]?.ssl !== true) failures.push('Migration database connection is not using TLS.');

    const roles = await client.query(`
      select rolname, rolcanlogin, rolinherit, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
      from pg_roles
      where rolname in ('thriftage_api', 'thriftage_runtime')
      order by rolname
    `);
    if (roles.rowCount !== 2)
      failures.push('Expected both thriftage_api and thriftage_runtime roles.');
    for (const role of roles.rows) {
      const expectedLogin = role.rolname === 'thriftage_api';
      const expectedInherit = role.rolname === 'thriftage_api';
      if (role.rolcanlogin !== expectedLogin || role.rolinherit !== expectedInherit) {
        failures.push(`${role.rolname} has invalid login or inheritance attributes.`);
      }
      if (
        role.rolsuper ||
        role.rolcreatedb ||
        role.rolcreaterole ||
        role.rolreplication ||
        role.rolbypassrls
      ) {
        failures.push(`${role.rolname} has an elevated role attribute.`);
      }
    }

    const membership = await client.query(`
      select pg_has_role('thriftage_api', 'thriftage_runtime', 'MEMBER') as is_member
    `);
    if (membership.rows[0]?.is_member !== true) {
      failures.push('thriftage_api is not a member of thriftage_runtime.');
    }

    const ownership = await client.query(`
      select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_roles r on r.oid = c.relowner
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
        and r.rolname in ('thriftage_api', 'thriftage_runtime')
      order by c.relname
    `);
    for (const row of ownership.rows) {
      failures.push(`A runtime role owns public.${row.relname}.`);
    }

    const directApiGrants = await client.query(`
      select table_name, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public'
        and grantee = 'thriftage_api'
      order by table_name, privilege_type
    `);
    for (const row of directApiGrants.rows) {
      failures.push(
        `thriftage_api has a direct ${row.privilege_type} grant on public.${row.table_name}.`,
      );
    }

    const jwtGrants = await client.query(`
      select grantee, table_name, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public'
        and grantee in ('anon', 'authenticated', 'service_role')
      order by grantee, table_name, privilege_type
    `);
    for (const row of jwtGrants.rows) {
      failures.push(
        `Unexpected ${row.privilege_type} grant for ${row.grantee} on public.${row.table_name}.`,
      );
    }

    const tables = await client.query(`
      select
        c.relname as table_name,
        c.relrowsecurity,
        p.cmd,
        p.roles,
        p.qual as using_expression,
        p.with_check as check_expression
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      left join pg_policies p
        on p.schemaname = n.nspname
       and p.tablename = c.relname
       and p.policyname = 'thriftage_runtime_server_access'
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
        and c.relname <> '_prisma_migrations'
      order by c.relname
    `);
    if (tables.rowCount === 0) failures.push('No public application tables were found.');
    for (const table of tables.rows) {
      if (table.relrowsecurity !== true)
        failures.push(`RLS is disabled on public.${table.table_name}.`);
      if (
        table.cmd !== 'ALL' ||
        !exactRoles(table.roles, ['thriftage_runtime']) ||
        table.using_expression !== 'true' ||
        table.check_expression !== 'true'
      ) {
        failures.push(`Runtime policy is missing or invalid on public.${table.table_name}.`);
      }
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

    const storage = await client.query(`
      select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'storage' and c.relname = 'objects'
    `);
    if (storage.rows[0]?.relrowsecurity !== true)
      failures.push('RLS is disabled on storage.objects.');
    const storagePolicies = await client.query(`
      select policyname
      from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
      order by policyname
    `);
    for (const row of storagePolicies.rows) {
      failures.push(`Unexpected direct storage.objects policy ${row.policyname}.`);
    }

    const realtime = await client.query(`
      select cmd, roles
      from pg_policies
      where schemaname = 'realtime'
        and tablename = 'messages'
        and policyname = 'thriftage_conversation_participant_receive'
    `);
    if (
      realtime.rowCount !== 1 ||
      realtime.rows[0]?.cmd !== 'SELECT' ||
      !exactRoles(realtime.rows[0]?.roles, ['authenticated'])
    ) {
      failures.push('Realtime conversation authorization policy is missing or invalid.');
    }

    const realtimeFunction = await client.query(`
      select
        p.prosecdef,
        p.proconfig,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
        has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'thriftage_security'
        and p.proname = 'can_receive_conversation_topic'
        and pg_get_function_identity_arguments(p.oid) = 'requested_topic text'
    `);
    const authorizationFunction = realtimeFunction.rows[0];
    if (!authorizationFunction) {
      failures.push('Realtime conversation authorization function is missing.');
    } else {
      if (authorizationFunction.prosecdef !== true) {
        failures.push('Realtime authorization function must be SECURITY DEFINER.');
      }
      if (
        !Array.isArray(authorizationFunction.proconfig) ||
        !authorizationFunction.proconfig.includes('search_path=pg_catalog, public')
      ) {
        failures.push('Realtime authorization function does not lock its search_path.');
      }
      if (authorizationFunction.authenticated_execute !== true) {
        failures.push('Authenticated role cannot execute Realtime authorization function.');
      }
      if (authorizationFunction.anon_execute === true) {
        failures.push('Anonymous role must not execute Realtime authorization function.');
      }
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function verifyRuntimeBoundary(connectionString) {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    const runtime = await client.query(`
      select
        current_user,
        (select ssl from pg_stat_ssl where pid = pg_backend_pid()) as ssl,
        has_table_privilege(current_user, 'public.users', 'SELECT') as can_read_users,
        has_table_privilege(current_user, 'public._prisma_migrations', 'SELECT') as can_read_migrations
    `);
    const row = runtime.rows[0];
    if (row?.current_user !== 'thriftage_api')
      failures.push('DATABASE_URL does not authenticate as thriftage_api.');
    if (row?.ssl !== true) failures.push('Runtime database connection is not using TLS.');
    if (row?.can_read_users !== true)
      failures.push('Runtime login cannot read application tables.');
    if (row?.can_read_migrations !== false)
      failures.push('Runtime login can read Prisma migration history.');
    await client.query('select 1 from public.users limit 0');
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  const migrationUrl = requiredTlsUrl('SUPABASE_MIGRATION_DATABASE_URL');
  const runtimeUrl = requiredTlsUrl('DATABASE_URL');
  await verifyMigrationBoundary(migrationUrl);
  await verifyRuntimeBoundary(runtimeUrl);

  if (failures.length > 0) {
    console.error('Supabase security verification failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Supabase security verification passed without reading application rows.');
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
  const safeMessage = / is required|must /u.test(message)
    ? message
    : 'A remote Supabase catalog or connection check failed; no application rows were read.';
  console.error(`Supabase security verification failed: ${safeMessage}`);
  process.exitCode = 1;
});
