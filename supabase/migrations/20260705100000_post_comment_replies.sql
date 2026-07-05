-- Threaded comment replies (parent_id self-reference).

alter table public.post_comments
  add column parent_id uuid references public.post_comments (id) on delete cascade;

create index post_comments_parent_id_idx
  on public.post_comments (parent_id)
  where parent_id is not null;