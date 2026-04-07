-- Patch para entornos donde ya se aplico la version antigua de calendar_foundation.
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE "Clase" ADD COLUMN IF NOT EXISTS "color" TEXT;
ALTER TABLE "Sala" ADD COLUMN IF NOT EXISTS "color" TEXT;
ALTER TABLE "Inscripcion" ADD COLUMN IF NOT EXISTS "numClases" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "claseId" TEXT;

CREATE TABLE IF NOT EXISTS "Horario" (
  "id" TEXT NOT NULL,
  "claseId" TEXT NOT NULL,
  "profesorId" TEXT NOT NULL,
  "salaId" TEXT NOT NULL,
  "diaSemana" "DiaSemana",
  "fecha" TIMESTAMP(3),
  "horaInicio" TEXT NOT NULL,
  "horaFin" TEXT NOT NULL,
  "aforo" INTEGER NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Horario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InscripcionHorario" (
  "id" TEXT NOT NULL,
  "inscripcionId" TEXT NOT NULL,
  "horarioId" TEXT NOT NULL,
  "activa" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InscripcionHorario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Ausencia" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "horarioId" TEXT NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL,
  "motivo" TEXT,
  "creadoPorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Ausencia_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Sesion" ADD COLUMN IF NOT EXISTS "horarioId" TEXT;
ALTER TABLE "SesionExcepcion" ADD COLUMN IF NOT EXISTS "horarioId" TEXT;

INSERT INTO "Horario" (
  "id", "claseId", "profesorId", "salaId", "diaSemana", "fecha", "horaInicio", "horaFin", "aforo", "activo", "createdAt", "updatedAt"
)
SELECT
  'hor_' || REPLACE(c.id, '-', ''),
  c.id,
  c."profesorId",
  c."salaId",
  c."diaSemana",
  NULL,
  c."horaInicio",
  c."horaFin",
  c."aforo",
  c."activa",
  c."createdAt",
  c."updatedAt"
FROM "Clase" c
WHERE NOT EXISTS (
  SELECT 1 FROM "Horario" h WHERE h."claseId" = c.id AND h."fecha" IS NULL
);

UPDATE "Sesion" s
SET "horarioId" = h.id
FROM "Horario" h
WHERE s."claseId" = h."claseId"
  AND s."horarioId" IS NULL;

UPDATE "SesionExcepcion" se
SET "horarioId" = h.id
FROM "Horario" h
WHERE se."claseId" = h."claseId"
  AND se."horarioId" IS NULL;

INSERT INTO "InscripcionHorario" (
  "id", "inscripcionId", "horarioId", "activa", "createdAt", "updatedAt"
)
SELECT
  'inh_' || REPLACE(i.id, '-', '') || '_' || SUBSTRING(REPLACE(h.id, '-', '') FROM 1 FOR 8),
  i.id,
  h.id,
  i."activa",
  i."createdAt",
  i."updatedAt"
FROM "Inscripcion" i
JOIN "Horario" h ON h."claseId" = i."claseId"
WHERE NOT EXISTS (
  SELECT 1
  FROM "InscripcionHorario" ih
  WHERE ih."inscripcionId" = i.id AND ih."horarioId" = h.id
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Horario_claseId_fkey'
  ) THEN
    ALTER TABLE "Horario" ADD CONSTRAINT "Horario_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Horario_profesorId_fkey'
  ) THEN
    ALTER TABLE "Horario" ADD CONSTRAINT "Horario_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "Profesor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Horario_salaId_fkey'
  ) THEN
    ALTER TABLE "Horario" ADD CONSTRAINT "Horario_salaId_fkey" FOREIGN KEY ("salaId") REFERENCES "Sala"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InscripcionHorario_inscripcionId_fkey'
  ) THEN
    ALTER TABLE "InscripcionHorario" ADD CONSTRAINT "InscripcionHorario_inscripcionId_fkey" FOREIGN KEY ("inscripcionId") REFERENCES "Inscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InscripcionHorario_horarioId_fkey'
  ) THEN
    ALTER TABLE "InscripcionHorario" ADD CONSTRAINT "InscripcionHorario_horarioId_fkey" FOREIGN KEY ("horarioId") REFERENCES "Horario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Ausencia_userId_fkey'
  ) THEN
    ALTER TABLE "Ausencia" ADD CONSTRAINT "Ausencia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Ausencia_horarioId_fkey'
  ) THEN
    ALTER TABLE "Ausencia" ADD CONSTRAINT "Ausencia_horarioId_fkey" FOREIGN KEY ("horarioId") REFERENCES "Horario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Ausencia_creadoPorId_fkey'
  ) THEN
    ALTER TABLE "Ausencia" ADD CONSTRAINT "Ausencia_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Reserva_claseId_fkey'
  ) THEN
    ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Sesion_horarioId_fkey'
  ) THEN
    ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_horarioId_fkey" FOREIGN KEY ("horarioId") REFERENCES "Horario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SesionExcepcion_horarioId_fkey'
  ) THEN
    ALTER TABLE "SesionExcepcion" ADD CONSTRAINT "SesionExcepcion_horarioId_fkey" FOREIGN KEY ("horarioId") REFERENCES "Horario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Horario_claseId_idx" ON "Horario"("claseId");
CREATE INDEX IF NOT EXISTS "Horario_salaId_idx" ON "Horario"("salaId");
CREATE INDEX IF NOT EXISTS "Horario_profesorId_idx" ON "Horario"("profesorId");
CREATE INDEX IF NOT EXISTS "InscripcionHorario_horarioId_idx" ON "InscripcionHorario"("horarioId");
CREATE INDEX IF NOT EXISTS "Ausencia_horarioId_fecha_idx" ON "Ausencia"("horarioId", "fecha");

CREATE UNIQUE INDEX IF NOT EXISTS "Sesion_horarioId_fecha_key" ON "Sesion"("horarioId", "fecha");
CREATE UNIQUE INDEX IF NOT EXISTS "SesionExcepcion_horarioId_fecha_key" ON "SesionExcepcion"("horarioId", "fecha");
CREATE UNIQUE INDEX IF NOT EXISTS "InscripcionHorario_inscripcionId_horarioId_key" ON "InscripcionHorario"("inscripcionId", "horarioId");
CREATE UNIQUE INDEX IF NOT EXISTS "Ausencia_userId_horarioId_fecha_key" ON "Ausencia"("userId", "horarioId", "fecha");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Sesion" WHERE "horarioId" IS NULL) THEN
    RAISE EXCEPTION 'Hay sesiones sin horarioId tras la migracion';
  END IF;
  IF EXISTS (SELECT 1 FROM "SesionExcepcion" WHERE "horarioId" IS NULL) THEN
    RAISE EXCEPTION 'Hay excepciones sin horarioId tras la migracion';
  END IF;
END $$;

ALTER TABLE "Sesion" ALTER COLUMN "horarioId" SET NOT NULL;
ALTER TABLE "SesionExcepcion" ALTER COLUMN "horarioId" SET NOT NULL;

DROP INDEX IF EXISTS "Sesion_claseId_fecha_key";
DROP INDEX IF EXISTS "SesionExcepcion_claseId_fecha_key";

ALTER TABLE "SesionExcepcion" DROP COLUMN IF EXISTS "claseId";
