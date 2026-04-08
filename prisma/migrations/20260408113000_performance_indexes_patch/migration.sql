-- Patch de rendimiento: indices para consultas de calendario y ficha.
-- Ejecutar en Supabase SQL Editor.

CREATE INDEX IF NOT EXISTS "Horario_activo_fecha_idx" ON "Horario"("activo", "fecha");
CREATE INDEX IF NOT EXISTS "Horario_activo_diaSemana_idx" ON "Horario"("activo", "diaSemana");

CREATE INDEX IF NOT EXISTS "Sesion_fecha_idx" ON "Sesion"("fecha");
CREATE INDEX IF NOT EXISTS "SesionExcepcion_fecha_idx" ON "SesionExcepcion"("fecha");

CREATE INDEX IF NOT EXISTS "InscripcionHorario_horarioId_activa_idx" ON "InscripcionHorario"("horarioId", "activa");

CREATE INDEX IF NOT EXISTS "Cambio_estado_idx" ON "Cambio"("estado");
CREATE INDEX IF NOT EXISTS "Cambio_sesionOrigenId_idx" ON "Cambio"("sesionOrigenId");
CREATE INDEX IF NOT EXISTS "Cambio_sesionDestinoId_idx" ON "Cambio"("sesionDestinoId");
CREATE INDEX IF NOT EXISTS "Cambio_estado_sesionOrigenId_idx" ON "Cambio"("estado", "sesionOrigenId");
CREATE INDEX IF NOT EXISTS "Cambio_estado_sesionDestinoId_idx" ON "Cambio"("estado", "sesionDestinoId");

CREATE INDEX IF NOT EXISTS "Reserva_estado_fecha_idx" ON "Reserva"("estado", "fecha");
CREATE INDEX IF NOT EXISTS "Reserva_salaId_fecha_idx" ON "Reserva"("salaId", "fecha");
