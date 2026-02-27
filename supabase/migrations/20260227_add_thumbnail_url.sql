-- FILE: C:\MotoCODEX\supabase\migrations\20260227_add_thumbnail_url.sql
-- Add thumbnail_url to news_items for YouTube + rich cards.

alter table if exists public.news_items
add column if not exists thumbnail_url text;

create index if not exists news_items_thumbnail_url_idx
on public.news_items (thumbnail_url);