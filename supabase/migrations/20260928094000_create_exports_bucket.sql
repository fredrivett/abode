-- Private bucket for data-export archives (app/src/lib/export). Objects live at
-- {userId}/{exportId}.zip and are written and served (via short-lived signed
-- URLs) by the service role only, so there are deliberately no storage.objects
-- policies: authenticated/anon clients can't list, read or write here.
-- file_size_limit is NULL so archives are bounded by the project-wide limit.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exports',
  'exports',
  false,
  NULL,
  ARRAY['application/zip']
)
ON CONFLICT (id) DO NOTHING;
