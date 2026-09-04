import { pool } from "../../config/database.js";

/** Internal row shape - includes passwordHash, unlike the AuthUser type exposed to the frontend. */
export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  createdAt: string;
}

export const userRepository = {
  async createUser(params: { email: string; passwordHash: string; name: string | null }): Promise<UserRow> {
    const { rows } = await pool.query<UserRow>(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, password_hash AS "passwordHash", name, created_at AS "createdAt"`,
      [params.email, params.passwordHash, params.name]
    );
    return rows[0];
  },

  /** Case-insensitive - emails are normalized to lowercase before this is called, but this stays robust either way. */
  async findByEmail(email: string): Promise<UserRow | null> {
    const { rows } = await pool.query<UserRow>(
      `SELECT id, email, password_hash AS "passwordHash", name, created_at AS "createdAt"
       FROM users WHERE lower(email) = lower($1)`,
      [email]
    );
    return rows[0] ?? null;
  },

  async findById(id: string): Promise<UserRow | null> {
    const { rows } = await pool.query<UserRow>(
      `SELECT id, email, password_hash AS "passwordHash", name, created_at AS "createdAt"
       FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] ?? null;
  },
};