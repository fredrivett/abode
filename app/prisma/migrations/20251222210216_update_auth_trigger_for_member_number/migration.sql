-- Update handle_new_user trigger to assign member numbers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    -- Update the trigger function to assign the next available member number
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER SET search_path = ''
    AS $func$
    DECLARE
      next_member_number INTEGER;
    BEGIN
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
  END IF;
END $$;
