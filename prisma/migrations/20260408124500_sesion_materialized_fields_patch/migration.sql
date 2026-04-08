-- FASE 0 (sesiones materializadas): agregar profesor/sala en Sesion y backfill.
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE "Sesion" ADD COLUMN IF NOT EXISTS "profesorId" TEXT;
ALTER TABLE "Sesion" ADD COLUMN IF NOT EXISTS "salaId" TEXT;

UPDATE "Sesion" s
SET
  "profesorId" = h."profesorId",
  "salaId" = h."salaId"
FROM "Horario" h
WHERE s."horarioId" = h."id"
  AND (s."profesorId" IS NULL OR s."salaId" IS NULL);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Sesion" WHERE "profesorId" IS NULL) THEN
    RAISE EXCEPTION 'Hay sesiones sin profesorId tras el backfill';
  END IF;
  IF EXISTS (SELECT 1 FROM "Sesion" WHERE "salaId" IS NULL) THEN
    RAISE EXCEPTION 'Hay sesiones sin salaId tras el backfill';
  END IF;
END $$;

ALTER TABLE "Sesion" ALTER COLUMN "profesorId" SET NOT NULL;
ALTER TABLE "Sesion" ALTER COLUMN "salaId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Sesion_profesorId_fkey'
  ) THEN
    ALTER TABLE "Sesion"
      ADD CONSTRAINT "Sesion_profesorId_fkey"
      FOREIGN KEY ("profesorId") REFERENCES "Profesor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Sesion_salaId_fkey'
  ) THEN
    ALTER TABLE "Sesion"
      ADD CONSTRAINT "Sesion_salaId_fkey"
      FOREIGN KEY ("salaId") REFERENCES "Sala"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Sesion_claseId_fecha_idx" ON "Sesion"("claseId", "fecha");
CREATE INDEX IF NOT EXISTS "Sesion_profesorId_fecha_idx" ON "Sesion"("profesorId", "fecha");
CREATE INDEX IF NOT EXISTS "Sesion_salaId_fecha_idx" ON "Sesion"("salaId", "fecha");
