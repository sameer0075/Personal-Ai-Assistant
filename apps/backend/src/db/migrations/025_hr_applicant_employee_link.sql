-- Which People record an applicant was moved to. Tracked separately from the
-- stage so "Hired" chosen from the dropdown can still be moved to People, and
-- nobody gets added twice.
ALTER TABLE hr_applicants ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES hr_employees(id) ON DELETE SET NULL;
