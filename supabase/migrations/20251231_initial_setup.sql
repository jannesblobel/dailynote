-- Initial database setup for DailyNote
-- Creates core tables for encrypted note storage and user key management

-- 1) Notes table - stores encrypted note content
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  ciphertext text not null,
  nonce text not null,
  revision integer not null default 1,
  updated_at timestamptz not null,
  server_updated_at timestamptz,
  deleted boolean not null default false,

  -- Ensure one note per user per date
  unique(user_id, date)
);

-- Indexes for efficient queries
create index if not exists notes_user_id_idx on public.notes(user_id);
create index if not exists notes_user_date_idx on public.notes(user_id, date);
create index if not exists notes_user_id_deleted_idx on public.notes(user_id, deleted);

-- Enable RLS
alter table public.notes enable row level security;

-- RLS policies for notes
create policy "notes_select_own"
  on public.notes
  for select
  using (user_id = auth.uid());

create policy "notes_insert_own"
  on public.notes
  for insert
  with check (user_id = auth.uid());

create policy "notes_update_own"
  on public.notes
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notes_delete_own"
  on public.notes
  for delete
  using (user_id = auth.uid());

-- Trigger to automatically set server_updated_at
create or replace function public.set_server_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.server_updated_at := now();
  return new;
end;
$$;

drop trigger if exists notes_set_server_updated_at on public.notes;
create trigger notes_set_server_updated_at
before insert or update on public.notes
for each row execute function public.set_server_updated_at();

-- 2) User keys table - stores wrapped encryption keys
create table if not exists public.user_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wrapped_dek text not null,
  dek_iv text not null,
  kdf_salt text not null,
  kdf_iterations integer not null,
  version integer not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.user_keys enable row level security;

-- RLS policies for user_keys
create policy "user_keys_select_own"
  on public.user_keys
  for select
  using (user_id = auth.uid());

create policy "user_keys_insert_own"
  on public.user_keys
  for insert
  with check (user_id = auth.uid());

create policy "user_keys_update_own"
  on public.user_keys
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Trigger to automatically update updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_keys_set_updated_at on public.user_keys;
create trigger user_keys_set_updated_at
before update on public.user_keys
for each row execute function public.set_updated_at();
