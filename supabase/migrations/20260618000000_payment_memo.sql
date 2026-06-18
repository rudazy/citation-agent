-- Arc transaction memo context for x402 payment reconciliation
alter table public.payment_events
  add column if not exists payment_memo text;

alter table public.creator_earnings
  add column if not exists payment_memo text;