-- Clients receive only advisory message-created hints. Durable message bodies remain API-only.
-- The JWT roles intentionally have no grants on public application tables. This narrowly scoped
-- SECURITY DEFINER function is therefore the only direct path used by Realtime authorization.
create schema if not exists thriftage_security;
revoke all on schema thriftage_security from public, anon, authenticated;
grant usage on schema thriftage_security to authenticated;

-- Remove the superseded two-argument draft if it was applied during pre-beta work. The caller
-- must never be allowed to supply an identity independently of auth.uid().
drop function if exists thriftage_security.can_receive_conversation_topic(text, uuid);

create or replace function thriftage_security.can_receive_conversation_topic(
  requested_topic text
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null
     or requested_topic !~ '^conversation:[0-9a-fA-F-]{36}$' then
    return false;
  end if;

  return exists (
    select 1
    from public.conversations as conversation
    join public.users as subscriber
      on subscriber.auth_provider_user_id = auth.uid()::text
    where conversation.id = split_part(requested_topic, ':', 2)::uuid
      and subscriber.account_status = 'ACTIVE'
      and subscriber.deleted_at is null
      and subscriber.id in (conversation.seller_id, conversation.buyer_id)
      and not exists (
        select 1
        from public.user_blocks as block
        where (block.blocker_id = conversation.seller_id and block.blocked_user_id = conversation.buyer_id)
           or (block.blocker_id = conversation.buyer_id and block.blocked_user_id = conversation.seller_id)
      )
      and not exists (
        select 1
        from public.user_restrictions as restriction
        where restriction.user_id = subscriber.id
          and restriction.scope = 'MESSAGING'
          and restriction.revoked_at is null
          and (restriction.expires_at is null or restriction.expires_at > now())
      )
  );
end;
$$;

revoke all on function thriftage_security.can_receive_conversation_topic(text)
from public, anon;
grant execute on function thriftage_security.can_receive_conversation_topic(text)
to authenticated;

drop policy if exists thriftage_conversation_participant_receive on realtime.messages;

create policy thriftage_conversation_participant_receive
on realtime.messages
for select
to authenticated
using (
  thriftage_security.can_receive_conversation_topic(realtime.topic())
);
