-- Optional newsletter tables; run in the EXISTING Supabase project SQL Editor.
-- Does not alter saved_articles, auth tables, or existing site permissions.
create table if not exists public.newsletter_subscribers (
 id uuid primary key default gen_random_uuid(),
 email text not null unique,
 alerts boolean not null default false,
 consent_requested_at timestamptz not null default now(),
 confirmation_hash text unique,
 confirmation_expires_at timestamptz,
 confirmation_sent_at timestamptz,
 confirmed_at timestamptz,
 unsubscribed_at timestamptz,
 created_at timestamptz not null default now(),
 constraint email_simple_check check (length(email)<=254 and email=lower(email) and position('@' in email)>1)
);
create table if not exists public.newsletter_deliveries (
 id uuid primary key default gen_random_uuid(),
 subscriber_id uuid not null references public.newsletter_subscribers(id) on delete cascade,
 campaign_key text not null,
 status text not null default 'queued' check(status in ('queued','sent','failed')),
 sent_at timestamptz,
 created_at timestamptz not null default now(),
 unique(subscriber_id,campaign_key)
);
create index if not exists newsletter_subscribers_active on public.newsletter_subscribers (confirmed_at) where confirmed_at is not null and unsubscribed_at is null;
alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_deliveries enable row level security;
-- Explicitly deny browser Data API roles. Only the trusted Pages Function / Actions
-- service role has access; never place a service role key into client JavaScript.
revoke all on public.newsletter_subscribers from anon, authenticated;
revoke all on public.newsletter_deliveries from anon, authenticated;
