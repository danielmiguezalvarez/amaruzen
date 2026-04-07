DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Role' AND e.enumlabel = 'PROFESIONAL'
  ) THEN
    ALTER TYPE "Role" ADD VALUE 'PROFESIONAL';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoExcepcion') THEN
    CREATE TYPE "TipoExcepcion" AS ENUM ('CANCELADA', 'REUBICADA');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoReserva') THEN
    CREATE TYPE "EstadoReserva" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');
  END IF;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notificaciones" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Cambio" ADD COLUMN IF NOT EXISTS "forzado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Clase" ADD COLUMN IF NOT EXISTS "fechaInicio" TIMESTAMP(3);
ALTER TABLE "Clase" ADD COLUMN IF NOT EXISTS "color" TEXT;
ALTER TABLE "Sala" ADD COLUMN IF NOT EXISTS "color" TEXT;
ALTER TABLE "Inscripcion" ADD COLUMN IF NOT EXISTS "numClases" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "Reserva" (
    "id" TEXT NOT NULL,
    "salaId" TEXT NOT NULL,
    "profesionalId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "motivo" TEXT,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'PENDIENTE',
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

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

CREATE TABLE IF NOT EXISTS "SesionExcepcion" (
    "id" TEXT NOT NULL,
    "claseId" TEXT,
    "horarioId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoExcepcion" NOT NULL,
    "horaInicio" TEXT,
    "horaFin" TEXT,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SesionExcepcion_pkey" PRIMARY KEY ("id")
);

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
WHERE c."profesorId" IS NOT NULL
  AND c."salaId" IS NOT NULL
  AND c."horaInicio" IS NOT NULL
  AND c."horaFin" IS NOT NULL
  AND NOT EXISTS (
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

ALTER TABLE "Sesion"
  ALTER COLUMN "horarioId" SET NOT NULL;

ALTER TABLE "SesionExcepcion"
  ALTER COLUMN "horarioId" SET NOT NULL;

DROP INDEX IF EXISTS "Sesion_claseId_fecha_key";
DROP INDEX IF EXISTS "SesionExcepcion_claseId_fecha_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Sesion_horarioId_fecha_key" ON "Sesion"("horarioId", "fecha");
CREATE UNIQUE INDEX IF NOT EXISTS "SesionExcepcion_horarioId_fecha_key" ON "SesionExcepcion"("horarioId", "fecha");
CREATE UNIQUE INDEX IF NOT EXISTS "InscripcionHorario_inscripcionId_horarioId_key" ON "InscripcionHorario"("inscripcionId", "horarioId");
CREATE UNIQUE INDEX IF NOT EXISTS "Ausencia_userId_horarioId_fecha_key" ON "Ausencia"("userId", "horarioId", "fecha");

CREATE INDEX IF NOT EXISTS "Horario_claseId_idx" ON "Horario"("claseId");
CREATE INDEX IF NOT EXISTS "Horario_salaId_idx" ON "Horario"("salaId");
CREATE INDEX IF NOT EXISTS "Horario_profesorId_idx" ON "Horario"("profesorId");
CREATE INDEX IF NOT EXISTS "InscripcionHorario_horarioId_idx" ON "InscripcionHorario"("horarioId");
CREATE INDEX IF NOT EXISTS "Ausencia_horarioId_fecha_idx" ON "Ausencia"("horarioId", "fecha");

ALTER TABLE "Horario" ADD CONSTRAINT "Horario_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Horario" ADD CONSTRAINT "Horario_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "Profesor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Horario" ADD CONSTRAINT "Horario_salaId_fkey" FOREIGN KEY ("salaId") REFERENCES "Sala"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InscripcionHorario" ADD CONSTRAINT "InscripcionHorario_inscripcionId_fkey" FOREIGN KEY ("inscripcionId") REFERENCES "Inscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InscripcionHorario" ADD CONSTRAINT "InscripcionHorario_horarioId_fkey" FOREIGN KEY ("horarioId") REFERENCES "Horario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Ausencia" ADD CONSTRAINT "Ausencia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ausencia" ADD CONSTRAINT "Ausencia_horarioId_fkey" FOREIGN KEY ("horarioId") REFERENCES "Horario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ausencia" ADD CONSTRAINT "Ausencia_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_salaId_fkey" FOREIGN KEY ("salaId") REFERENCES "Sala"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_horarioId_fkey" FOREIGN KEY ("horarioId") REFERENCES "Horario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SesionExcepcion" ADD CONSTRAINT "SesionExcepcion_horarioId_fkey" FOREIGN KEY ("horarioId") REFERENCES "Horario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SesionExcepcion" DROP COLUMN IF EXISTS "claseId";
