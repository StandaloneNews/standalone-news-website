-- Execute in Supabase SQL Editor AFTER creating a Supabase project.
-- Row Level Security ensures each signed-in reader can access only their own bookmarks.
create table if not exists public.saved_articles (
  user_id uuid not null references auth.users(id) on delete cascade,
  story_key text not null check (char_length(story_key) between 1 and 2048),
  story_type text not null check (story_type in ('news','article')),
  story_url text not null check (char_length(story_url) between 1 and 2048),
  title text not null check (char_length(title) between 1 and 500),
  source text not null default '',
  category text not null default '',
  published_at text,
  summary text not null default '',
  saved_at timestamptz not null default now(),
  primary key (user_id,story_key)
);
alter table public.saved_articles enable row level security;
-- The following policies are safe to re-run.
drop policy if exists "Reader selects own saved articles" on public.saved_articles;
create policy "Reader selects own saved articles" on public.saved_articles for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Reader inserts own saved articles" on public.saved_articles;
create policy "Reader inserts own saved articles" on public.saved_articles for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Reader updates own saved articles" on public.saved_articles;
create policy "Reader updates own saved articles" on public.saved_articles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Reader deletes own saved articles" on public.saved_articles;
create policy "Reader deletes own saved articles" on public.saved_articles for delete to authenticated using ((select auth.uid()) = user_id);
create index if not exists saved_articles_recent_idx on public.saved_articles(user_id,saved_at desc);
-- Avoid unauthenticated access even if this project has permissive default grants.
revoke all on public.saved_articles from public, anon;
revoke all on public.saved_articles from authenticated;
grant select,insert,update,delete on public.saved_articles to authenticated;
