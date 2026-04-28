import pool from './db';

// ---- Types ------------------------------------------------------------------

export interface WeldSession {
  id: string;
  user_id: string;
  created_at: Date;
  machine_config: Record<string, unknown>;
}

export interface WeldDiagnosis {
  id: string;
  session_id: string;
  image_url: string | null;
  defect_type: string;
  parameters: Record<string, unknown>;
  outcome: string | null;
  created_at: Date;
}

export interface UserPreferences {
  user_id: string;
  last_material: string | null;
  last_process: string | null;
  last_voltage: number | null;
  last_wire_speed: number | null;
  notes: string | null;
}

export interface SaveSessionInput {
  userId: string;
  machineConfig: Record<string, unknown>;
}

export interface SaveDiagnosisInput {
  sessionId: string;
  imageUrl?: string;
  defectType: string;
  parameters: Record<string, unknown>;
  outcome?: string;
}

// ---- Sessions ---------------------------------------------------------------

export async function saveSession(input: SaveSessionInput): Promise<WeldSession> {
  const { rows } = await pool.query<WeldSession>(
    `INSERT INTO weld_sessions (user_id, machine_config)
     VALUES ($1, $2)
     RETURNING *`,
    [input.userId, JSON.stringify(input.machineConfig)],
  );
  return rows[0];
}

// ---- Diagnoses --------------------------------------------------------------

export async function saveDiagnosis(input: SaveDiagnosisInput): Promise<WeldDiagnosis> {
  const { rows } = await pool.query<WeldDiagnosis>(
    `INSERT INTO weld_diagnoses (session_id, image_url, defect_type, parameters, outcome)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.sessionId,
      input.imageUrl ?? null,
      input.defectType,
      JSON.stringify(input.parameters),
      input.outcome ?? null,
    ],
  );
  return rows[0];
}

export async function getRecentDiagnoses(
  userId: string,
  limit = 5,
): Promise<WeldDiagnosis[]> {
  const { rows } = await pool.query<WeldDiagnosis>(
    `SELECT d.*
     FROM weld_diagnoses d
     JOIN weld_sessions s ON s.id = d.session_id
     WHERE s.user_id = $1
     ORDER BY d.created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return rows;
}

export async function getSimilarDefects(defectType: string): Promise<WeldDiagnosis[]> {
  const { rows } = await pool.query<WeldDiagnosis>(
    `SELECT *
     FROM weld_diagnoses
     WHERE defect_type = $1
     ORDER BY created_at DESC`,
    [defectType],
  );
  return rows;
}

// ---- User preferences -------------------------------------------------------

export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  const { rows } = await pool.query<UserPreferences>(
    `SELECT * FROM user_preferences WHERE user_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function upsertUserPreferences(
  prefs: Partial<UserPreferences> & { user_id: string },
): Promise<UserPreferences> {
  const { rows } = await pool.query<UserPreferences>(
    `INSERT INTO user_preferences (user_id, last_material, last_process, last_voltage, last_wire_speed, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE SET
       last_material   = COALESCE(EXCLUDED.last_material,   user_preferences.last_material),
       last_process    = COALESCE(EXCLUDED.last_process,    user_preferences.last_process),
       last_voltage    = COALESCE(EXCLUDED.last_voltage,    user_preferences.last_voltage),
       last_wire_speed = COALESCE(EXCLUDED.last_wire_speed, user_preferences.last_wire_speed),
       notes           = COALESCE(EXCLUDED.notes,           user_preferences.notes)
     RETURNING *`,
    [
      prefs.user_id,
      prefs.last_material ?? null,
      prefs.last_process ?? null,
      prefs.last_voltage ?? null,
      prefs.last_wire_speed ?? null,
      prefs.notes ?? null,
    ],
  );
  return rows[0];
}
