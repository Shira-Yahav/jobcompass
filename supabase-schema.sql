-- ─────────────────────────────────────────────────────────────────────────────
-- JobCompass — Supabase schema (V2)
-- Run this in your Supabase project's SQL editor.
-- Safe to re-run: uses IF NOT EXISTS and DROP POLICY IF EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

-- User profiles table
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  desired_position text not null default '',
  salary_floor integer not null default 0,          -- minimum acceptable salary ("X and above")
  company_sizes text[] not null default '{}',        -- multi-select: ["11–50", "51–200"]
  company_types text[] not null default '{}',        -- multi-select: ["Startup", "Corporate"]
  funding_stages text[] not null default '{}',       -- multi-select: ["Seed", "Series A"]
  domains text[] not null default '{}',              -- free-form tags: ["SaaS", "Climate Tech"]
  role_type text not null default 'ic',              -- "ic" | "manager" | "both"
  work_style text not null default 'hybrid',         -- "remote" | "hybrid" | "onsite"
  resume_text text,
  resume_filename text,
  additional_context text,
  updated_at timestamptz not null default now()
);

-- Migrate existing rows: add new columns if they don't exist yet
-- (safe to run even if the table was just created above)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='salary_floor') then
    alter table public.profiles add column salary_floor integer not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='company_sizes') then
    alter table public.profiles add column company_sizes text[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='company_types') then
    alter table public.profiles add column company_types text[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='funding_stages') then
    alter table public.profiles add column funding_stages text[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='domains') then
    alter table public.profiles add column domains text[] not null default '{}';
  end if;
end $$;

-- Auto-create a blank profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row-level security
alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
