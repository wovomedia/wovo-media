update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/ogg',
  'audio/mp4',
  'audio/aac'
]::text[]
where id = 'wovo-portal-assets';
