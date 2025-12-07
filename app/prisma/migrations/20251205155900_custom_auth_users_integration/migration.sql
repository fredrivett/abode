-- Custom: Sync public.users with auth.users via triggers (only if auth schema exists)
-- Note: We don't use a foreign key constraint to avoid Prisma trying to manage the auth schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    -- Custom: Trigger to auto-create public.users when auth.users is created
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER SET search_path = ''
    AS $func$
    BEGIN
      INSERT INTO public.users (id, email, created_at, updated_at)
      VALUES (
        NEW.id,
        NEW.email,
        NOW(),
        NOW()
      );
      RETURN NEW;
    END;
    $func$;

    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

    -- Custom: Trigger to handle user deletion (backup to CASCADE)
    CREATE OR REPLACE FUNCTION public.handle_user_deleted()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER SET search_path = ''
    AS $func$
    BEGIN
      DELETE FROM public.users WHERE id = OLD.id;
      RETURN OLD;
    END;
    $func$;

    DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
    CREATE TRIGGER on_auth_user_deleted
      BEFORE DELETE ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_user_deleted();
  END IF;
END $$;
