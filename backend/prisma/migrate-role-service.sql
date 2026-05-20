-- Migration: Simplify RoleService enum to 4 active values
-- Maps old values: identification/service_salle_1/service_salle_2 → service_salle
--                  priere_lundi → service_en_ligne
-- Rows with unmappable values fall back to service_salle

BEGIN;

-- 1. Preserve existing data in a temporary TEXT column
ALTER TABLE "AffectationPlanning" ADD COLUMN "role_tmp" TEXT;
UPDATE "AffectationPlanning" SET "role_tmp" = "role_service"::TEXT;

-- 2. Drop the old enum-typed column (and its constraint/index)
ALTER TABLE "AffectationPlanning" DROP COLUMN "role_service";

-- 3. Drop and recreate the enum with only the 4 active values
DROP TYPE "RoleService";
CREATE TYPE "RoleService" AS ENUM (
  'identification_nm',
  'service_salle',
  'preparation_salle',
  'service_en_ligne'
);

-- 4. Re-add the column with the new enum type
ALTER TABLE "AffectationPlanning" ADD COLUMN "role_service" "RoleService";

-- 5. Map old values → new values
UPDATE "AffectationPlanning" SET "role_service" = CASE
  WHEN "role_tmp" = 'identification_nm'  THEN 'identification_nm'::"RoleService"
  WHEN "role_tmp" = 'preparation_salle'  THEN 'preparation_salle'::"RoleService"
  WHEN "role_tmp" = 'service_en_ligne'   THEN 'service_en_ligne'::"RoleService"
  WHEN "role_tmp" = 'priere_lundi'       THEN 'service_en_ligne'::"RoleService"
  ELSE 'service_salle'::"RoleService"  -- covers service_salle, service_salle_1, service_salle_2, identification
END;

-- 6. Restore NOT NULL constraint
ALTER TABLE "AffectationPlanning" ALTER COLUMN "role_service" SET NOT NULL;

-- 7. Restore unique constraint
ALTER TABLE "AffectationPlanning"
  ADD CONSTRAINT "AffectationPlanning_planning_id_ouvrier_id_role_service_key"
  UNIQUE ("planning_id", "ouvrier_id", "role_service");

-- 8. Restore indexes
CREATE INDEX IF NOT EXISTS "AffectationPlanning_planning_id_idx" ON "AffectationPlanning" ("planning_id");
CREATE INDEX IF NOT EXISTS "AffectationPlanning_ouvrier_id_idx"  ON "AffectationPlanning" ("ouvrier_id");
CREATE INDEX IF NOT EXISTS "AffectationPlanning_statut_idx"       ON "AffectationPlanning" ("statut");

-- 9. Drop temporary column
ALTER TABLE "AffectationPlanning" DROP COLUMN "role_tmp";

COMMIT;
