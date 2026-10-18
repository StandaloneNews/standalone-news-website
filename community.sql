-- Standalone News community v1. Run once in the EXISTING Supabase SQL Editor.
-- This is separate from saved_articles and newsletter tables. No API secrets here.
-- Public reads; signed-in posting; moderator-only actions; database-side rate limits.

BEGIN;

CREATE TABLE IF NOT EXISTS public.community_rooms (
 slug text PRIMARY KEY CHECK (slug ~ '^[a-z-]{2,20}$'),
 title text NOT NULL,
 description text NOT NULL,
 sort_order integer NOT NULL DEFAULT 0
);
INSERT INTO public.community_rooms (slug,title,description,sort_order) VALUES
 ('general','General','Open conversation about today’s news',1),
 ('politics','Politics & policy','Debate policy and civic issues without personal attacks',2),
 ('markets','Markets','Stocks, the economy, and investing perspectives',3),
 ('sports','Sports','NBA, NFL, worldwide soccer, UFC, matchups and results',6),
 ('world','World','Global events and international coverage',4),
 ('technology','Technology','AI, business, science, and technology',5)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.community_profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 username text NOT NULL CHECK (username ~ '^[a-z][a-z0-9_]{2,19}$' AND username NOT IN
  ('admin','administrator','moderator','staff','support','official','standalone','standalonenews','standalone_news','newsroom','system','deleted')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS community_profiles_username_lower_idx ON public.community_profiles (lower(username));

CREATE TABLE IF NOT EXISTS public.community_moderators (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 added_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.community_restrictions (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 muted_until timestamptz,
 banned boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);

-- SECURITY DEFINER helpers are used only to check roles and posting restrictions.
CREATE OR REPLACE FUNCTION public.community_is_moderator(p_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT p_uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.community_moderators m WHERE m.user_id=p_uid);
$$;
CREATE OR REPLACE FUNCTION public.community_can_post(p_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT p_uid IS NOT NULL
 AND EXISTS (SELECT 1 FROM public.community_profiles p WHERE p.id=p_uid)
 AND NOT EXISTS (SELECT 1 FROM public.community_restrictions r WHERE r.user_id=p_uid
   AND (r.banned OR r.muted_until > now()));
$$;
REVOKE ALL ON FUNCTION public.community_is_moderator(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.community_can_post(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_is_moderator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_can_post(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.community_messages (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 room_slug text NOT NULL REFERENCES public.community_rooms(slug),
 author_id uuid NOT NULL REFERENCES public.community_profiles(id),
 body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 600),
 created_at timestamptz NOT NULL DEFAULT now(),
 removed_at timestamptz
);
CREATE INDEX IF NOT EXISTS community_messages_room_latest ON public.community_messages(room_slug,id DESC);
CREATE INDEX IF NOT EXISTS community_messages_author_time ON public.community_messages(author_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_threads (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 room_slug text NOT NULL REFERENCES public.community_rooms(slug),
 author_id uuid NOT NULL REFERENCES public.community_profiles(id),
 title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 8 AND 150),
 body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 10 AND 3000),
 created_at timestamptz NOT NULL DEFAULT now(),
 locked boolean NOT NULL DEFAULT false,
 removed_at timestamptz
);
CREATE INDEX IF NOT EXISTS community_threads_room_latest ON public.community_threads(room_slug,id DESC);
CREATE INDEX IF NOT EXISTS community_threads_author_time ON public.community_threads(author_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_replies (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 thread_id bigint NOT NULL REFERENCES public.community_threads(id) ON DELETE CASCADE,
 author_id uuid NOT NULL REFERENCES public.community_profiles(id),
 body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 1500),
 created_at timestamptz NOT NULL DEFAULT now(),
 removed_at timestamptz
);
CREATE INDEX IF NOT EXISTS community_replies_thread_time ON public.community_replies(thread_id,id ASC);
CREATE INDEX IF NOT EXISTS community_replies_author_time ON public.community_replies(author_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_reports (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 reporter_id uuid NOT NULL REFERENCES public.community_profiles(id),
 target_type text NOT NULL CHECK (target_type IN ('message','thread','reply')),
 target_id bigint NOT NULL,
 reason text NOT NULL CHECK (reason IN ('Spam','Harassment','Threats','Impersonation','Potentially misleading','Other')),
 details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 300),
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (reporter_id,target_type,target_id)
);
CREATE INDEX IF NOT EXISTS community_reports_open_recent ON public.community_reports(status,created_at DESC);

-- Lock the author's inserts to their real signed-in identity and apply rate limits.
CREATE OR REPLACE FUNCTION public.community_before_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE last_at timestamptz; recent_count bigint; gap interval; hourly_cap integer;
BEGIN
 IF auth.uid() IS NULL OR NEW.author_id <> auth.uid() OR NOT public.community_can_post(auth.uid()) THEN
  RAISE EXCEPTION 'Sign-in, public username, and posting permission required' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text));
 NEW.created_at = now(); NEW.removed_at = NULL;
 IF TG_TABLE_NAME='community_threads' THEN
  NEW.title=trim(NEW.title); NEW.body=trim(NEW.body); NEW.locked=false;
  gap=interval '40 seconds'; hourly_cap=8;
  SELECT max(created_at),count(*) FILTER (WHERE created_at>now()-interval '1 hour') INTO last_at,recent_count
  FROM public.community_threads WHERE author_id=auth.uid();
 ELSIF TG_TABLE_NAME='community_replies' THEN
  NEW.body=trim(NEW.body);
  IF NOT EXISTS (SELECT 1 FROM public.community_threads WHERE id=NEW.thread_id AND removed_at IS NULL AND locked=false) THEN
   RAISE EXCEPTION 'Thread unavailable or locked' USING ERRCODE='23514';
  END IF;
  gap=interval '8 seconds'; hourly_cap=45;
  SELECT max(created_at),count(*) FILTER (WHERE created_at>now()-interval '1 hour') INTO last_at,recent_count
  FROM public.community_replies WHERE author_id=auth.uid();
 ELSE
  NEW.body=trim(NEW.body);
  gap=interval '6 seconds'; hourly_cap=50;
  SELECT max(created_at),count(*) FILTER (WHERE created_at>now()-interval '1 hour') INTO last_at,recent_count
  FROM public.community_messages WHERE author_id=auth.uid();
 END IF;
 IF last_at IS NOT NULL AND last_at>now()-gap THEN
  RAISE EXCEPTION 'Please wait before posting again' USING ERRCODE='23514';
 END IF;
 IF recent_count>=hourly_cap THEN
  RAISE EXCEPTION 'Posting limit reached. Please return later' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS community_message_limit ON public.community_messages;
CREATE TRIGGER community_message_limit BEFORE INSERT ON public.community_messages FOR EACH ROW EXECUTE FUNCTION public.community_before_post();
DROP TRIGGER IF EXISTS community_thread_limit ON public.community_threads;
CREATE TRIGGER community_thread_limit BEFORE INSERT ON public.community_threads FOR EACH ROW EXECUTE FUNCTION public.community_before_post();
DROP TRIGGER IF EXISTS community_reply_limit ON public.community_replies;
CREATE TRIGGER community_reply_limit BEFORE INSERT ON public.community_replies FOR EACH ROW EXECUTE FUNCTION public.community_before_post();

CREATE OR REPLACE FUNCTION public.community_before_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target_author uuid;
BEGIN
 IF auth.uid() IS NULL OR NEW.reporter_id <> auth.uid()
  OR NOT EXISTS(SELECT 1 FROM public.community_profiles p WHERE p.id=auth.uid()) THEN
  RAISE EXCEPTION 'Sign in to report' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text));
 IF (SELECT count(*) FROM public.community_reports WHERE reporter_id=auth.uid() AND created_at>now()-interval '1 hour') >= 8 THEN
  RAISE EXCEPTION 'Report limit reached' USING ERRCODE='23514';
 END IF;
 IF NEW.target_type='message' THEN
  SELECT author_id INTO target_author FROM public.community_messages WHERE id=NEW.target_id AND removed_at IS NULL;
 ELSIF NEW.target_type='thread' THEN
  SELECT author_id INTO target_author FROM public.community_threads WHERE id=NEW.target_id AND removed_at IS NULL;
 ELSE
  SELECT author_id INTO target_author FROM public.community_replies WHERE id=NEW.target_id AND removed_at IS NULL;
 END IF;
 IF target_author IS NULL OR target_author=auth.uid() THEN
  RAISE EXCEPTION 'That item cannot be reported' USING ERRCODE='23514';
 END IF;
 NEW.created_at=now(); NEW.status='open'; NEW.details=trim(NEW.details);
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS community_report_guard ON public.community_reports;
CREATE TRIGGER community_report_guard BEFORE INSERT ON public.community_reports FOR EACH ROW EXECUTE FUNCTION public.community_before_report();

-- Protect all newly exposed public schema tables.
ALTER TABLE public.community_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_moderators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

-- Explicit grants matter in newer Supabase projects.
REVOKE ALL ON public.community_rooms,public.community_profiles,public.community_moderators,
 public.community_restrictions,public.community_messages,public.community_threads,
 public.community_replies,public.community_reports FROM anon,authenticated;
GRANT USAGE ON SCHEMA public TO anon,authenticated;
GRANT SELECT ON public.community_rooms,public.community_profiles,public.community_messages,
 public.community_threads,public.community_replies TO anon,authenticated;
GRANT INSERT ON public.community_profiles,public.community_messages,public.community_threads,
 public.community_replies,public.community_reports TO authenticated;
GRANT UPDATE (username) ON public.community_profiles TO authenticated;
GRANT SELECT ON public.community_moderators,public.community_restrictions,public.community_reports TO authenticated;
GRANT UPDATE (status) ON public.community_reports TO authenticated;
GRANT UPDATE (removed_at) ON public.community_messages, public.community_replies TO authenticated;
GRANT UPDATE (removed_at,locked) ON public.community_threads TO authenticated;
GRANT INSERT,UPDATE ON public.community_restrictions TO authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.community_messages_id_seq, public.community_threads_id_seq,
 public.community_replies_id_seq, public.community_reports_id_seq TO authenticated;

DROP POLICY IF EXISTS rooms_read ON public.community_rooms;
CREATE POLICY rooms_read ON public.community_rooms FOR SELECT TO anon,authenticated USING (true);
DROP POLICY IF EXISTS profiles_read ON public.community_profiles;
CREATE POLICY profiles_read ON public.community_profiles FOR SELECT TO anon,authenticated USING (true);
DROP POLICY IF EXISTS profiles_create ON public.community_profiles;
CREATE POLICY profiles_create ON public.community_profiles FOR INSERT TO authenticated WITH CHECK (id=(select auth.uid()));
DROP POLICY IF EXISTS profiles_rename ON public.community_profiles;
CREATE POLICY profiles_rename ON public.community_profiles FOR UPDATE TO authenticated
 USING (id=(select auth.uid())) WITH CHECK (id=(select auth.uid()));
DROP POLICY IF EXISTS moderators_self_read ON public.community_moderators;
CREATE POLICY moderators_self_read ON public.community_moderators FOR SELECT TO authenticated USING (user_id=(select auth.uid()));
DROP POLICY IF EXISTS restrictions_self_or_moderator ON public.community_restrictions;
CREATE POLICY restrictions_self_or_moderator ON public.community_restrictions FOR SELECT TO authenticated
 USING (user_id=(select auth.uid()) OR (select public.community_is_moderator(auth.uid())));
DROP POLICY IF EXISTS restrictions_mod_insert ON public.community_restrictions;
CREATE POLICY restrictions_mod_insert ON public.community_restrictions FOR INSERT TO authenticated
 WITH CHECK ((select public.community_is_moderator(auth.uid())));
DROP POLICY IF EXISTS restrictions_mod_update ON public.community_restrictions;
CREATE POLICY restrictions_mod_update ON public.community_restrictions FOR UPDATE TO authenticated
 USING ((select public.community_is_moderator(auth.uid()))) WITH CHECK ((select public.community_is_moderator(auth.uid())));

DROP POLICY IF EXISTS messages_read ON public.community_messages;
CREATE POLICY messages_read ON public.community_messages FOR SELECT TO anon,authenticated USING (removed_at IS NULL);
DROP POLICY IF EXISTS messages_mod_read ON public.community_messages;
CREATE POLICY messages_mod_read ON public.community_messages FOR SELECT TO authenticated USING ((select public.community_is_moderator(auth.uid())));
DROP POLICY IF EXISTS messages_post ON public.community_messages;
CREATE POLICY messages_post ON public.community_messages FOR INSERT TO authenticated
 WITH CHECK (author_id=(select auth.uid()) AND (select public.community_can_post(auth.uid())) AND removed_at IS NULL);
DROP POLICY IF EXISTS messages_mod_remove ON public.community_messages;
CREATE POLICY messages_mod_remove ON public.community_messages FOR UPDATE TO authenticated
 USING ((select public.community_is_moderator(auth.uid()))) WITH CHECK ((select public.community_is_moderator(auth.uid())));

DROP POLICY IF EXISTS threads_read ON public.community_threads;
CREATE POLICY threads_read ON public.community_threads FOR SELECT TO anon,authenticated USING (removed_at IS NULL);
DROP POLICY IF EXISTS threads_mod_read ON public.community_threads;
CREATE POLICY threads_mod_read ON public.community_threads FOR SELECT TO authenticated USING ((select public.community_is_moderator(auth.uid())));
DROP POLICY IF EXISTS threads_post ON public.community_threads;
CREATE POLICY threads_post ON public.community_threads FOR INSERT TO authenticated
 WITH CHECK (author_id=(select auth.uid()) AND (select public.community_can_post(auth.uid())) AND removed_at IS NULL AND locked=false);
DROP POLICY IF EXISTS threads_mod_update ON public.community_threads;
CREATE POLICY threads_mod_update ON public.community_threads FOR UPDATE TO authenticated
 USING ((select public.community_is_moderator(auth.uid()))) WITH CHECK ((select public.community_is_moderator(auth.uid())));

DROP POLICY IF EXISTS replies_read ON public.community_replies;
CREATE POLICY replies_read ON public.community_replies FOR SELECT TO anon,authenticated USING (removed_at IS NULL);
DROP POLICY IF EXISTS replies_mod_read ON public.community_replies;
CREATE POLICY replies_mod_read ON public.community_replies FOR SELECT TO authenticated USING ((select public.community_is_moderator(auth.uid())));
DROP POLICY IF EXISTS replies_post ON public.community_replies;
CREATE POLICY replies_post ON public.community_replies FOR INSERT TO authenticated
 WITH CHECK (author_id=(select auth.uid()) AND (select public.community_can_post(auth.uid())) AND removed_at IS NULL
  AND EXISTS (SELECT 1 FROM public.community_threads t WHERE t.id=thread_id AND t.removed_at IS NULL AND t.locked=false));
DROP POLICY IF EXISTS replies_mod_remove ON public.community_replies;
CREATE POLICY replies_mod_remove ON public.community_replies FOR UPDATE TO authenticated
 USING ((select public.community_is_moderator(auth.uid()))) WITH CHECK ((select public.community_is_moderator(auth.uid())));

DROP POLICY IF EXISTS reports_create ON public.community_reports;
CREATE POLICY reports_create ON public.community_reports FOR INSERT TO authenticated
 WITH CHECK (reporter_id=(select auth.uid()) AND status='open');
DROP POLICY IF EXISTS reports_read ON public.community_reports;
CREATE POLICY reports_read ON public.community_reports FOR SELECT TO authenticated
 USING (reporter_id=(select auth.uid()) OR (select public.community_is_moderator(auth.uid())));
DROP POLICY IF EXISTS reports_mod_update ON public.community_reports;
CREATE POLICY reports_mod_update ON public.community_reports FOR UPDATE TO authenticated
 USING ((select public.community_is_moderator(auth.uid()))) WITH CHECK ((select public.community_is_moderator(auth.uid())));

-- Realtime for the live rooms. Do not broadcast reports or private moderation data.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='community_messages') THEN
   ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='community_threads') THEN
   ALTER PUBLICATION supabase_realtime ADD TABLE public.community_threads;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='community_replies') THEN
   ALTER PUBLICATION supabase_realtime ADD TABLE public.community_replies;
  END IF;
 END IF;
END $$;

COMMIT;

-- To grant yourself moderation AFTER signing in at least once, run separately with YOUR EMAIL:
-- INSERT INTO public.community_moderators(user_id)
-- SELECT id FROM auth.users WHERE email = 'your-sign-in-email@example.com' ON CONFLICT DO NOTHING;
-- Never give moderator privileges through the browser or public API.
