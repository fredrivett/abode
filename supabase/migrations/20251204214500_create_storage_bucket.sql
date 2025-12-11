-- Create the items storage bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'items',
  'items',
  false, -- private bucket
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/json']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the items bucket (idempotent)
DO $$
BEGIN
  -- Allow authenticated users to upload to their own folder
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload to own folder'
  ) THEN
    CREATE POLICY "Users can upload to own folder" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'items'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;

  -- Allow users to view files in their own folder
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can view own files'
  ) THEN
    CREATE POLICY "Users can view own files" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'items'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;

  -- Allow users to update files in their own folder
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update own files'
  ) THEN
    CREATE POLICY "Users can update own files" ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'items'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;

  -- Allow users to delete files in their own folder
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete own files'
  ) THEN
    CREATE POLICY "Users can delete own files" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'items'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;
