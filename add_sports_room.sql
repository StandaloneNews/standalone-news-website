-- Standalone News: activate the Sports topic in the EXISTING Supabase project.
-- Safe to run more than once; does not change accounts, messages, security policies,
-- moderators, existing rooms or any other table.
-- Run in Supabase -> SQL Editor -> New query.
INSERT INTO public.community_rooms (slug, title, description, sort_order)
VALUES ('sports', 'Sports', 'NBA, NFL, worldwide soccer, UFC, matchups and results', 6)
ON CONFLICT (slug) DO UPDATE
SET title=EXCLUDED.title,
    description=EXCLUDED.description,
    sort_order=EXCLUDED.sort_order;

-- Confirmation should return one row with slug=sports.
SELECT slug, title, description, sort_order
FROM public.community_rooms
WHERE slug='sports';
