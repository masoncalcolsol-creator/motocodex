-- MOTOPEDIA canonical historical data store
-- Data collection only: source-linked facts, normalization, and deterministic rebuilds.

create extension if not exists pgcrypto;

create table if not exists public.motopedia_sources (
  key text primary key,
  name text not null,
  base_url text not null,
  priority integer not null default 3,
  status text not null default 'active',
  last_discovered_at timestamptz,
  last_ingested_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.motopedia_documents (
  id text primary key,
  source_key text not null references public.motopedia_sources(key) on update cascade,
  url text not null unique,
  title text not null,
  fetched_at timestamptz not null,
  published_at timestamptz,
  year integer,
  series_key text,
  document_type text not null default 'source-page',
  table_count integer not null default 0,
  fact_count integer not null default 0,
  content_hash text not null,
  http_metadata jsonb not null default '{}'::jsonb,
  extraction_state text not null default 'provisional',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists motopedia_documents_year_idx on public.motopedia_documents(year);
create index if not exists motopedia_documents_series_idx on public.motopedia_documents(series_key);
create index if not exists motopedia_documents_source_idx on public.motopedia_documents(source_key);
create index if not exists motopedia_documents_type_idx on public.motopedia_documents(document_type);

create table if not exists public.motopedia_series (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  discipline text not null,
  sanctioning_body text,
  target_start_year integer,
  target_end_year integer,
  provenance_document_id text references public.motopedia_documents(id),
  verification_state text not null default 'provisional',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.motopedia_seasons (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.motopedia_series(id) on delete cascade,
  year integer not null,
  name text,
  start_date date,
  end_date date,
  champion_rider_id uuid,
  provenance_document_id text references public.motopedia_documents(id),
  verification_state text not null default 'provisional',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(series_id, year)
);

create table if not exists public.motopedia_rounds (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.motopedia_seasons(id) on delete cascade,
  round_number integer,
  name text not null,
  event_date date,
  venue text,
  city text,
  region text,
  country text,
  provenance_document_id text references public.motopedia_documents(id),
  verification_state text not null default 'provisional',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(season_id, round_number, name)
);

create table if not exists public.motopedia_classes (
  id uuid primary key default gen_random_uuid(),
  series_id uuid references public.motopedia_series(id) on delete cascade,
  key text not null,
  name text not null,
  displacement_label text,
  region text,
  provenance_document_id text references public.motopedia_documents(id),
  verification_state text not null default 'provisional',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(series_id, key)
);

create table if not exists public.motopedia_riders (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  normalized_name text not null unique,
  nationality text,
  birth_date date,
  aliases text[] not null default '{}',
  provenance_document_id text references public.motopedia_documents(id),
  verification_state text not null default 'provisional',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.motopedia_seasons
  drop constraint if exists motopedia_seasons_champion_rider_id_fkey;
alter table public.motopedia_seasons
  add constraint motopedia_seasons_champion_rider_id_fkey
  foreign key (champion_rider_id) references public.motopedia_riders(id);

create table if not exists public.motopedia_entries (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.motopedia_rounds(id) on delete cascade,
  class_id uuid references public.motopedia_classes(id),
  rider_id uuid not null references public.motopedia_riders(id),
  bike_number text,
  manufacturer text,
  team text,
  hometown text,
  provenance_document_id text references public.motopedia_documents(id),
  verification_state text not null default 'provisional',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(round_id, class_id, rider_id)
);

create table if not exists public.motopedia_results (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.motopedia_rounds(id) on delete cascade,
  class_id uuid references public.motopedia_classes(id),
  entry_id uuid references public.motopedia_entries(id) on delete cascade,
  rider_id uuid not null references public.motopedia_riders(id),
  session_type text not null default 'overall',
  position integer,
  points numeric,
  laps integer,
  time_text text,
  status text,
  raw_result jsonb not null default '{}'::jsonb,
  provenance_document_id text not null references public.motopedia_documents(id),
  verification_state text not null default 'provisional',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(round_id, class_id, rider_id, session_type)
);

create index if not exists motopedia_results_rider_idx on public.motopedia_results(rider_id);
create index if not exists motopedia_results_round_idx on public.motopedia_results(round_id);
create index if not exists motopedia_results_position_idx on public.motopedia_results(position);

create table if not exists public.motopedia_standings_snapshots (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.motopedia_seasons(id) on delete cascade,
  class_id uuid references public.motopedia_classes(id),
  after_round_id uuid references public.motopedia_rounds(id),
  rider_id uuid not null references public.motopedia_riders(id),
  position integer,
  points numeric,
  wins integer,
  podiums integer,
  snapshot_date date,
  raw_standing jsonb not null default '{}'::jsonb,
  provenance_document_id text not null references public.motopedia_documents(id),
  verification_state text not null default 'provisional',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(season_id, class_id, after_round_id, rider_id)
);

create table if not exists public.motopedia_facts (
  id text primary key,
  document_id text not null references public.motopedia_documents(id) on delete cascade,
  source_key text not null references public.motopedia_sources(key),
  series_key text,
  year integer,
  entity_type text not null,
  entity_name text,
  fact_type text not null,
  value_text text,
  context jsonb not null default '{}'::jsonb,
  provenance_url text not null,
  extracted_at timestamptz not null,
  verification_state text not null default 'provisional',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists motopedia_facts_document_idx on public.motopedia_facts(document_id);
create index if not exists motopedia_facts_series_year_idx on public.motopedia_facts(series_key, year);
create index if not exists motopedia_facts_entity_idx on public.motopedia_facts(entity_type, entity_name);
create index if not exists motopedia_facts_type_idx on public.motopedia_facts(fact_type);

create table if not exists public.motopedia_ingest_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  worker text not null default 'github-actions',
  status text not null default 'running',
  pages_attempted integer not null default 0,
  pages_accepted integer not null default 0,
  facts_extracted integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  error_text text
);

insert into public.motopedia_sources (key, name, base_url, priority, status)
values
  ('racerx', 'Racer X', 'https://racerxonline.com', 1, 'preferred-primary-historical-source'),
  ('racerx-vault', 'Racer X Vault', 'https://vault.racerxonline.com', 1, 'historical-source'),
  ('racerx-llvault', 'Racer X Loretta Lynn''s Vault', 'https://llvault.racerxonline.com', 1, 'historical-source'),
  ('supercrosslive', 'Supercross Live', 'https://www.supercrosslive.com', 2, 'official-current-source'),
  ('promotocross', 'Pro Motocross', 'https://promotocross.com', 2, 'official-current-source')
on conflict (key) do update set
  name = excluded.name,
  base_url = excluded.base_url,
  priority = excluded.priority,
  status = excluded.status,
  updated_at = now();

insert into public.motopedia_series (key, name, discipline, target_start_year, target_end_year)
values
  ('ama-supercross', 'AMA Supercross', 'supercross', 1974, 2026),
  ('ama-pro-motocross', 'AMA Pro Motocross', 'motocross', 1972, 2026),
  ('supermotocross', 'SuperMotocross World Championship', 'smx', 2023, 2026),
  ('fim-motocross-world-championship', 'FIM Motocross World Championship / MXGP', 'mxgp', 1957, 2026),
  ('fim-world-supercross', 'FIM World Supercross Championship', 'wsx', 2022, 2026),
  ('loretta-lynns-amateur-national', 'AMA Amateur National Motocross Championship', 'amateur', 1982, 2026)
on conflict (key) do update set
  name = excluded.name,
  discipline = excluded.discipline,
  target_start_year = excluded.target_start_year,
  target_end_year = excluded.target_end_year,
  updated_at = now();

alter table public.motopedia_sources enable row level security;
alter table public.motopedia_documents enable row level security;
alter table public.motopedia_series enable row level security;
alter table public.motopedia_seasons enable row level security;
alter table public.motopedia_rounds enable row level security;
alter table public.motopedia_classes enable row level security;
alter table public.motopedia_riders enable row level security;
alter table public.motopedia_entries enable row level security;
alter table public.motopedia_results enable row level security;
alter table public.motopedia_standings_snapshots enable row level security;
alter table public.motopedia_facts enable row level security;
alter table public.motopedia_ingest_runs enable row level security;

create policy "motopedia public read sources" on public.motopedia_sources for select using (true);
create policy "motopedia public read documents" on public.motopedia_documents for select using (true);
create policy "motopedia public read series" on public.motopedia_series for select using (true);
create policy "motopedia public read seasons" on public.motopedia_seasons for select using (true);
create policy "motopedia public read rounds" on public.motopedia_rounds for select using (true);
create policy "motopedia public read classes" on public.motopedia_classes for select using (true);
create policy "motopedia public read riders" on public.motopedia_riders for select using (true);
create policy "motopedia public read entries" on public.motopedia_entries for select using (true);
create policy "motopedia public read results" on public.motopedia_results for select using (true);
create policy "motopedia public read standings" on public.motopedia_standings_snapshots for select using (true);
create policy "motopedia public read facts" on public.motopedia_facts for select using (true);
