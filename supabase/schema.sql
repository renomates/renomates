-- Renomates database schema. Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Run it once on a fresh project.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  suburb text default '',
  bio text default '',
  instagram text default '',
  created_at timestamptz not null default now()
);

create table public.renos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  suburb text not null,
  state text not null,
  postcode text not null,
  lat double precision not null,
  lng double precision not null,
  type text not null,
  other_type text check (char_length(other_type) <= 40),
  cost integer not null check (cost > 0),
  months integer not null check (months > 0),
  council_days integer not null default 0 check (council_days >= 0),
  council_notes text default '' check (char_length(council_notes) <= 600),
  story text not null check (char_length(story) between 3 and 3000),
  breakdown jsonb not null default '[]',
  trades jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index renos_created_idx on public.renos (created_at desc);

create table public.reno_photos (
  id uuid primary key default gen_random_uuid(),
  reno_id uuid not null references public.renos(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  path text not null,
  caption text default '' check (char_length(caption) <= 100),
  position integer not null default 0
);
create index reno_photos_reno_idx on public.reno_photos (reno_id, position);

create table public.favourites (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reno_id uuid not null references public.renos(id) on delete cascade,
  primary key (user_id, reno_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  reno_id uuid not null references public.renos(id) on delete cascade,
  asker_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (reno_id, asker_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index messages_convo_idx on public.messages (conversation_id, created_at);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reno_id uuid references public.renos(id) on delete cascade,
  reason text not null check (char_length(reason) <= 500),
  created_at timestamptz not null default now()
);

-- Create a profile automatically for every new sign-up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger renos_touch before update on public.renos
  for each row execute function public.touch_updated_at();

-- Row level security: nothing is readable or writable unless a policy below allows it.
alter table public.profiles enable row level security;
alter table public.renos enable row level security;
alter table public.reno_photos enable row level security;
alter table public.favourites enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;

create policy "profiles readable" on public.profiles for select using (true);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "renos readable" on public.renos for select using (true);
create policy "renos insert own" on public.renos for insert to authenticated with check (user_id = auth.uid());
create policy "renos update own" on public.renos for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "renos delete own" on public.renos for delete to authenticated using (user_id = auth.uid());

create policy "photos readable" on public.reno_photos for select using (true);
create policy "photos insert own" on public.reno_photos for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.renos r where r.id = reno_id and r.user_id = auth.uid()));
create policy "photos update own" on public.reno_photos for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "photos delete own" on public.reno_photos for delete to authenticated using (user_id = auth.uid());

create policy "favourites own" on public.favourites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "convos see own" on public.conversations for select to authenticated
  using (asker_id = auth.uid() or owner_id = auth.uid());
create policy "convos start" on public.conversations for insert to authenticated
  with check (asker_id = auth.uid() and asker_id <> owner_id
    and owner_id = (select user_id from public.renos r where r.id = reno_id));

create policy "messages see own" on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id
    and (c.asker_id = auth.uid() or c.owner_id = auth.uid())));
create policy "messages send own" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and exists (select 1 from public.conversations c where c.id = conversation_id
    and (c.asker_id = auth.uid() or c.owner_id = auth.uid())));

create policy "reports create" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
-- No select policy on reports: only you can read them, in the Supabase dashboard.

-- Live message updates.
alter publication supabase_realtime add table public.messages;

-- Photo storage: public to view, but people can only upload into their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reno-photos', 'reno-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "photos public read" on storage.objects for select using (bucket_id = 'reno-photos');
create policy "photos upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'reno-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'reno-photos' and (storage.foldername(name))[1] = auth.uid()::text);
