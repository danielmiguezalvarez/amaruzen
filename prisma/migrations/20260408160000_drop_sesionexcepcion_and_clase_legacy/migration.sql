-- Migration: Drop SesionExcepcion table, TipoExcepcion enum, and legacy Clase fields
-- These are no longer used: sessions are fully materialized in the Sesion table,
-- and scheduling data lives exclusively in the Horario model.

-- 1. Drop the SesionExcepcion table (including its indexes and FK constraints)
DROP TABLE IF EXISTS "SesionExcepcion" CASCADE;

-- 2. Drop the TipoExcepcion enum type
DROP TYPE IF EXISTS "TipoExcepcion";

-- 3. Remove legacy scheduling fields from Clase
-- These were always mirrors of the first Horario's values and are no longer read by any code.
ALTER TABLE "Clase" DROP COLUMN IF EXISTS "diaSemana";
ALTER TABLE "Clase" DROP COLUMN IF EXISTS "horaInicio";
ALTER TABLE "Clase" DROP COLUMN IF EXISTS "horaFin";
