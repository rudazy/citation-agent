-- Unified usernames (readers + researchers) and per-post comments.

create table public.platform_profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  username_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint platform_profiles_username_unique unique (username),
  constraint platform_profiles_username_format_chk
    check (username ~ '^[a-z0-9_]{3,24}$')
);

create table public.profile_wallets (
  profile_id uuid not null references public.platform_profiles (id) on delete cascade,
  wallet_address text not null,
  wallet_role text not null
    check (wallet_role in ('agent', 'publisher')),
  created_at timestamptz not null default now(),
  primary key (wallet_address),
  constraint profile_wallets_address_chk
    check (wallet_address ~ '^0x[a-fA-F0-9]{40}$')
);

create index profile_wallets_profile_id_idx
  on public.profile_wallets (profile_id);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id text not null,
  profile_id uuid not null references public.platform_profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint post_comments_body_len_chk
    check (char_length(trim(body)) >= 1 and char_length(body) <= 2000)
);

create index post_comments_post_id_created_idx
  on public.post_comments (post_id, created_at desc);

create index post_comments_profile_id_idx
  on public.post_comments (profile_id);

alter table public.platform_profiles enable row level security;
alter table public.profile_wallets enable row level security;
alter table public.post_comments enable row level security;

revoke all on public.platform_profiles from anon, authenticated;
revoke all on public.profile_wallets from anon, authenticated;
revoke all on public.post_comments from anon, authenticated;

grant all on public.platform_profiles to service_role;
grant all on public.profile_wallets to service_role;
grant all on public.post_comments to service_role;