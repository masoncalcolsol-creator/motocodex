create extension if not exists "uuid-ossp";

create table if not exists public.sources (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  source_key text unique not null,
  display_name text not null,
  base_credibility numeric(4,3) default 0.700,
  notes text
);

insert into public.sources (source_key, display_name, base_credibility)
values ('manual','Manual',0.800)
on conflict (source_key) do nothing;

create table if not exists public.news_items (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  source_key text not null references public.sources(source_key),
  source_type text,
  url text,
  title text not null,
  summary text,
  content text,
  league text,
  entities text[] default '{}',
  tags text[] default '{}',
  dedupe_hash text unique,
  credibility numeric(4,3) default 0.700,
  importance numeric(4,3) default 0.500,
  momentum numeric(4,3) default 0.000,
  is_breaking boolean default false,
  is_active boolean default true
);

create index if not exists idx_news_items_published_at on public.news_items(published_at desc);
create index if not exists idx_news_items_league on public.news_items(league);
create index if not exists idx_news_items_entities on public.news_items using gin(entities);
create index if not exists idx_news_items_tags on public.news_items using gin(tags);

create table if not exists public.story_clusters (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cluster_key text unique not null,
  title text not null,
  league text,
  entities text[] default '{}',
  tags text[] default '{}',
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  credibility numeric(4,3) default 0.700,
  importance numeric(4,3) default 0.500,
  momentum numeric(4,3) default 0.000,
  current_summary text,
  what_changed text,
  what_to_watch text,
  is_active boolean default true
);

create index if not exists idx_story_clusters_updated_at on public.story_clusters(updated_at desc);
create index if not exists idx_story_clusters_league on public.story_clusters(league);

create table if not exists public.cluster_items (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  cluster_id uuid not null references public.story_clusters(id) on delete cascade,
  news_item_id uuid not null references public.news_items(id) on delete cascade,
  weight numeric(6,4) default 1.0
);

create unique index if not exists uq_cluster_items on public.cluster_items(cluster_id, news_item_id);

create table if not exists public.episode_facts (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  day date not null default current_date,
  league text,
  cluster_id uuid references public.story_clusters(id) on delete set null,
  headline text not null,
  bullets text[] default '{}',
  credibility numeric(4,3) default 0.700,
  importance numeric(4,3) default 0.500
);

create index if not exists idx_episode_facts_day on public.episode_facts(day desc);

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_story_clusters on public.story_clusters;
create trigger trg_touch_story_clusters
before update on public.story_clusters
for each row execute function public.touch_updated_at();
