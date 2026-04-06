import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { generarSesiones } from "@/lib/sesiones";

export async function POST() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const creadas = await generarSesiones(2);
  return NextResponse.json({ creadas });
}
