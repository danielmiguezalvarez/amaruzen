import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendInvitacionAcceso } from "@/lib/email";

function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function buildBaseUrl(req: Request) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function crearInvitacionAcceso({
  req,
  createdById,
  userId,
  profesorId,
  email,
  nombre,
  role,
}: {
  req: Request;
  createdById: string;
  userId: string;
  profesorId?: string;
  email: string;
  nombre: string;
  role: "ALUMNO" | "PROFESIONAL";
}) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await prisma.invitacionAcceso.create({
    data: {
      email,
      role,
      tokenHash,
      expiresAt,
      userId,
      profesorId,
      createdById,
    },
  });

  const enlace = `${buildBaseUrl(req)}/activar-cuenta?token=${token}`;
  await sendInvitacionAcceso({
    to: email,
    nombre,
    enlace,
    rol: role === "PROFESIONAL" ? "PROFESIONAL" : "ALUMNO",
  });
}

export function hashInviteToken(token: string) {
  return hashToken(token);
}
