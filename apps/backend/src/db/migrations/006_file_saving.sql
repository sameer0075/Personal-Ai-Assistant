-- migrations/xxxx_add_file_storage_to_documents.sql
ALTER TABLE documents ADD COLUMN file_data BYTEA;
ALTER TABLE documents ADD COLUMN mime_type TEXT;