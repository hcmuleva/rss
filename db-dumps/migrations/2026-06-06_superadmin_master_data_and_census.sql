-- =====================================================================
-- Migration: SuperAdmin master data + Census (अन्य जानकारी) + Activity counts
-- Date:      2026-06-06
-- Database:  rss  (shared by auth-service and karyakarini-service)
--
-- This migration is IDEMPOTENT and safe to run multiple times:
--   * tables use CREATE TABLE IF NOT EXISTS
--   * indexes use CREATE INDEX IF NOT EXISTS
--   * columns use ALTER TABLE ... ADD COLUMN IF NOT EXISTS
--   * default/seed rows only insert when the target table is still empty
--
-- Apply with:
--   psql -h <host> -p <port> -U <user> -d rss \
--        -f 2026-06-06_superadmin_master_data_and_census.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. users.role  (used to grant the SuperAdmin role)
--    Usually already present; added defensively for older databases.
--    NOTE: the actual SuperAdmin user is auto-created/promoted by
--    auth-service on boot via User.seedSuperAdmin() (env SUPERADMIN_*).
-- ---------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- =====================================================================
-- SECTION A - auth-service: SuperAdmin master data
-- =====================================================================

-- A1. Categories (आयाम) ------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  is_active  BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_active
  ON categories (lower(name)) WHERE is_active = true;

INSERT INTO categories (name)
SELECT v.name
FROM (VALUES
  ('संस्कृति प्रमुख'),
  ('निधी प्रमुख'),
  ('विधी प्रमुख'),
  ('प्रलेखन प्रमुख'),
  ('परियोजना प्रमुख'),
  ('मातृशक्ति T-8'),
  ('वंशावली प्रमुख'),
  ('पुर्णकालिक')
) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM categories);

-- A2. Subcategories (टोली) --------------------------------------------
CREATE TABLE IF NOT EXISTS subcategories (
  id          SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subcategories_cat_name_active
  ON subcategories (category_id, lower(name)) WHERE is_active = true;

INSERT INTO subcategories (category_id, name)
SELECT c.id, v.name
FROM (VALUES
  ('संस्कृति प्रमुख','साधु संत'),
  ('संस्कृति प्रमुख','महंत'),
  ('संस्कृति प्रमुख','मठ/मन्दिर के ट्रस्टी'),
  ('संस्कृति प्रमुख','पुजारी पुरोहित'),
  ('संस्कृति प्रमुख','भगत'),
  ('संस्कृति प्रमुख','बड़वा'),
  ('संस्कृति प्रमुख','तडवी पटेल'),
  ('संस्कृति प्रमुख','कथाकार प्रवचनकार'),
  ('संस्कृति प्रमुख','तांत्रिक'),
  ('संस्कृति प्रमुख','मांत्रिक'),
  ('संस्कृति प्रमुख','ज्योतिष'),
  ('संस्कृति प्रमुख','भजनमण्डली'),
  ('संस्कृति प्रमुख','सुन्दरकाण्ड'),
  ('संस्कृति प्रमुख','धार्मिक संगठन'),
  ('निधी प्रमुख','व्यवसायी'),
  ('निधी प्रमुख','उद्योगपति'),
  ('निधी प्रमुख','कर्मचारी'),
  ('निधी प्रमुख','कृषक'),
  ('निधी प्रमुख','CA'),
  ('विधी प्रमुख','फौजदारी'),
  ('विधी प्रमुख','दिवानी'),
  ('विधी प्रमुख','राजस्व'),
  ('विधी प्रमुख','नोटरी'),
  ('विधी प्रमुख','सुचना का अधिकार'),
  ('प्रलेखन प्रमुख','परियोजना प्रलेखन प्रमुख'),
  ('परियोजना प्रमुख','चिन्हित परियोजना सुची'),
  ('परियोजना प्रमुख','क्रियान्वित परियोजना'),
  ('परियोजना प्रमुख','प्रमुख'),
  ('परियोजना प्रमुख','टोली'),
  ('मातृशक्ति T-8','सामाजिक क्षेत्र'),
  ('मातृशक्ति T-8','धार्मिक क्षेत्र'),
  ('मातृशक्ति T-8','शैक्षणिक क्षैत्र'),
  ('मातृशक्ति T-8','राजनैतिक क्षेत्र'),
  ('मातृशक्ति T-8','धार्मिक संस्था नवपंथ'),
  ('मातृशक्ति T-8','प्रवचन'),
  ('मातृशक्ति T-8','कथाकार'),
  ('मातृशक्ति T-8','शासकीय सेवा'),
  ('मातृशक्ति T-8','परावर्तित महीला'),
  ('वंशावली प्रमुख','वंशावली लेखक सुची'),
  ('पुर्णकालिक','सुची'),
  ('पुर्णकालिक','क्षेत्र'),
  ('पुर्णकालिक','परियोजना')
) AS v(category, name)
JOIN categories c ON lower(c.name) = lower(v.category)
WHERE NOT EXISTS (SELECT 1 FROM subcategories);

-- A3. Levels (स्तर) ----------------------------------------------------
CREATE TABLE IF NOT EXISTS levels (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  code        VARCHAR(120),
  level_order INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  is_dynamic  BOOLEAN DEFAULT false,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

INSERT INTO levels (name, code, level_order, is_dynamic)
SELECT v.name, v.code, v.ord, false
FROM (VALUES
  ('राष्ट्रीय','rashtriya',1),
  ('प्रान्त','prant',2),
  ('संभाग','sambhag',3),
  ('विभाग','vibhag',4),
  ('जिला','jila',5),
  ('खंड','khand',6),
  ('मंडल','mandal',7),
  ('नगर','nagar',8),
  ('ग्राम','gram',9),
  ('बस्ती','basti',10),
  ('मोहल्ला','mohalla',11)
) AS v(name, code, ord)
WHERE NOT EXISTS (SELECT 1 FROM levels);

-- A4. Karyakshetras (कार्यक्षेत्र master list) -------------------------
CREATE TABLE IF NOT EXISTS karyakshetras (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  is_active  BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_karyakshetras_name_active
  ON karyakshetras (lower(name)) WHERE is_active = true;

-- A5. Level constraints (parent-level rules) --------------------------
CREATE TABLE IF NOT EXISTS level_constraints (
  id           SERIAL PRIMARY KEY,
  child_level  VARCHAR(120) NOT NULL,
  parent_level VARCHAR(120),
  created_at   TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_level_constraints_pair
  ON level_constraints (child_level, parent_level) WHERE parent_level IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_level_constraints_root
  ON level_constraints (child_level) WHERE parent_level IS NULL;

INSERT INTO level_constraints (child_level, parent_level)
SELECT v.child, v.parent
FROM (VALUES
  ('rashtriya', NULL::varchar),
  ('prant',     'rashtriya'),
  ('sambhag',   'prant'),
  ('vibhag',    'sambhag'),
  ('jila',      'vibhag'),
  ('khand',     'jila'),
  ('mandal',    'khand'),
  ('nagar',     'khand'),
  ('gram',      'mandal'),
  ('basti',     'nagar'),
  ('mohalla',   'basti')
) AS v(child, parent)
WHERE NOT EXISTS (SELECT 1 FROM level_constraints);

-- A6. Audit log -------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id           SERIAL PRIMARY KEY,
  actor_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_name   VARCHAR(255),
  action       VARCHAR(40) NOT NULL,
  entity_type  VARCHAR(60) NOT NULL,
  entity_id    INTEGER,
  entity_label VARCHAR(255),
  details      JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity  ON audit_logs (entity_type);

-- =====================================================================
-- SECTION B - karyakarini-service
-- =====================================================================

-- B1. Census / "अन्य जानकारी" per user (gender + religion) ------------
CREATE TABLE IF NOT EXISTS user_other_information (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  gender_type VARCHAR(20),
  religion    VARCHAR(20),
  created_by  INTEGER,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- B2. कार्यक्रम (category activities) population + date + status columns
--     The base table is auto-created by karyakarini-service on boot;
--     these columns back the per-card counts and कुल जनसंख्या feature.
ALTER TABLE karyakarini_category_activities ADD COLUMN IF NOT EXISTS male_count     INTEGER DEFAULT 0;
ALTER TABLE karyakarini_category_activities ADD COLUMN IF NOT EXISTS female_count   INTEGER DEFAULT 0;
ALTER TABLE karyakarini_category_activities ADD COLUMN IF NOT EXISTS children_count INTEGER DEFAULT 0;
ALTER TABLE karyakarini_category_activities ADD COLUMN IF NOT EXISTS from_date      DATE;
ALTER TABLE karyakarini_category_activities ADD COLUMN IF NOT EXISTS to_date        DATE;
ALTER TABLE karyakarini_category_activities ADD COLUMN IF NOT EXISTS status         VARCHAR(30) DEFAULT 'open';

-- B3. Place hierarchy: DELETE ALL nodes, then SEED the full tree --------
--     Mirrors apps/level_node.json and the service's seedHierarchyFromLevelNode
--     mapping: प्रान्त > संभाग > विभाग > जिला > खण्ड > मण्डल > ग्राम,
--     plus खण्ड > नगर > बस्ती > मोहल्ला and जिला > बस्ती > मोहल्ला.
--     The whole tree JSON is embedded below and walked with jsonb functions.
--     WARNING: this DELETEs every row in karyakarini_nodes (cascading to
--     members/teams/meetings/tasks/etc.) and rebuilds the tree from scratch.
--     Skips silently if karyakarini tables are not present yet (service
--     auto-creates them on boot).
DO $$
DECLARE
  doc jsonb := $json$
{
  "प्रान्त": "मालवा",
  "संभाग": [
    {
      "नाम": "इन्दौर",
      "विभाग": [
        {
          "नाम": "धार",
          "जिला": [
            {
              "नाम": "धार",
              "खण्ड": [
                { "नाम": "धार", "मण्डल": [ { "नाम": "धार", "ग्राम_मोहल्ला": [] } ] },
                { "नाम": "अमझेरा", "मण्डल": [] },
                {
                  "नाम": "राजगढ",
                  "मण्डल": [
                    { "नाम": "रिंगनोद",   "ग्राम_मोहल्ला": ["रिंगनोद","कंजरोटा","लिमडीपाडा","मालपुरीया","उन्ढेड","उजाडीया","नयापुरा"] },
                    { "नाम": "गुमानपुरा", "ग्राम_मोहल्ला": ["गुमानपुरा","सेमलिया","बरखेडा","पाडल्या"] },
                    { "नाम": "बडोदीया",   "ग्राम_मोहल्ला": ["बडोदीया","खेडा","सुल्तानपुर","अमोदिया"] },
                    { "नाम": "बलेडी",     "ग्राम_मोहल्ला": ["बलेडी","नांदिया","काछीबडोदा"] },
                    { "नाम": "पीपरनी",    "ग्राम_मोहल्ला": ["पीपरनी","धतुरिया","गुणावद"] },
                    { "नाम": "तीरला",     "ग्राम_मोहल्ला": ["तीरला","बिलोदा","सादलपुर","मोरगढ"] },
                    { "नाम": "दत्तिगाव",  "ग्राम_मोहल्ला": ["दत्तिगाव","चिकलिया","रूपगढ"] },
                    { "नाम": "कुशलपुरा",  "ग्राम_मोहल्ला": ["कुशलपुरा","बावडीखेडा"] },
                    { "नाम": "भानगढ",     "ग्राम_मोहल्ला": ["भानगढ","हनुमंतिया"] },
                    { "नाम": "जोलाना",    "ग्राम_मोहल्ला": ["जोलाना","सेजावता"] },
                    { "नाम": "फुलगावडी",  "ग्राम_मोहल्ला": ["फुलगावडी","पलासिया"] }
                  ]
                },
                { "नाम": "बदनावर", "मण्डल": [] },
                { "नाम": "कानवन", "मण्डल": [] },
                { "नाम": "घाटाबिल्लोद", "मण्डल": [] },
                { "नाम": "धामनोद", "मण्डल": [] },
                { "नाम": "नालच्छा", "मण्डल": [] }
              ],
              "बस्ती": [
                { "नाम": "पीथमपुर", "मण्डल": [] },
                { "नाम": "राजगढ़", "वार्ड": ["गोविदसिह","महाराणाप्रताप","केशव","माधव"] },
                { "नाम": "सरदारपुर", "वार्ड": ["केशव","माधव"] }
              ]
            },
            { "नाम": "कुक्षी", "खण्ड": [], "बस्ती": [] },
            { "नाम": "आलिराजपुर", "खण्ड": [], "बस्ती": [] }
          ]
        },
        { "नाम": "इन्दौर", "जिला": [] },
        { "नाम": "खरगोन", "जिला": [] },
        { "नाम": "खण्डवा", "जिला": [] }
      ]
    },
    {
      "नाम": "उज्जैन",
      "विभाग": [
        { "नाम": "दैवास", "जिला": [] },
        { "नाम": "उज्जैन", "जिला": [] },
        { "नाम": "मन्दसोर", "जिला": [] },
        { "नाम": "रतलाम", "जिला": [] }
      ]
    }
  ]
}
$json$::jsonb;
  v_version_id INTEGER;
  v_root_id    BIGINT;
  v_prant_id   BIGINT;
  v_sambhag_id BIGINT;
  v_vibhag_id  BIGINT;
  v_jila_id    BIGINT;
  v_khand_id   BIGINT;
  v_mandal_id  BIGINT;
  v_nagar_id   BIGINT;
  v_basti_id   BIGINT;
  rs RECORD; rv RECORD; rj RECORD; rk RECORD; rm RECORD; rn RECORD; rb RECORD;
  txt TEXT; idx INT;
BEGIN
  IF to_regclass('public.karyakarini_nodes') IS NULL
     OR to_regclass('public.karyakarini_versions') IS NULL THEN
    RAISE NOTICE 'karyakarini tables not found - skipping tree seed';
    RETURN;
  END IF;

  -- Current (or first) version; create a default if none exists.
  SELECT id INTO v_version_id
  FROM karyakarini_versions
  ORDER BY is_current DESC, id ASC
  LIMIT 1;
  IF v_version_id IS NULL THEN
    INSERT INTO karyakarini_versions (name, start_year, end_year, is_current, is_active)
    VALUES ('2024-2026', 2024, 2026, true, true)
    RETURNING id INTO v_version_id;
  END IF;

  -- Wipe the whole tree (FKs cascade / set null) and rebuild.
  DELETE FROM karyakarini_nodes;

  -- Root राष्ट्रीय
  INSERT INTO karyakarini_nodes (name, level, parent_id, version_id, sort_order)
  VALUES ('राष्ट्रीय','rashtriya',NULL,v_version_id,0) RETURNING id INTO v_root_id;

  -- प्रान्त
  INSERT INTO karyakarini_nodes (name, level, parent_id, version_id, sort_order)
  VALUES (COALESCE(doc->>'प्रान्त','प्रान्त'),'prant',v_root_id,v_version_id,0)
  RETURNING id INTO v_prant_id;

  FOR rs IN SELECT value, ordinality-1 AS ord
              FROM jsonb_array_elements(COALESCE(doc->'संभाग','[]'::jsonb))
              WITH ORDINALITY AS t(value, ordinality)
  LOOP
    INSERT INTO karyakarini_nodes (name, level, parent_id, version_id, sort_order)
    VALUES (COALESCE(rs.value->>'नाम','संभाग'),'sambhag',v_prant_id,v_version_id,rs.ord)
    RETURNING id INTO v_sambhag_id;

    FOR rv IN SELECT value, ordinality-1 AS ord
                FROM jsonb_array_elements(COALESCE(rs.value->'विभाग','[]'::jsonb))
                WITH ORDINALITY AS t(value, ordinality)
    LOOP
      INSERT INTO karyakarini_nodes (name, level, parent_id, version_id, sort_order)
      VALUES (COALESCE(rv.value->>'नाम','विभाग'),'vibhag',v_sambhag_id,v_version_id,rv.ord)
      RETURNING id INTO v_vibhag_id;

      FOR rj IN SELECT value, ordinality-1 AS ord
                  FROM jsonb_array_elements(COALESCE(rv.value->'जिला','[]'::jsonb))
                  WITH ORDINALITY AS t(value, ordinality)
      LOOP
        INSERT INTO karyakarini_nodes (name, level, parent_id, version_id, sort_order)
        VALUES (COALESCE(rj.value->>'नाम','जिला'),'jila',v_vibhag_id,v_version_id,rj.ord)
        RETURNING id INTO v_jila_id;

        -- खण्ड under जिला
        FOR rk IN SELECT value, ordinality-1 AS ord
                    FROM jsonb_array_elements(COALESCE(rj.value->'खण्ड','[]'::jsonb))
                    WITH ORDINALITY AS t(value, ordinality)
        LOOP
          INSERT INTO karyakarini_nodes (name, level, parent_id, version_id, sort_order)
          VALUES (COALESCE(rk.value->>'नाम','खण्ड'),'khand',v_jila_id,v_version_id,rk.ord)
          RETURNING id INTO v_khand_id;

          -- मण्डल / मंडल under खण्ड
          FOR rm IN SELECT value, ordinality-1 AS ord
                      FROM jsonb_array_elements(COALESCE(rk.value->'मण्डल', rk.value->'मंडल','[]'::jsonb))
                      WITH ORDINALITY AS t(value, ordinality)
          LOOP
            INSERT INTO karyakarini_nodes (name, level, parent_id, version_id, sort_order)
            VALUES (COALESCE(rm.value->>'नाम','मंडल'),'mandal',v_khand_id,v_version_id,rm.ord)
            RETURNING id INTO v_mandal_id;

            -- ग्राम / ग्राम_मोहल्ला (string array) under मण्डल
            idx := 0;
            FOR txt IN SELECT value
                         FROM jsonb_array_elements_text(COALESCE(rm.value->'ग्राम', rm.value->'ग्राम_मोहल्ला','[]'::jsonb))
            LOOP
              IF length(btrim(txt)) > 0 THEN
                INSERT INTO karyakarini_nodes (name, level, parent_id, version_id, sort_order)
                VALUES (btrim(txt),'gram',v_mandal_id,v_version_id,idx);
              END IF;
              idx := idx + 1;
            END LOOP;
          END LOOP;

          -- नगर under खण्ड
          FOR rn IN SELECT value, ordinality-1 AS ord
                      FROM jsonb_array_elements(COALESCE(rk.value->'नगर','[]'::jsonb))
                      WITH ORDINALITY AS t(value, ordinality)
          LOOP
            INSERT INTO karyakarini_nodes (name, level, parent_id, version_id, sort_order)
            VALUES (COALESCE(rn.value->>'नाम','नगर'),'nagar',v_khand_id,v_version_id,rn.ord)
            RETURNING id INTO v_nagar_id;

            FOR rb IN SELECT value, ordinality-1 AS ord
                        FROM jsonb_array_elements(COALESCE(rn.value->'बस्ती','[]'::jsonb))
                        WITH ORDINALITY AS t(value, ordinality)
            LOOP
              INSERT INTO karyakarini_nodes (name, level, parent_id, version_id, sort_order)
              VALUES (COALESCE(rb.value->>'नाम','बस्ती'),'basti',v_nagar_id,v_version_id,rb.ord)
              RETURNING id INTO v_basti_id;

              idx := 0;
              FOR txt IN SELECT value
                           FROM jsonb_array_elements_text(COALESCE(rb.value->'मोहल्ला', rb.value->'वार्ड','[]'::jsonb))
              LOOP
                IF length(btrim(txt)) > 0 THEN
                  INSERT INTO karyakarini_nodes (name, level, parent_id, version_id, sort_order)
                  VALUES (btrim(txt),'mohalla',v_basti_id,v_version_id,idx);
                END IF;
                idx := idx + 1;
              END LOOP;
            END LOOP;
          END LOOP;
        END LOOP;

        -- बस्ती directly under जिला
        FOR rb IN SELECT value, ordinality-1 AS ord
                    FROM jsonb_array_elements(COALESCE(rj.value->'बस्ती','[]'::jsonb))
                    WITH ORDINALITY AS t(value, ordinality)
        LOOP
          INSERT INTO karyakarini_nodes (name, level, parent_id, version_id, sort_order)
          VALUES (COALESCE(rb.value->>'नाम','बस्ती'),'basti',v_jila_id,v_version_id,rb.ord)
          RETURNING id INTO v_basti_id;

          idx := 0;
          FOR txt IN SELECT value
                       FROM jsonb_array_elements_text(COALESCE(rb.value->'मोहल्ला', rb.value->'वार्ड','[]'::jsonb))
          LOOP
            IF length(btrim(txt)) > 0 THEN
              INSERT INTO karyakarini_nodes (name, level, parent_id, version_id, sort_order)
              VALUES (btrim(txt),'mohalla',v_basti_id,v_version_id,idx);
            END IF;
            idx := idx + 1;
          END LOOP;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

COMMIT;

-- =====================================================================
-- Done. Verify with, for example:
--   SELECT count(*) FROM categories;
--   SELECT count(*) FROM subcategories;
--   SELECT name, code, level_order FROM levels ORDER BY level_order;
--   SELECT child_level, parent_level FROM level_constraints ORDER BY 1,2;
--   SELECT level, count(*) FROM karyakarini_nodes GROUP BY level ORDER BY 1;
--   \d user_other_information
-- =====================================================================
