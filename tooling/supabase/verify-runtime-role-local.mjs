import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

import pg from 'pg';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function quoteLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function roleNames(value) {
  if (Array.isArray(value)) return value;
  return String(value ?? '')
    .replace(/^\{|\}$/g, '')
    .split(',')
    .map((role) => role.replace(/^"|"$/g, '').trim())
    .filter(Boolean);
}

async function main() {
  const testDatabaseUrl = new URL(required('TEST_DATABASE_URL'));
  const databaseName = testDatabaseUrl.pathname.slice(1).toLowerCase();
  const isLocal = ['127.0.0.1', 'localhost'].includes(testDatabaseUrl.hostname.toLowerCase());
  const explicitlyAllowed = process.env.ALLOW_PRISMA_DEV_TEST_DATABASE === 'true';
  assert(isLocal, 'Runtime-role proof only runs against localhost.');
  assert(
    databaseName.includes('test') || (explicitlyAllowed && testDatabaseUrl.port !== '5432'),
    'Runtime-role proof requires a test database or an explicitly allowed non-default Prisma Dev port.',
  );

  const admin = new pg.Client({ connectionString: testDatabaseUrl.toString() });
  const password = randomBytes(32).toString('base64url');

  try {
    await admin.connect();
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await admin.query(`
        do $$
        begin
          if not exists (select 1 from pg_roles where rolname = '${role}') then
            create role ${role} nologin;
          end if;
        end
        $$
      `);
    }

    const boundarySql = readFileSync(
      new URL('../../supabase/sql/00-server-boundary.sql', import.meta.url),
      'utf8',
    );
    await admin.query(boundarySql);
    await admin.query(boundarySql);
    await admin.query(`alter role thriftage_api password ${quoteLiteral(password)}`);

    const roles = await admin.query(`
      select rolname, rolcanlogin, rolinherit, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
      from pg_roles
      where rolname in ('thriftage_api', 'thriftage_runtime')
      order by rolname
    `);
    assert(roles.rowCount === 2, 'Expected both Thriftage database roles.');
    const apiRole = roles.rows.find((role) => role.rolname === 'thriftage_api');
    const runtimeRole = roles.rows.find((role) => role.rolname === 'thriftage_runtime');
    assert(
      apiRole?.rolcanlogin === true && apiRole.rolinherit === true,
      'API login role is invalid.',
    );
    assert(
      runtimeRole?.rolcanlogin === false && runtimeRole.rolinherit === false,
      'Runtime permission role is invalid.',
    );
    for (const role of roles.rows) {
      assert(
        !role.rolsuper &&
          !role.rolcreatedb &&
          !role.rolcreaterole &&
          !role.rolreplication &&
          !role.rolbypassrls,
        `${role.rolname} has an elevated attribute.`,
      );
    }

    const membership = await admin.query(`
      select pg_has_role('thriftage_api', 'thriftage_runtime', 'MEMBER') as is_member
    `);
    assert(membership.rows[0]?.is_member === true, 'API login is not a runtime-role member.');

    const tables = await admin.query(`
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
    assert(tables.rowCount > 0, 'No application tables were found.');
    for (const table of tables.rows) {
      assert(table.relrowsecurity === true, `RLS is disabled on public.${table.table_name}.`);
      assert(table.cmd === 'ALL', `Runtime policy is missing on public.${table.table_name}.`);
      assert(
        roleNames(table.roles).length === 1 && roleNames(table.roles)[0] === 'thriftage_runtime',
        `Runtime policy roles are invalid on public.${table.table_name}.`,
      );
      assert(
        table.using_expression === 'true' && table.check_expression === 'true',
        `Runtime policy expressions are invalid on public.${table.table_name}.`,
      );
    }

    const runtimeUrl = new URL(testDatabaseUrl.toString());
    runtimeUrl.username = 'thriftage_api';
    runtimeUrl.password = password;
    const runtime = new pg.Client({ connectionString: runtimeUrl.toString() });
    try {
      await runtime.connect();
      const connectedRole = await runtime.query('select current_user');
      // Prisma Dev currently maps local connections to its superuser. CI uses a real PostgreSQL
      // service and authenticates as thriftage_api; locally, SET ROLE still proves the effective ACL.
      if (connectedRole.rows[0]?.current_user !== 'thriftage_api') {
        await runtime.query('set role thriftage_api');
      }
      const privileges = await runtime.query(`
        select
          current_user,
          has_table_privilege(current_user, 'public.users', 'SELECT') as can_select,
          has_table_privilege(current_user, 'public.users', 'INSERT') as can_insert,
          has_table_privilege(current_user, 'public.users', 'UPDATE') as can_update,
          has_table_privilege(current_user, 'public.users', 'DELETE') as can_delete,
          has_table_privilege(current_user, 'public._prisma_migrations', 'SELECT') as can_read_migrations
      `);
      const privilege = privileges.rows[0];
      assert(
        privilege?.current_user === 'thriftage_api',
        'Runtime proof did not authenticate as thriftage_api.',
      );
      assert(
        privilege?.can_select &&
          privilege.can_insert &&
          privilege.can_update &&
          privilege.can_delete,
        'API login does not inherit the required application table privileges.',
      );
      assert(
        privilege.can_read_migrations === false,
        'API login can read Prisma migration history.',
      );
      await runtime.query('select 1 from public.users limit 0');
    } finally {
      await runtime.end().catch(() => undefined);
    }
  } finally {
    if (admin._connected) {
      await admin.query('alter role thriftage_api password null').catch(() => undefined);
    }
    await admin.end().catch(() => undefined);
  }

  console.log('Local Supabase runtime-role proof passed without reading application rows.');
}

main().catch((error) => {
  console.error(
    `Local Supabase runtime-role proof failed: ${error instanceof Error ? error.message : 'UNKNOWN_ERROR'}`,
  );
  process.exitCode = 1;
});
