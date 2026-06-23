-- Operator-only platform fee ledger.
--
-- Enable RLS with no anon/authenticated policies so the public Supabase keys
-- cannot read the fee data directly via the REST API. The operator-only server
-- route reads it with the service-role key, which bypasses RLS.

alter table public.attestation_platform_fees enable row level security;

revoke select on public.attestation_platform_fees from anon;
revoke select on public.attestation_platform_fees from authenticated;

-- Stop broadcasting fee rows over the public realtime channel (no-op if absent).
do $$
begin
  alter publication supabase_realtime drop table public.attestation_platform_fees;
exception
  when others then null;
end $$;
