-- Keep the new commerce tables behind the NestJS server boundary.
-- Provider roles are optional so fresh local/CI PostgreSQL databases remain portable.

ALTER TABLE "admin_permission_grants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketplace_analytics_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payout_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payout_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "seller_payout_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settlement_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settlements" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  target text;
  provider_role text;
  commerce_tables text[] := ARRAY[
    'admin_permission_grants',
    'financial_entries',
    'inventory_movements',
    'marketplace_analytics_events',
    'payout_batches',
    'payout_items',
    'refunds',
    'seller_payout_profiles',
    'settlement_allocations',
    'settlements'
  ];
BEGIN
  FOREACH target IN ARRAY commerce_tables
  LOOP
    FOREACH provider_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
    LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = provider_role) THEN
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', target, provider_role);
      END IF;
    END LOOP;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'thriftage_runtime') THEN
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO thriftage_runtime',
        target
      );
      EXECUTE format(
        'DROP POLICY IF EXISTS thriftage_runtime_server_access ON public.%I',
        target
      );
      EXECUTE format(
        'CREATE POLICY thriftage_runtime_server_access ON public.%I FOR ALL TO thriftage_runtime USING (true) WITH CHECK (true)',
        target
      );
    END IF;
  END LOOP;
END
$$;

NOTIFY pgrst, 'reload schema';
