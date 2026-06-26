CREATE TABLE "Festivo" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Festivo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Festivo_fecha_key" ON "Festivo"("fecha");
CREATE INDEX "Festivo_fecha_activo_idx" ON "Festivo"("fecha", "activo");
