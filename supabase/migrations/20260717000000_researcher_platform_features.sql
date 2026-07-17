-- Researcher platform features: report covers, scheduled publishing,
-- versioned post edits, view analytics, in-app notifications, and
-- profile link verification.

alter table public.creator_posts
  add column if not exists cover_image_url text,
  add column if not exists edit_version integer not null default 1,
  add column if not exists last_edited_at timestamptz;

-- Snapshot of a post BEFORE an edit is applied; version = edit_version at snapshot time.
create table if not exists public.post_versions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  post_id text not null references public.creator_posts(id) on delete cascade,
  version integer not null,
  title text not null,
  subheading text not null,
  body text not null,
  price_usdc text not null,
  tags text[] not null default '{}',
  cover_image_url text,
  change_note text,
  unique (post_id, version)
);
create index if not exists post_versions_post_idx
  on public.post_versions (post_id, version desc);

-- One row per (post, viewer, day); viewer_hash is a salted hash, never an identity.
create table if not exists public.post_views (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  post_id text not null,
  view_day date not null default (now()::date),
  viewer_hash text not null,
  referrer_host text,
  unique (post_id, viewer_hash, view_day)
);
create index if not exists post_views_post_idx
  on public.post_views (post_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  profile_id uuid not null references public.platform_profiles(id) on delete cascade,
  type text not null check (type in ('follow', 'comment', 'reply', 'sale')),
  actor_username text,
  post_id text,
  read_at timestamptz
);
create index if not exists notifications_profile_idx
  on public.notifications (profile_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (profile_id) where read_at is null;

create table if not exists public.profile_verifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  profile_id uuid not null references public.platform_profiles(id) on delete cascade,
  kind text not null check (kind in ('website', 'x', 'substack')),
  url text not null,
  code text not null,
  verified_at timestamptz,
  unique (profile_id, kind)
);
create index if not exists profile_verifications_profile_idx
  on public.profile_verifications (profile_id);

-- Service-role only, matching every other table in this schema.
alter table public.post_versions enable row level security;
alter table public.post_views enable row level security;
alter table public.notifications enable row level security;
alter table public.profile_verifications enable row level security;

revoke all on public.post_versions from anon, authenticated;
revoke all on public.post_views from anon, authenticated;
revoke all on public.notifications from anon, authenticated;
revoke all on public.profile_verifications from anon, authenticated;

grant all on public.post_versions to service_role;
grant all on public.post_views to service_role;
grant all on public.notifications to service_role;
grant all on public.profile_verifications to service_role;
grant usage, select on all sequences in schema public to service_role;
