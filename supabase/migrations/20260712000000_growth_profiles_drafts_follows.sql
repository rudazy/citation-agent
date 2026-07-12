-- Growth stack: draft semantics, public profile indexes, creator follows.

-- Drafts are not live assets; published_at is set only when status becomes published.
alter table public.creator_posts
  alter column published_at drop not null;

update public.creator_posts
set published_at = null
where status = 'draft';

create index if not exists creator_posts_author_name_published_idx
  on public.creator_posts (lower(author_name), published_at desc)
  where status = 'published';

create index if not exists creator_posts_drafts_wallet_idx
  on public.creator_posts (lower(connected_wallet), updated_at desc)
  where status = 'draft';

-- Follower (platform profile) → creator (platform profile). Agent-session identity only.
create table if not exists public.creator_follows (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  follower_profile_id uuid not null references public.platform_profiles (id) on delete cascade,
  creator_profile_id uuid not null references public.platform_profiles (id) on delete cascade,
  constraint creator_follows_no_self_chk check (follower_profile_id <> creator_profile_id),
  constraint creator_follows_unique unique (follower_profile_id, creator_profile_id)
);

create index if not exists creator_follows_follower_idx
  on public.creator_follows (follower_profile_id, created_at desc);

create index if not exists creator_follows_creator_idx
  on public.creator_follows (creator_profile_id);

alter table public.creator_follows enable row level security;

revoke all on public.creator_follows from anon, authenticated;
grant all on public.creator_follows to service_role;
