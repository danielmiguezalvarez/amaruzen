-- CreateTable
CREATE TABLE "SolicitudAlta" (
  "id"        TEXT NOT NULL,
  "nombre"    TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "telefono"  TEXT,
  "tipo"      TEXT NOT NULL,
  "mensaje"   TEXT,
  "leida"     BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SolicitudAlta_pkey" PRIMARY KEY ("id")
);
