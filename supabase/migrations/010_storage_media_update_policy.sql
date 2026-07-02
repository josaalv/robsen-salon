CREATE POLICY "media_update" ON storage.objects FOR UPDATE TO public USING (bucket_id = 'media') WITH CHECK (bucket_id = 'media');
