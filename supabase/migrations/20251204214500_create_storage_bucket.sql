-- Create the items storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'items',
  'items',
  false, -- private bucket
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/json']
);

-- RLS policies for the items bucket

-- Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload to own folder" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'items'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to view files in their own folder
CREATE POLICY "Users can view own files" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'items'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update files in their own folder
CREATE POLICY "Users can update own files" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'items'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete files in their own folder
CREATE POLICY "Users can delete own files" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'items'
  AND (storage.foldername(name))[1] = auth.uid()::text
);