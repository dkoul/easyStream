-- easyStream MVP: event metadata only. No stream recordings or VOD assets.

create table if not exists public.users (
  id text primary key,
  name text,
  phone text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.otp_codes (
  phone text primary key,
  code text not null,
  expires_at timestamptz not null
);

create table if not exists public.events (
  id text primary key,
  owner_id text not null references public.users (id) on delete cascade,
  slug text not null unique,
  type text not null,
  title text not null,
  person_name text,
  photo_url text,
  date text not null,
  location text not null,
  message text,
  template text not null,
  status text not null,
  stream_id text,
  ingest_url text,
  stream_key text,
  playback_url text,
  viewer_count integer not null default 0,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists events_owner_id_idx on public.events (owner_id);
create index if not exists events_status_idx on public.events (status);

alter table public.users enable row level security;
alter table public.otp_codes enable row level security;
alter table public.events enable row level security;

-- Viewers never talk to Postgres directly. The API uses the service role
-- (bypasses RLS). Unlisted events stay off any public PostgREST listing.
revoke all on public.users from anon, authenticated;
revoke all on public.otp_codes from anon, authenticated;
revoke all on public.events from anon, authenticated;

insert into storage.buckets (id, name, public)
values ('event-photos', 'event-photos', true)
on conflict (id) do nothing;
