import { tool } from "@langchain/core/tools";
import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { pool } from "../../../config/database.js";

function workspaceFrom(config?: RunnableConfig): string {
  const workspaceId = config?.configurable?.workspaceId as string | undefined;
  if (!workspaceId) throw new Error("HR data lookup is missing the active workspace.");
  return workspaceId;
}

export const listHrEmployeesTool = tool(
  async ({ query }: { query?: string }, config?: RunnableConfig) => {
    const workspaceId = workspaceFrom(config);
    const search = query?.trim() || null;
    const { rows } = await pool.query(
      `SELECT full_name AS "fullName", email, phone, role, status, start_date::text AS "startDate"
       FROM hr_employees
       WHERE workspace_id = $1
         AND ($2::text IS NULL OR full_name ILIKE '%' || $2 || '%' OR email ILIKE '%' || $2 || '%' OR role ILIKE '%' || $2 || '%')
       ORDER BY full_name`,
      [workspaceId, search]
    );
    if (!rows.length) return search ? `No HR people matched "${search}".` : "No people are currently recorded in HR.";
    return JSON.stringify(rows);
  },
  {
    name: "hr_list_employees",
    description: "List current employees and candidates from the active Work HR directory. Use this for direct people questions.",
    schema: z.object({ query: z.string().optional().describe("Optional name, email, or role filter") }),
  }
);

export const listHrEventsTool = tool(
  async ({ upcomingOnly }: { upcomingOnly?: boolean }, config?: RunnableConfig) => {
    const workspaceId = workspaceFrom(config);
    const { rows } = await pool.query(
      `SELECT title, description, event_type AS "eventType", starts_at AS "startsAt", ends_at AS "endsAt"
       FROM hr_events
       WHERE workspace_id = $1 AND ($2 = false OR starts_at >= now())
       ORDER BY starts_at`,
      [workspaceId, upcomingOnly ?? true]
    );
    if (!rows.length) return "No HR events are currently scheduled.";
    return JSON.stringify(rows);
  },
  {
    name: "hr_list_events",
    description: "List internal HR events from the active Work workspace.",
    schema: z.object({ upcomingOnly: z.boolean().optional().describe("Only return events from now onward") }),
  }
);

export const listHrApplicantsTool = tool(
  async ({ query, stage }: { query?: string; stage?: string }, config?: RunnableConfig) => {
    const workspaceId = workspaceFrom(config);
    const search = query?.trim() || null;
    const { rows } = await pool.query(
      `SELECT a.full_name AS "fullName", a.email, a.phone, a.stage, a.source, COALESCE(j.title, a.position) AS "position",
              a.cover_letter AS "coverLetter", a.notes, a.created_at AS "appliedAt",
              (a.resume_document_id IS NOT NULL) AS "hasCv"
       FROM hr_applicants a LEFT JOIN hr_jobs j ON j.id = a.job_id
       WHERE a.workspace_id = $1
         AND ($2::text IS NULL OR a.stage = $2)
         AND ($3::text IS NULL OR a.full_name ILIKE '%' || $3 || '%' OR a.email ILIKE '%' || $3 || '%' OR j.title ILIKE '%' || $3 || '%' OR a.position ILIKE '%' || $3 || '%')
       ORDER BY a.created_at DESC
       LIMIT 100`,
      [workspaceId, stage ?? null, search]
    );
    if (!rows.length) return search || stage ? "No applicants matched that filter." : "No applicants have been recorded yet.";
    return JSON.stringify(rows);
  },
  {
    name: "hr_list_applicants",
    description:
      "List job applicants in the active Work workspace (name, contact, pipeline stage, position applied for, cover letter, notes). " +
      "Their CV contents are in the knowledge base - use search_knowledge_base with the applicant's name to read a CV.",
    schema: z.object({
      query: z.string().optional().describe("Optional name, email, or position filter"),
      stage: z.enum(["new", "screening", "interview", "offer", "hired", "rejected"]).optional().describe("Optional pipeline stage filter"),
    }),
  }
);

export const listHrJobsTool = tool(
  async ({ status }: { status?: string }, config?: RunnableConfig) => {
    const workspaceId = workspaceFrom(config);
    const { rows } = await pool.query(
      `SELECT j.title, j.team, j.location, j.employment_type AS "employmentType", j.status, j.description,
              (SELECT count(*)::int FROM hr_applicants WHERE job_id = j.id) AS "applicantCount"
       FROM hr_jobs j
       WHERE j.workspace_id = $1 AND ($2::text IS NULL OR j.status = $2)
       ORDER BY j.created_at DESC`,
      [workspaceId, status ?? null]
    );
    if (!rows.length) return "No job openings are recorded.";
    return JSON.stringify(rows);
  },
  {
    name: "hr_list_jobs",
    description: "List job openings in the active Work workspace with their status and applicant counts.",
    schema: z.object({ status: z.enum(["draft", "open", "closed"]).optional().describe("Optional status filter") }),
  }
);

/**
 * One-call snapshot of the whole HR department, for broad questions ("what do
 * we have in HR", "give me all HR data"). Without it the agent tends to
 * describe its capabilities instead of making four separate lookups.
 */
export const hrOverviewTool = tool(
  async (_input: Record<string, never>, config?: RunnableConfig) => {
    const workspaceId = workspaceFrom(config);
    const [employees, applicants, jobs, events, documents] = await Promise.all([
      pool.query(
        `SELECT full_name AS "name", role, status, email, phone, start_date::text AS "startDate", (resume_document_id IS NOT NULL) AS "hasCv"
         FROM hr_employees WHERE workspace_id = $1 ORDER BY full_name LIMIT 100`,
        [workspaceId]
      ),
      pool.query(
        `SELECT a.full_name AS "name", COALESCE(j.title, a.position) AS "position", a.stage, a.source, a.email, a.created_at::date::text AS "appliedOn"
         FROM hr_applicants a LEFT JOIN hr_jobs j ON j.id = a.job_id
         WHERE a.workspace_id = $1 ORDER BY a.created_at DESC LIMIT 100`,
        [workspaceId]
      ),
      pool.query(
        `SELECT j.title, j.team, j.location, j.employment_type AS "employmentType", j.status,
                (SELECT count(*)::int FROM hr_applicants WHERE job_id = j.id) AS "applicants"
         FROM hr_jobs j WHERE j.workspace_id = $1 ORDER BY j.created_at DESC LIMIT 100`,
        [workspaceId]
      ),
      pool.query(
        `SELECT title, event_type AS "type", starts_at AS "startsAt", ends_at AS "endsAt"
         FROM hr_events WHERE workspace_id = $1 AND COALESCE(ends_at, starts_at) >= now() - interval '30 days'
         ORDER BY starts_at LIMIT 50`,
        [workspaceId]
      ),
      pool.query(
        `SELECT title, COALESCE(metadata->>'resourceKind', 'other') AS "kind", created_at::date::text AS "uploadedOn"
         FROM documents
         WHERE workspace_id = $1 AND metadata->>'department' = 'hr' AND COALESCE(metadata->>'resourceKind', 'other') <> 'cv'
         ORDER BY created_at DESC LIMIT 100`,
        [workspaceId]
      ),
    ]);
    return JSON.stringify({
      people: { count: employees.rowCount, records: employees.rows },
      applicants: { count: applicants.rowCount, records: applicants.rows },
      jobs: { count: jobs.rowCount, records: jobs.rows },
      eventsFromLast30DaysOnward: { count: events.rowCount, records: events.rows },
      policiesAndDocuments: { count: documents.rowCount, records: documents.rows },
    });
  },
  {
    name: "hr_overview",
    description:
      "Complete snapshot of the HR department in the active Work workspace: all people, applicants, job openings, " +
      "upcoming/recent events, and policy/document titles, with counts. Call this for broad questions like " +
      "'what do we have in HR', 'show all HR data', 'HR summary', or 'overview'.",
    schema: z.object({}),
  }
);
