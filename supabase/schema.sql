-- =============================================================================
-- RSVP PDF Reader - Supabase schema
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- =============================================================================

-- 1. Tables ------------------------------------------------------------------

create table if not exists public.documents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null,
  storage_path text not null,
  num_pages    integer not null default 0,
  pages        jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists documents_user_id_idx
  on public.documents (user_id, created_at desc);

create table if not exists public.reading_progress (
  document_id        uuid primary key references public.documents (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,
  current_page       integer not null default 0,
  current_word_index integer not null default 0,
  wpm                integer not null default 300,
  updated_at         timestamptz not null default now()
);

-- 2. Row Level Security ------------------------------------------------------

alter table public.documents enable row level security;
alter table public.reading_progress enable row level security;

drop policy if exists "documents are private to owner" on public.documents;
create policy "documents are private to owner"
  on public.documents
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "progress is private to owner" on public.reading_progress;
create policy "progress is private to owner"
  on public.reading_progress
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Storage bucket for PDF files --------------------------------------------

insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', false)
on conflict (id) do nothing;

-- Files are stored under "<user_id>/<uuid>.pdf"; restrict access to that owner.
drop policy if exists "pdfs select own" on storage.objects;
create policy "pdfs select own"
  on storage.objects for select
  using (
    bucket_id = 'pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "pdfs insert own" on storage.objects;
create policy "pdfs insert own"
  on storage.objects for insert
  with check (
    bucket_id = 'pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "pdfs delete own" on storage.objects;
create policy "pdfs delete own"
  on storage.objects for delete
  using (
    bucket_id = 'pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
