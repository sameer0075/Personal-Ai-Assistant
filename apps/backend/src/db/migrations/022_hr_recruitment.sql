-- Recruitment: open positions, inbound applicants, and a per-workspace public
-- intake token that career sites use to submit applications.
CREATE TABLE IF NOT EXISTS hr_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  team TEXT,
  location TEXT,
  employment_type TEXT NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'internship')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  job_id UUID REFERENCES hr_jobs(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  cover_letter TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'career_site')),
  stage TEXT NOT NULL DEFAULT 'new' CHECK (stage IN ('new', 'screening', 'interview', 'offer', 'hired', 'rejected')),
  resume_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_jobs_workspace ON hr_jobs (workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_applicants_workspace ON hr_applicants (workspace_id, stage, created_at DESC);

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS hr_intake_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_hr_intake_token ON workspaces (hr_intake_token) WHERE hr_intake_token IS NOT NULL;
