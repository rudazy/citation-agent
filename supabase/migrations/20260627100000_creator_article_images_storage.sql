-- Public read bucket for inline images embedded in paywalled article bodies (upload via API only).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creator-article-images',
  'creator-article-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public read creator article images"
  on storage.objects for select
  using (bucket_id = 'creator-article-images');