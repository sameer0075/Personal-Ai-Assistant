-- Bridges the backend (which generates images via Gemini) and mcp-linkedin
-- (which uploads them to LinkedIn) - two separate processes that only share
-- this Postgres database, not memory. Storing the actual bytes here means
-- the LLM never has to see/pass a giant base64 blob through its own context;
-- it only ever handles the short `id` returned by the generate_image tool.
--
-- Rows are deleted by mcp-linkedin immediately after a successful upload (see
-- images.repository.ts), so this table should stay small - it's a handoff
-- buffer, not a media library.
CREATE TABLE IF NOT EXISTS generated_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mime_type   TEXT NOT NULL,
  image_data  BYTEA NOT NULL,
  prompt      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Belt-and-suspenders cleanup for images that were generated but never
-- consumed (e.g. the user changed their mind before posting) - anything
-- older than a day is clearly abandoned.
CREATE INDEX IF NOT EXISTS idx_generated_images_created_at ON generated_images (created_at);