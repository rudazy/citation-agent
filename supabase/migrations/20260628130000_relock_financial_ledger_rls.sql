-- Re-lock financial ledger tables to service_role only.
-- Supersedes 20260628100000_restore_ledger_public_read.sql.
-- The dashboard reads these exclusively through operator-authenticated API routes
-- (admin client): /api/dashboard/{payment-events,creator-earnings,agent-reputation}.
-- Writes were already service_role only; this closes anon/authenticated SELECT
-- and removes the tables from the public realtime publication.

drop policy if exists "Allow public read access" on public.payment_events;
drop policy if exists "Allow public read access on creator_earnings" on public.creator_earnings;
drop policy if exists "Allow public read access on agent_reputation" on public.agent_reputation;

revoke select on public.payment_events from anon, authenticated;
revoke select on public.creator_earnings from anon, authenticated;
revoke select on public.agent_reputation from anon, authenticated;

-- Stop broadcasting these tables to anon realtime subscribers. (withdrawals stays public.)
alter publication supabase_realtime drop table public.payment_events;
alter publication supabase_realtime drop table public.creator_earnings;
alter publication supabase_realtime drop table public.agent_reputation;
