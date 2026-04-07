import { Resend } from "resend";

const FROM = process.env.RESEND_FROM_EMAIL || "noreply@amaruzen.com";

export async function sendCambioAprobado({
  to, nombre, claseOrigen, claseDestino, fechaDestino,
}: {
  to: string;
  nombre: string;
  claseOrigen: string;
  claseDestino: string;
  fechaDestino: Date;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fecha = fechaDestino.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Tu cambio de clase ha sido aprobado — Amaruzen",
    html: `
      <p>Hola ${nombre},</p>
      <p>Tu solicitud de cambio de <strong>${claseOrigen}</strong> a <strong>${claseDestino}</strong> ha sido <strong>aprobada</strong>.</p>
      <p>La clase a la que asistirás es el <strong>${fecha}</strong>.</p>
      <p>Si tienes alguna duda, contacta con el centro.</p>
      <p>Equipo Amaruzen</p>
    `,
  });
}

export async function sendCambioCancelado({
  to, nombre, claseOrigen, claseDestino,
}: {
  to: string;
  nombre: string;
  claseOrigen: string;
  claseDestino: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Tu solicitud de cambio ha sido rechazada — Amaruzen",
    html: `
      <p>Hola ${nombre},</p>
      <p>Tu solicitud de cambio de <strong>${claseOrigen}</strong> a <strong>${claseDestino}</strong> ha sido <strong>rechazada</strong>.</p>
      <p>Si tienes alguna duda, contacta con el centro.</p>
      <p>Equipo Amaruzen</p>
    `,
  });
}

export async function sendClaseCancelada({
  to, nombre, claseNombre, fecha,
}: {
  to: string;
  nombre: string;
  claseNombre: string;
  fecha: Date;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fechaTxt = fecha.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Clase cancelada: ${claseNombre} — Amaruzen`,
    html: `
      <p>Hola ${nombre},</p>
      <p>Te informamos de que la clase <strong>${claseNombre}</strong> del <strong>${fechaTxt}</strong> ha sido cancelada.</p>
      <p>Si tienes alguna duda, contacta con el centro.</p>
      <p>Equipo Amaruzen</p>
    `,
  });
}

export async function sendReservaRespondida({
  to, nombre, estado, fecha, sala, horaInicio, horaFin, notas,
}: {
  to: string;
  nombre: string;
  estado: "APROBADA" | "RECHAZADA";
  fecha: Date;
  sala: string;
  horaInicio: string;
  horaFin: string;
  notas?: string | null;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fechaTxt = fecha.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const asunto = estado === "APROBADA"
    ? "Tu reserva de sala ha sido aprobada — Amaruzen"
    : "Tu reserva de sala ha sido rechazada — Amaruzen";

  await resend.emails.send({
    from: FROM,
    to,
    subject: asunto,
    html: `
      <p>Hola ${nombre},</p>
      <p>Tu solicitud de reserva para la sala <strong>${sala}</strong> el <strong>${fechaTxt}</strong> de <strong>${horaInicio}</strong> a <strong>${horaFin}</strong> ha sido <strong>${estado.toLowerCase()}</strong>.</p>
      ${notas ? `<p>Notas del centro: ${notas}</p>` : ""}
      <p>Equipo Amaruzen</p>
    `,
  });
}
