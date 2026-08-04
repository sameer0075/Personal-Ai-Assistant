import { pool } from "../config/database.js";

export interface TrackedPost {
  postUrn: string;
  commentary: string;
  publishedAt: string;
}

/**
 * LinkedIn restricts reading a personal profile's own post history
 * (r_member_social) to specially-approved apps, so this server can't just ask
 * LinkedIn "what have I posted lately". Instead, every post this server
 * creates gets a row here, and linkedin_list_recent_posts reads from this
 * table instead of LinkedIn's API. The `linkedin_posts` table itself lives in
 * the shared Postgres database, defined in apps/backend's migrations.
 */
export const postsRepository = {
  async record(postUrn: string, commentary: string): Promise<void> {
    await pool.query(
      `INSERT INTO linkedin_posts (post_urn, commentary)
       VALUES ($1, $2)
       ON CONFLICT (post_urn) DO NOTHING`,
      [postUrn, commentary]
    );
  },

  async markDeleted(postUrn: string): Promise<void> {
    await pool.query(`UPDATE linkedin_posts SET deleted_at = now() WHERE post_urn = $1`, [postUrn]);
  },

  async listRecent(maxResults: number): Promise<TrackedPost[]> {
    const { rows } = await pool.query<{ post_urn: string; commentary: string; published_at: string }>(
      `SELECT post_urn, commentary, published_at
       FROM linkedin_posts
       WHERE deleted_at IS NULL
       ORDER BY published_at DESC
       LIMIT $1`,
      [maxResults]
    );

    return rows.map((r) => ({ postUrn: r.post_urn, commentary: r.commentary, publishedAt: r.published_at }));
  },
};