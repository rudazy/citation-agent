-- Normalize legacy author_name casing to platform usernames (lowercase).
update public.creator_posts
set author_name = lower(author_name),
    updated_at = now()
where author_name is not null
  and author_name <> lower(author_name)
  and author_name ~* '^[a-z0-9_]{3,24}$';
