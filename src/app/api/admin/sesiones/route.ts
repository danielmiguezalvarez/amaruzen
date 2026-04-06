import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { generarSesionesPorRango, getLunes } from "@/lib/sesiones";

// POST /api/admin/sesiones — genera sesiones para los próximos 2 meses
export async function POST() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const desde = getLunes(new Date());
  const hasta = new Date(desde);
  hasta.setDate(hasta.getDate() + 60);

  const creadas = await generarSesionesPorRango(desde, hasta);
  return NextResponse.json({ creadas });
}
