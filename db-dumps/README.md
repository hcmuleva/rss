# Database dumps & migrations (`rss`)

Both backend services — **auth-service** and **karyakarini-service** — share a single
PostgreSQL database named **`rss`**.

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rss
DB_USER=postgres
DB_PASSWORD=<see backend/<service>/.env>
```

This folder holds:

| File | Purpose |
| ---- | ------- |
| `migrations/2026-06-06_superadmin_master_data_and_census.sql` | Idempotent migration that adds the SuperAdmin master-data, Census and कार्यक्रम-count schema. Run this to bring **another** system up to date. |
| `rss_<timestamp>.sql` | Full `pg_dump` (schema + data) of the local `rss` database, taken when the migration was written. Use to clone/restore the whole DB. |
| `seed-data/malwa-tree.json` | Sample कार्यक्षेत्र node tree for the Malwa region (~150 nodes: प्रान्त → संभाग → विभाग → जिला → खंड → मंडल/नगर → ग्राम/बस्ती → मोहल्ला). Load it with the importer below. |

---

## 1. Apply the migration to another system (recommended)

Use this when the other system already has the app running and you only need the
**new** tables / columns. The script is **idempotent** — safe to run any number of
times; it only creates what is missing and only seeds default rows when a table is
still empty.

```bash
psql -h <host> -p <port> -U <user> -d rss \
     -v ON_ERROR_STOP=1 \
     -f migrations/2026-06-06_superadmin_master_data_and_census.sql
```

### What the migration adds

**auth-service (SuperAdmin master data)**

| Object | Notes |
| ------ | ----- |
| `categories` (आयाम) | + unique index on `lower(name)` where active; seeds 8 defaults |
| `subcategories` (टोली) | FK → `categories`; + unique index; seeds 42 defaults |
| `levels` (स्तर) | `code`, `level_order`, `is_dynamic`; seeds 11 defaults |
| `karyakshetras` | master list; + unique index |
| `level_constraints` | parent/child level rules; seeds 11 defaults |
| `audit_logs` | SuperAdmin action history; + 2 indexes |
| `users.role` | added defensively (`IF NOT EXISTS`), default `'user'` |

**karyakarini-service**

| Object | Notes |
| ------ | ----- |
| `user_other_information` | Census / "अन्य जानकारी" — `gender_type`, `religion` per user |
| `karyakarini_category_activities` | adds `male_count`, `female_count`, `children_count`, `from_date`, `to_date`, `status` (powers per-card counts & कुल जनसंख्या) |

> The base `karyakarini_*` tables are auto-created by karyakarini-service on boot,
> so only the **new columns** are altered here.

### SuperAdmin user

The SuperAdmin account is **not** created by SQL. On boot, auth-service runs
`User.seedSuperAdmin()` which creates/promotes the user from env vars:

```
SUPERADMIN_EMAIL=harish@emeelan.com
SUPERADMIN_PASSWORD=welcome
SUPERADMIN_FIRST_NAME=Harish
SUPERADMIN_FATHER_NAME=Muleva
SUPERADMIN_DOB=1990-01-01
SUPERADMIN_GOTRA=Muleva
```

Just start auth-service after running the migration and the SuperAdmin is ready.

### Verify

```sql
SELECT count(*) FROM categories;            -- 8
SELECT count(*) FROM subcategories;         -- 42
SELECT name, code, level_order FROM levels ORDER BY level_order;
SELECT child_level, parent_level FROM level_constraints ORDER BY 1,2;
\d user_other_information
```

---

## 2. Restore the full dump (clone the whole DB)

Use this to recreate the entire `rss` database from scratch on a fresh server.

```bash
# create an empty database first
createdb -h <host> -p <port> -U <user> rss

# load schema + data
psql -h <host> -p <port> -U <user> -d rss -f rss_<timestamp>.sql
```

The dump was generated with:

```bash
pg_dump -h localhost -p 5432 -U postgres -d rss \
        --no-owner --no-privileges -f rss_<timestamp>.sql
```

---

## 3. Load the sample कार्यक्षेत्र tree (`seed-data/malwa-tree.json`)

A ~150-node Malwa region tree with proper rural/urban distribution:
`khand → मंडल → ग्राम` (rural) and `khand → नगर → बस्ती → मोहल्ला` (urban).

The importer lives in karyakarini-service and reuses its `.env`:

```bash
cd backend/karyakarini-service

# default: creates a NEW version and imports the tree as a root प्रान्त
npm run import:tree

# preview only, writes nothing
node scripts/importTree.js --dry-run

# import into the live/current version
node scripts/importTree.js --version=current

# import into a specific version, optionally under an existing node
node scripts/importTree.js --version=3 --parent=42

# create a new version AND make it the current one shown in the app
node scripts/importTree.js --make-current
```

Re-running is **idempotent**: a node with the same (version, parent, level, name)
is reused, never duplicated. Pass a different JSON path as the first argument to
import another tree file.

---

## 4. Regenerating these files

```bash
# from backend/auth-service (so the .env DB vars are loaded)
set -a; . ./.env; set +a

# fresh full dump
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --no-owner --no-privileges \
        -f "../../db-dumps/rss_$(date +%Y%m%d_%H%M%S).sql"
```

When you add new tables/columns in the models, append the matching idempotent
`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
statements to a new dated file under `migrations/`.
