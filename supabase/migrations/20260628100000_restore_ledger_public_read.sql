-- Restore public read on settlement ledgers for the dashboard (anon client + realtime).
-- Writes remain service_role only. Operator APIs still gate attestation fees.

grant select on public.payment_events to anon, authenticated;
grant select on public.creator_earnings to anon, authenticated;
grant select on public.agent_reputation to anon, authenticated;

create policy "Allow public read access"
  on public.payment_events for select
  using (true);

create policy "Allow public read access on creator_earnings"
  on public.creator_earnings for select
  using (true);

create policy "Allow public read access on agent_reputation"
  on public.agent_reputation for select
  using (true);