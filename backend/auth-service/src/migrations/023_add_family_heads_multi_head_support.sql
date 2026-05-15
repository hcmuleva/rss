BEGIN;

CREATE TABLE IF NOT EXISTS family_heads (
  id SERIAL PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  family_member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (family_id, family_member_id)
);

CREATE INDEX IF NOT EXISTS idx_family_heads_family ON family_heads(family_id);
CREATE INDEX IF NOT EXISTS idx_family_heads_member ON family_heads(family_member_id);

INSERT INTO family_heads (family_id, family_member_id, is_primary)
SELECT fm.family_id, fm.id, true
FROM family_members fm
LEFT JOIN family_heads fh
  ON fh.family_id = fm.family_id AND fh.family_member_id = fm.id
WHERE fm.active = true
  AND (fm.is_head_of_family = true OR fm.is_head = true)
  AND fh.id IS NULL;

COMMIT;
