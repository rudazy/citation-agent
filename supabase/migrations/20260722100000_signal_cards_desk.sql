-- Phase 1: Signal Cards as structured judgment objects on creator_posts.
-- Research posts remain post_kind = 'research' (default). Same unlock/royalty rails.

alter table public.creator_posts
  add column if not exists post_kind text not null default 'research',
  add column if not exists signal_direction text,
  add column if not exists signal_confidence smallint,
  add column if not exists signal_horizon text,
  add column if not exists signal_invalidation text;

-- Backfill + constrain kinds (existing rows stay research).
update public.creator_posts
set post_kind = 'research'
where post_kind is null or post_kind not in ('research', 'signal');

alter table public.creator_posts
  drop constraint if exists creator_posts_post_kind_chk;

alter table public.creator_posts
  add constraint creator_posts_post_kind_chk
  check (post_kind in ('research', 'signal'));

alter table public.creator_posts
  drop constraint if exists creator_posts_signal_direction_chk;

alter table public.creator_posts
  add constraint creator_posts_signal_direction_chk
  check (
    signal_direction is null
    or signal_direction in ('long', 'short', 'avoid', 'watch', 'neutral')
  );

alter table public.creator_posts
  drop constraint if exists creator_posts_signal_confidence_chk;

alter table public.creator_posts
  add constraint creator_posts_signal_confidence_chk
  check (
    signal_confidence is null
    or (signal_confidence >= 1 and signal_confidence <= 5)
  );

alter table public.creator_posts
  drop constraint if exists creator_posts_signal_horizon_chk;

alter table public.creator_posts
  add constraint creator_posts_signal_horizon_chk
  check (
    signal_horizon is null
    or signal_horizon in ('30d', '90d', 'event', 'open')
  );

-- Signals must carry structured conviction fields; research may leave them null.
alter table public.creator_posts
  drop constraint if exists creator_posts_signal_fields_chk;

alter table public.creator_posts
  add constraint creator_posts_signal_fields_chk
  check (
    post_kind <> 'signal'
    or (
      signal_direction is not null
      and signal_confidence is not null
      and signal_horizon is not null
      and signal_invalidation is not null
      and char_length(trim(signal_invalidation)) >= 8
    )
  );

create index if not exists creator_posts_post_kind_published_idx
  on public.creator_posts (post_kind, published_at desc)
  where status = 'published';

-- Identity claim: YouTube (same proof-code flow as website / X / Substack).
alter table public.profile_verifications
  drop constraint if exists profile_verifications_kind_check;

alter table public.profile_verifications
  add constraint profile_verifications_kind_check
  check (kind in ('website', 'x', 'substack', 'youtube'));
