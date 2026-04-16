-- Add access invitation model and optional User link for Profesor

-- 1) Add optional User link on Profesor
ALTER TABLE "Profesor" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- 2) Ensure one-to-one by userId when present
CREATE UNIQUE INDEX IF NOT EXISTS "Profesor_userId_key" ON "Profesor"("userId");

-- 3) FK Profesor.userId -> User.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Profesor_userId_fkey'
      AND table_name = 'Profesor'
  ) THEN
    ALTER TABLE "Profesor"
      ADD CONSTRAINT "Profesor_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4) Invitation table
CREATE TABLE IF NOT EXISTS "InvitacionAcceso" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "userId" TEXT,
  "profesorId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvitacionAcceso_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InvitacionAcceso_tokenHash_key" ON "InvitacionAcceso"("tokenHash");
CREATE INDEX IF NOT EXISTS "InvitacionAcceso_email_role_usedAt_idx" ON "InvitacionAcceso"("email", "role", "usedAt");
CREATE INDEX IF NOT EXISTS "InvitacionAcceso_expiresAt_idx" ON "InvitacionAcceso"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'InvitacionAcceso_userId_fkey'
      AND table_name = 'InvitacionAcceso'
  ) THEN
    ALTER TABLE "InvitacionAcceso"
      ADD CONSTRAINT "InvitacionAcceso_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'InvitacionAcceso_profesorId_fkey'
      AND table_name = 'InvitacionAcceso'
  ) THEN
    ALTER TABLE "InvitacionAcceso"
      ADD CONSTRAINT "InvitacionAcceso_profesorId_fkey"
      FOREIGN KEY ("profesorId") REFERENCES "Profesor"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'InvitacionAcceso_createdById_fkey'
      AND table_name = 'InvitacionAcceso'
  ) THEN
    ALTER TABLE "InvitacionAcceso"
      ADD CONSTRAINT "InvitacionAcceso_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
