-- Create note_index table for efficient date queries
-- This table is automatically synced via trigger from the notes table

-- 1) Table
create table if not exists public.note_index (
  user_id uuid not null,
  date text not null,
  year int not null,
  updated_at timestamptz not null,
  deleted boolean not null default false,
  primary key (user_id, date)
);

create index if not exists note_index_user_year_idx
  on public.note_index (user_id, year);

create index if not exists note_index_user_date_idx
  on public.note_index (user_id, date);

-- 2) RLS
alter table public.note_index enable row level security;

-- Allow users to read their own index rows
create policy "note_index_select_own"
  on public.note_index
  for select
  using (user_id = auth.uid());

-- Allow writes from the user (trigger will run as invoker)
create policy "note_index_insert_own"
  on public.note_index
  for insert
  with check (user_id = auth.uid());

create policy "note_index_update_own"
  on public.note_index
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 3) Trigger function
create or replace function public.sync_note_index()
returns trigger
language plpgsql
as $$
declare
  note_year int;
begin
  -- date is stored as 'DD-MM-YYYY'
  note_year := extract(year from to_date(new.date, 'DD-MM-YYYY'))::int;

  insert into public.note_index (user_id, date, year, updated_at, deleted)
  values (new.user_id, new.date, note_year, new.updated_at, new.deleted)
  on conflict (user_id, date) do update
    set year = excluded.year,
        updated_at = excluded.updated_at,
        deleted = excluded.deleted;

  return new;
end;
$$;

drop trigger if exists notes_sync_note_index on public.notes;
create trigger notes_sync_note_index
after insert or update on public.notes
for each row execute function public.sync_note_index();

-- 4) Optional backfill (run once)
insert into public.note_index (user_id, date, year, updated_at, deleted)
select
  user_id,
  date,
  extract(year from to_date(date, 'DD-MM-YYYY'))::int as year,
  updated_at,
  deleted
from public.notes
on conflict (user_id, date) do update
  set year = excluded.year,
      updated_at = excluded.updated_at,
      deleted = excluded.deleted;
