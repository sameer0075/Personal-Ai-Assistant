import { pool } from "../../config/database.js";

export type WorkspaceKind = "personal" | "work";

export interface WorkspaceRecord {
  id: string;
  kind: WorkspaceKind;
  name: string;
  departments: Array<{ id: string; name: string; parentId: string | null; isDefault: boolean }>;
}

const DEFAULT_DEPARTMENTS = [
  { name: "QA" },
  { name: "Finance" },
  { name: "HR Management" },
  { name: "HelpDesk" },
  { name: "Sales and Marketing" },
  { name: "Clients", children: ["Leads", "Opportunities", "Appointments"] },
];

async function ensureWorkspace(userId: string, kind: WorkspaceKind, name: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO workspaces (user_id, kind, name) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [userId, kind, name]
  );
  if (result.rows[0]) return result.rows[0].id;

  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM workspaces WHERE user_id = $1 AND kind = $2",
    [userId, kind]
  );
  return existing.rows[0].id;
}

async function ensureDefaultDepartments(workspaceId: string): Promise<void> {
  for (const department of DEFAULT_DEPARTMENTS) {
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM departments WHERE workspace_id = $1 AND parent_id IS NULL AND name = $2 LIMIT 1`,
      [workspaceId, department.name]
    );
    const parent = existing.rows[0]
      ? existing
      : await pool.query<{ id: string }>(
          `INSERT INTO departments (workspace_id, name, is_default) VALUES ($1, $2, true) RETURNING id`,
          [workspaceId, department.name]
        );
    for (const child of department.children ?? []) {
      await pool.query(
        `INSERT INTO departments (workspace_id, parent_id, name, is_default) VALUES ($1, $2, $3, true)
         ON CONFLICT (workspace_id, parent_id, name) DO UPDATE SET is_default = true`,
        [workspaceId, parent.rows[0].id, child]
      );
    }
  }
}

export async function listWorkspaces(userId: string): Promise<WorkspaceRecord[]> {
  const personalId = await ensureWorkspace(userId, "personal", "Personal");
  const workId = await ensureWorkspace(userId, "work", "Work");
  await ensureDefaultDepartments(workId);

  const result = await pool.query<{
    id: string; kind: WorkspaceKind; name: string; department_id: string | null;
    department_name: string | null; parent_id: string | null; is_default: boolean | null;
  }>(
    `SELECT w.id, w.kind, w.name, d.id AS department_id, d.name AS department_name,
            d.parent_id, d.is_default
       FROM workspaces w LEFT JOIN departments d ON d.workspace_id = w.id
      WHERE w.id IN ($1, $2)
      ORDER BY CASE w.kind WHEN 'personal' THEN 0 ELSE 1 END, d.parent_id NULLS FIRST, d.name`,
    [personalId, workId]
  );

  return result.rows.reduce<WorkspaceRecord[]>((items, row) => {
    let workspace = items.find((item) => item.id === row.id);
    if (!workspace) {
      workspace = { id: row.id, kind: row.kind, name: row.name, departments: [] };
      items.push(workspace);
    }
    if (row.department_id && row.department_name) {
      workspace.departments.push({ id: row.department_id, name: row.department_name, parentId: row.parent_id, isDefault: row.is_default ?? false });
    }
    return items;
  }, []);
}

async function assertWorkspaceAccess(userId: string, workspaceId: string): Promise<void> {
  const result = await pool.query("SELECT 1 FROM workspaces WHERE id = $1 AND user_id = $2", [workspaceId, userId]);
  if (!result.rowCount) throw new Error("Workspace not found");
}

export async function createDepartment(
  userId: string,
  workspaceId: string,
  name: string,
  parentId: string | null = null
): Promise<WorkspaceRecord["departments"][number]> {
  await assertWorkspaceAccess(userId, workspaceId);
  if (parentId) {
    const parent = await pool.query("SELECT 1 FROM departments WHERE id = $1 AND workspace_id = $2", [parentId, workspaceId]);
    if (!parent.rowCount) throw new Error("Parent department not found");
  }
  const result = await pool.query<{ id: string; name: string; parent_id: string | null; is_default: boolean }>(
    `INSERT INTO departments (workspace_id, parent_id, name)
     VALUES ($1, $2, $3)
     RETURNING id, name, parent_id, is_default`,
    [workspaceId, parentId, name.trim()]
  );
  const row = result.rows[0];
  return { id: row.id, name: row.name, parentId: row.parent_id, isDefault: row.is_default };
}

export async function updateDepartment(userId: string, workspaceId: string, id: string, name: string): Promise<void> {
  await assertWorkspaceAccess(userId, workspaceId);
  const result = await pool.query(
    `UPDATE departments SET name = $3 WHERE id = $1 AND workspace_id = $2 AND is_default = false`,
    [id, workspaceId, name.trim()]
  );
  if (!result.rowCount) throw new Error("Only custom departments can be edited");
}

export async function deleteDepartment(userId: string, workspaceId: string, id: string): Promise<void> {
  await assertWorkspaceAccess(userId, workspaceId);
  const result = await pool.query(
    `DELETE FROM departments WHERE id = $1 AND workspace_id = $2 AND is_default = false`,
    [id, workspaceId]
  );
  if (!result.rowCount) throw new Error("Default departments cannot be deleted");
}