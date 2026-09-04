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
 * the shared Postgres database, scoped by userId for multi-user isolation.
 */
export const postsRepository = {
  async record(userId: string, postUrn: string, commentary: string): Promise<void> {
    await pool.query(
      `INSERT INTO linkedin_posts (user_id, post_urn, commentary)
       VALUES ($1, $2, $3)
       ON CONFLICT (post_urn) DO UPDATE SET commentary = EXCLUDED.commentary`,
      [userId, postUrn, commentary]
    );
  },

  async markDeleted(userId: string, postUrn: string): Promise<void> {
    await pool.query(`UPDATE linkedin_posts SET deleted_at = now() WHERE post_urn = $1 AND user_id = $2`, [postUrn, userId]);
  },

  async listRecent(userId: string, maxResults: number): Promise<TrackedPost[]> {
    const { rows } = await pool.query<{ post_urn: string; commentary: string; published_at: string }>(
      `SELECT post_urn, commentary, published_at
       FROM linkedin_posts
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY published_at DESC
       LIMIT $2`,
      [userId, maxResults]
    );

    return rows.map((r) => ({ postUrn: r.post_urn, commentary: r.commentary, publishedAt: r.published_at }));
  },
};