import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "El registro directo está deshabilitado. Usa la solicitud de alta." },
    { status: 410 }
  );
}
