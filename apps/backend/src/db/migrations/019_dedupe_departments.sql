WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY workspace_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name
           ORDER BY created_at, id
         ) AS row_number
  FROM departments
)
DELETE FROM departments
 WHERE id IN (SELECT id FROM duplicates WHERE row_number > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_workspace_parent_name
  ON departments (workspace_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name);