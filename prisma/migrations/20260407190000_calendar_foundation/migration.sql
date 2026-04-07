-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'PROFESIONAL';

-- CreateEnum
CREATE TYPE "TipoExcepcion" AS ENUM ('CANCELADA', 'REUBICADA');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- AlterTable
ALTER TABLE "Cambio" ADD COLUMN "forzado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Clase" ADD COLUMN "fechaInicio" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "notificaciones" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SesionExcepcion" (
    "id" TEXT NOT NULL,
    "claseId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoExcepcion" NOT NULL,
    "horaInicio" TEXT,
    "horaFin" TEXT,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SesionExcepcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reserva" (
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

-- CreateIndex
CREATE UNIQUE INDEX "SesionExcepcion_claseId_fecha_key" ON "SesionExcepcion"("claseId", "fecha");

-- AddForeignKey
ALTER TABLE "SesionExcepcion" ADD CONSTRAINT "SesionExcepcion_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_salaId_fkey" FOREIGN KEY ("salaId") REFERENCES "Sala"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
