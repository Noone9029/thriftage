-- The hosted application connects through the least-privilege thriftage_runtime group.
-- Local/test databases do not create provider roles, so keep this migration portable.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'thriftage_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      "marketing_leads",
      "marketing_lead_rate_limit_buckets"
    TO thriftage_runtime;

    CREATE POLICY "thriftage_runtime_server_access"
      ON "marketing_leads"
      FOR ALL
      TO thriftage_runtime
      USING (true)
      WITH CHECK (true);

    CREATE POLICY "thriftage_runtime_server_access"
      ON "marketing_lead_rate_limit_buckets"
      FOR ALL
      TO thriftage_runtime
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
