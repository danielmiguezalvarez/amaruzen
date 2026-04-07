import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

type AuthResult = {
  error: NextResponse<{ error: string }>;
  session: never;
} | {
  error?: undefined;
  session: Session;
};

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }), session: undefined as never };
  }
  return { session };
}

export async function requireAdmin(): Promise<AuthResult> {
  const auth = await requireAuth();
  if (auth.error) return auth;

  const { session } = auth;
  if (session.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Sin permisos" }, { status: 403 }), session: undefined as never };
  }
  return { session };
}

export async function requireProfesional(): Promise<AuthResult> {
  const auth = await requireAuth();
  if (auth.error) return auth;

  const { session } = auth;
  if (session.user.role !== "PROFESIONAL") {
    return { error: NextResponse.json({ error: "Sin permisos" }, { status: 403 }), session: undefined as never };
  }
  return { session };
}
