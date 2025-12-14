-- Reduce Supabase Storage items bucket file size limit to 15MB
-- In environments without the Supabase storage schema, this is a no-op
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    UPDATE storage.buckets
    SET file_size_limit = 15728640
    WHERE id = 'items';
  END IF;
END $$;

