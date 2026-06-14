-- הרץ את הסקריפט הזה פעם אחת בסופאבייס SQL Editor

CREATE TABLE IF NOT EXISTS deleted_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id         UUID NOT NULL,
  member_id           UUID,
  member_name         TEXT,
  amount              NUMERIC,
  type                TEXT,
  method              TEXT,
  greg_date           TEXT,
  heb_date            TEXT,
  notes               TEXT,
  category            TEXT,
  original_created_at TIMESTAMPTZ,
  deleted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by          TEXT
);

ALTER TABLE deleted_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access"
  ON deleted_transactions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
