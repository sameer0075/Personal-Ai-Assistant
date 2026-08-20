-- migrations/xxxx_add_file_storage_to_documents.sql
ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_data BYTEA;