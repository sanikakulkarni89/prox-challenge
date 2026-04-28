-- Weld session memory schema

CREATE TABLE IF NOT EXISTS weld_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  machine_config JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS weld_sessions_user_id_idx ON weld_sessions (user_id);

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS weld_diagnoses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES weld_sessions(id) ON DELETE CASCADE,
  image_url   TEXT,
  defect_type TEXT NOT NULL,
  parameters  JSONB NOT NULL DEFAULT '{}',
  outcome     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS weld_diagnoses_session_id_idx  ON weld_diagnoses (session_id);
CREATE INDEX IF NOT EXISTS weld_diagnoses_defect_type_idx ON weld_diagnoses (defect_type);

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id         TEXT PRIMARY KEY,
  last_material   TEXT,
  last_process    TEXT,
  last_voltage    NUMERIC,
  last_wire_speed NUMERIC,
  notes           TEXT
);
