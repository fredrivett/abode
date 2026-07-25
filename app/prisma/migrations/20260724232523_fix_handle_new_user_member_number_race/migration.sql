-- Serialize member_number assignment in handle_new_user to fix a signup race.
--
-- The trigger reads `SELECT MAX(member_number) + 1` and then INSERTs that value.
-- Two concurrent signups can read the same MAX, compute the same number, and
-- collide on the member_number unique constraint. GoTrue surfaces this as
-- "Database error creating new user" — a real production signup failure and a
-- recurring source of E2E flakiness (every test that creates users runs
-- alongside others).
--
-- A transaction-level advisory lock serializes the read-modify-write so only
-- one signup computes the next number at a time. Numbering stays gapless (no
-- schema change, no sequence), and the lock releases automatically at commit.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $func$
DECLARE
  next_member_number INTEGER;
BEGIN
  -- Concurrent inserts wait here instead of racing on MAX(member_number).
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('public.users.member_number')
  );

  -- Get the next available member number
  SELECT COALESCE(MAX(member_number), 0) + 1
  INTO next_member_number
  FROM public.users;

  -- Insert new user with member number
  INSERT INTO public.users (id, email, member_number, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    next_member_number,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$func$;
