import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
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
