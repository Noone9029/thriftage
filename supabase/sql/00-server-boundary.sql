-- Thriftage uses NestJS as its authoritative application data boundary.
-- Apply with the migration/admin database role after Prisma migrations.

create schema if not exists api;
revoke all on schema public from anon, authenticated;
grant usage on schema api to anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'thriftage_runtime') then
    execute 'create role thriftage_runtime nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls';
  else
    alter role thriftage_runtime nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'thriftage_api') then
    execute 'create role thriftage_api login password null nosuperuser nocreatedb nocreaterole inherit noreplication nobypassrls';
  else
    alter role thriftage_api login nosuperuser nocreatedb nocreaterole inherit noreplication nobypassrls;
  end if;
end
$$;

-- thriftage_runtime is the permission/policy group. thriftage_api is the only login used by the
-- NestJS runtime. Set thriftage_api's generated password out of band after this script succeeds.
grant thriftage_runtime to thriftage_api;

-- The login receives application privileges only through group membership. Reapplying the script
-- removes accidental direct grants without changing its out-of-band password.
revoke all privileges on schema public from thriftage_api;
revoke all privileges on all tables in schema public from thriftage_api;
revoke all privileges on all sequences in schema public from thriftage_api;

grant usage on schema public to thriftage_runtime;

do $$
declare
  target record;
begin
  for target in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
      and tablename <> '_prisma_migrations'
    order by tablename
  loop
    execute format('alter table %I.%I enable row level security', target.schemaname, target.tablename);
    execute format(
      'revoke all privileges on table %I.%I from anon, authenticated, service_role',
      target.schemaname,
      target.tablename
    );
    execute format(
      'grant select, insert, update, delete on table %I.%I to thriftage_runtime',
      target.schemaname,
      target.tablename
    );
    execute format(
      'drop policy if exists thriftage_runtime_server_access on %I.%I',
      target.schemaname,
      target.tablename
    );
    execute format(
      'create policy thriftage_runtime_server_access on %I.%I for all to thriftage_runtime using (true) with check (true)',
      target.schemaname,
      target.tablename
    );
  end loop;
end
$$;

revoke all privileges on table public._prisma_migrations from anon, authenticated, service_role, thriftage_runtime, thriftage_api;

alter default privileges in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to thriftage_runtime;
alter default privileges in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to thriftage_runtime;

notify pgrst, 'reload schema';
