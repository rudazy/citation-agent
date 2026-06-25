-- Lock financial ledger tables to service_role only.
-- Dashboard reads these via operator-authenticated API routes (admin client).

drop policy if exists "Allow public read access" on public.payment_events;
drop policy if exists "Allow public read access on creator_earnings" on public.creator_earnings;
drop policy if exists "Allow public read access on agent_reputation" on public.agent_reputation;

revoke select on public.payment_events from anon, authenticated;
revoke select on public.creator_earnings from anon, authenticated;
revoke select on public.agent_reputation from anon, authenticated;