-- Add modalidad and bono balance fields on Inscripcion
CREATE TYPE "ModalidadInscripcion" AS ENUM ('SEMANAL', 'BONO');

ALTER TABLE "Inscripcion"
  ADD COLUMN "modalidad" "ModalidadInscripcion" NOT NULL DEFAULT 'SEMANAL',
  ADD COLUMN "creditosIniciales" INTEGER,
  ADD COLUMN "creditosDisponibles" INTEGER;

-- Track per-session usage of bono
CREATE TABLE "UsoBonoSesion" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "inscripcionId" TEXT NOT NULL,
  "sesionId" TEXT NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "creadoPorId" TEXT,
  "canceladoPorId" TEXT,
  "canceladoAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UsoBonoSesion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UsoBonoSesion_userId_sesionId_key" ON "UsoBonoSesion"("userId", "sesionId");
CREATE INDEX "UsoBonoSesion_sesionId_activo_idx" ON "UsoBonoSesion"("sesionId", "activo");
CREATE INDEX "UsoBonoSesion_inscripcionId_activo_idx" ON "UsoBonoSesion"("inscripcionId", "activo");

ALTER TABLE "UsoBonoSesion"
  ADD CONSTRAINT "UsoBonoSesion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UsoBonoSesion_inscripcionId_fkey" FOREIGN KEY ("inscripcionId") REFERENCES "Inscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UsoBonoSesion_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "Sesion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UsoBonoSesion_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "UsoBonoSesion_canceladoPorId_fkey" FOREIGN KEY ("canceladoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
