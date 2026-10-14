-- Storage access must honour 2FA. The per-bucket policies only check the
-- caller's folder, so a session that signed in with a password but hasn't
-- completed its TOTP challenge (aal1) could still list, read, overwrite and
-- delete the user's files by calling the Storage API directly — the app's own
-- MFA gate (middleware + getUserWithMfa) never sees those requests.

-- Whether the calling user has a verified MFA factor. Policies run as the
-- caller, and `authenticated` can't read auth.mfa_factors, so the lookup runs
-- as the definer. It lives in a schema PostgREST doesn't expose, takes no
-- arguments and only ever answers for auth.uid().
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.current_user_has_verified_mfa()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.mfa_factors
    WHERE user_id = auth.uid() AND status = 'verified'
  );
$$;

REVOKE ALL ON FUNCTION private.current_user_has_verified_mfa() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_user_has_verified_mfa() TO authenticated;

-- A RESTRICTIVE policy is ANDed with every permissive one, so this narrows all
-- authenticated storage access without touching the existing policies: users
-- with a verified factor need an aal2 session; users without one are
-- unaffected. FOR ALL with only USING applies the same check to inserted and
-- updated rows. Public avatar URLs bypass RLS, and the service role bypasses it
-- entirely, so server-side reads (image proxy, exports, enrichment) are
-- unchanged.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Require aal2 when the user has MFA'
  ) THEN
    CREATE POLICY "Require aal2 when the user has MFA" ON storage.objects
    AS RESTRICTIVE
    FOR ALL
    TO authenticated
    USING (
      (select auth.jwt()->>'aal') = 'aal2'
      OR NOT (select private.current_user_has_verified_mfa())
    );
  END IF;
END $$;
