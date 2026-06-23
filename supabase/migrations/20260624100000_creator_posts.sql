-- Creator-published paid posts (Day 1 marketplace spine).
-- Body is server-held; public access only through Next.js API (service role).

create table public.creator_posts (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz not null default now(),
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),

  title text not null,
  subheading text not null,
  body text not null,

  price_usdc text not null default '0.001',
  tags text[] not null default '{}',

  author_name text not null,
  connected_wallet text not null,
  payout_wallet text not null,

  paid_count integer not null default 0,

  constraint creator_posts_connected_wallet_chk
    check (connected_wallet ~ '^0x[a-fA-F0-9]{40}$'),
  constraint creator_posts_payout_wallet_chk
    check (payout_wallet ~ '^0x[a-fA-F0-9]{40}$'),
  constraint creator_posts_price_floor_chk
    check (price_usdc::numeric >= 0.001)
);

create index creator_posts_published_idx
  on public.creator_posts (published_at desc)
  where status = 'published';

create index creator_posts_connected_wallet_idx
  on public.creator_posts (lower(connected_wallet));

create index creator_posts_payout_wallet_idx
  on public.creator_posts (lower(payout_wallet));

alter table public.creator_posts enable row level security;

revoke all on public.creator_posts from anon, authenticated;
grant all on public.creator_posts to service_role;