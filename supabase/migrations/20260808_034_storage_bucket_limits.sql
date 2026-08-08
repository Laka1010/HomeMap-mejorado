-- Migration: enforce file size/type limits server-side on Storage buckets
-- Date: 2026-08-08
--
-- receipts/entity-photos buckets had no file_size_limit / allowed_mime_types
-- set -- the 5MB + jpeg/png/webp check in src/services/photoUtils.jsx is
-- client-side only. A direct API/SDK call bypassing the UI could upload
-- arbitrarily large or arbitrary-type files. Mirrors the client-side limits
-- (MAX_PHOTO_SIZE = 5MB, ALLOWED_PHOTO_TYPES) at the bucket level so they're
-- enforced regardless of client.

update storage.buckets
set file_size_limit = 5242880, -- 5MB, matches photoUtils.jsx MAX_PHOTO_SIZE
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id in ('receipts', 'entity-photos');

-- EOF
