-- Free-text position for applicants whose role isn't (yet) a listed job opening.
ALTER TABLE hr_applicants ADD COLUMN IF NOT EXISTS position TEXT;
