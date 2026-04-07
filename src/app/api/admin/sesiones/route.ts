import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { generarSesionesPorRango, getLunes } from "@/lib/sesiones";

// Endpoint legado: materializa sesiones futuras bajo demanda administrativa.
// En la nueva arquitectura no es necesario para el calendario, pero se mantiene
// temporalmente por compatibilidad con código existente.
export async function POST() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const desde = getLunes(new Date());
  const hasta = new Date(desde);
  hasta.setDate(hasta.getDate() + 60);

  const creadas = await generarSesionesPorRango(desde, hasta);
  return NextResponse.json({ creadas });
}
