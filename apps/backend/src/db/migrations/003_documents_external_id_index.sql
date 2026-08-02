-- Speeds up documentRepository.findByExternalId(sourceType, externalId),
-- used by Gmail/Calendar ingestion to skip messages/events already indexed.
CREATE INDEX IF NOT EXISTS idx_documents_source_external_id
  ON documents (source_type, (metadata->>'externalId'));