import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const databaseUrl = new URL(process.env.DATABASE_URL || "");
const directUrl = new URL(process.env.DIRECT_URL || "");
const isDockerDemo =
  databaseUrl.hostname === "127.0.0.1" &&
  databaseUrl.port === "55439" &&
  databaseUrl.pathname === "/amaruzen_demo" &&
  databaseUrl.username === "demo";
const isTemporaryLocalDemo =
  ["localhost", "127.0.0.1", "[::1]"].includes(databaseUrl.hostname) &&
  /^\/amaruzen_demo_[a-f0-9]{12}$/.test(databaseUrl.pathname);

if (
  databaseUrl.protocol !== "postgresql:" ||
  (!isDockerDemo && !isTemporaryLocalDemo) ||
  directUrl.href !== databaseUrl.href ||
  process.env.RESEND_API_KEY
) {
  throw new Error("Seed cancelado: solo se permite la base local desechable de la demo.");
}

const prisma = new PrismaClient();
const password = await bcrypt.hash("Amaruzen-demo-solo-local-2026", 12);
const hoy = new Date();
const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
lunes.setDate(lunes.getDate() + (lunes.getDay() === 0 ? -6 : 1 - lunes.getDay()));
const fechaDia = (offset) => {
  const fecha = new Date(lunes);
  fecha.setDate(fecha.getDate() + offset);
  return fecha;
};

const dias = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];
const adminId = "demo-admin";
const profesores = [
  { id: "demo-prof-ana", userId: "demo-user-ana", nombre: "Ana Soler", email: "ana.soler@demo.amaruzen.invalid" },
  { id: "demo-prof-leo", userId: "demo-user-leo", nombre: "Leo Martín", email: "leo.martin@demo.amaruzen.invalid" },
  { id: "demo-prof-noa", userId: "demo-user-noa", nombre: "Noa Vidal", email: "noa.vidal@demo.amaruzen.invalid" },
];
const nombresAlumnos = [
  "Sofía Vega", "Mateo Ríos", "Clara Montes", "Hugo Serra", "Irene Sol", "Gael Prieto",
  "Nora Campos", "Leo Fuentes", "Alba Mar", "Dani Cruz", "Vera Luna", "Eric Vidal",
  "Mara Gil", "Bruno Rey", "Lola Sáez", "Pablo Roca", "Inés Mora", "Teo Vidal",
  "Elsa León", "Alex Soler", "Aina Costa", "Rafa Cano", "Mía Pardo", "Nil Ríos",
  "Cora Blas", "Izan Ruiz", "Lía Marín",
];
const alumnos = Array.from({ length: nombresAlumnos.length }, (_, index) => ({
  id: `demo-student-${String(index + 1).padStart(2, "0")}`,
  name: nombresAlumnos[index],
}));
const clases = [
  { id: "demo-class-lunes-am", nombre: "Vinyasa de la mañana", dia: 0, horaInicio: "09:00", horaFin: "10:00", salaId: "demo-sala-alba", profesorId: profesores[0].id, aforo: 14, color: "#0f766e" },
  { id: "demo-class-lunes-pm", nombre: "Movilidad y equilibrio", dia: 0, horaInicio: "18:00", horaFin: "19:00", salaId: "demo-sala-brisa", profesorId: profesores[1].id, aforo: 12, color: "#7c3aed" },
  { id: "demo-class-martes-am", nombre: "Hatha esencial", dia: 1, horaInicio: "09:30", horaFin: "10:30", salaId: "demo-sala-brisa", profesorId: profesores[2].id, aforo: 12, color: "#2563eb" },
  { id: "demo-class-martes-pm", nombre: "Yoga restaurativo", dia: 1, horaInicio: "17:30", horaFin: "18:30", salaId: "demo-sala-alba", profesorId: profesores[0].id, aforo: 14, color: "#be185d" },
  { id: "demo-class-miercoles", nombre: "Fuerza consciente", dia: 2, horaInicio: "10:00", horaFin: "11:00", salaId: "demo-sala-alba", profesorId: profesores[1].id, aforo: 14, color: "#ea580c" },
  { id: "demo-class-jueves", nombre: "Vinyasa intermedio", dia: 3, horaInicio: "18:00", horaFin: "19:00", salaId: "demo-sala-brisa", profesorId: profesores[2].id, aforo: 12, color: "#0891b2" },
  { id: "demo-class-viernes", nombre: "Pausa y respiración", dia: 4, horaInicio: "09:00", horaFin: "10:00", salaId: "demo-sala-alba", profesorId: profesores[0].id, aforo: 14, color: "#65a30d" },
  { id: "demo-class-sabado", nombre: "Yoga en familia", dia: 5, horaInicio: "10:30", horaFin: "11:30", salaId: "demo-sala-brisa", profesorId: profesores[1].id, aforo: 12, color: "#c2410c" },
  { id: "demo-class-domingo", nombre: "Estiramientos suaves", dia: 6, horaInicio: "11:00", horaFin: "12:00", salaId: "demo-sala-alba", profesorId: profesores[2].id, aforo: 14, color: "#4f46e5" },
];
const horarios = clases.map((clase) => ({ ...clase, id: `demo-horario-${clase.id.slice("demo-class-".length)}` }));

try {
  const tables = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  for (const { tablename } of tables) {
    const table = tablename.replace(/"/g, '""');
    const [{ count }] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM "public"."${table}"`
    );
    if (count > 0) {
      throw new Error("Seed cancelado: la base demo no está vacía; no se modificó ningún dato.");
    }
  }

  await prisma.user.create({
    data: {
      id: adminId,
      name: "Gestión Amaruzen Demo",
      email: "admin@demo.amaruzen.invalid",
      password,
      role: "ADMIN",
    },
  });

  for (const profesor of profesores) {
    await prisma.user.create({
      data: {
        id: profesor.userId,
        name: profesor.nombre,
        email: profesor.email,
        password,
        role: "PROFESIONAL",
      },
    });
    await prisma.profesor.create({
      data: {
        id: profesor.id,
        nombre: profesor.nombre,
        email: profesor.email,
        userId: profesor.userId,
      },
    });
  }

  await prisma.user.createMany({
    data: alumnos.map((alumno) => ({
      ...alumno,
      email: `${alumno.id}@demo.amaruzen.invalid`,
      password: null,
      role: "ALUMNO",
    })),
  });

  await prisma.sala.createMany({
    data: [
      { id: "demo-sala-alba", nombre: "Sala Alba", descripcion: "Sala principal de práctica", aforo: 14, color: "#0f766e" },
      { id: "demo-sala-brisa", nombre: "Sala Brisa", descripcion: "Sala de práctica tranquila", aforo: 12, color: "#7c3aed" },
    ],
  });
  await prisma.tipoClase.createMany({
    data: [
      { id: "demo-tipo-vinyasa", nombre: "Vinyasa" },
      { id: "demo-tipo-bienestar", nombre: "Bienestar" },
    ],
  });

  for (const [index, clase] of clases.entries()) {
    await prisma.clase.create({
      data: {
        id: clase.id,
        nombre: clase.nombre,
        tipoClaseId: index % 2 === 0 ? "demo-tipo-vinyasa" : "demo-tipo-bienestar",
        profesorId: clase.profesorId,
        salaId: clase.salaId,
        aforo: clase.aforo,
        color: clase.color,
      },
    });
  }

  for (const [index, horario] of horarios.entries()) {
    await prisma.horario.create({
      data: {
        id: horario.id,
        claseId: horario.id.replace("demo-horario-", "demo-class-"),
        profesorId: horario.profesorId,
        salaId: horario.salaId,
        diaSemana: dias[horario.dia],
        horaInicio: horario.horaInicio,
        horaFin: horario.horaFin,
        aforo: horario.aforo,
      },
    });
    await prisma.sesion.create({
      data: {
        id: `demo-session-${index}`,
        claseId: horario.id.replace("demo-horario-", "demo-class-"),
        horarioId: horario.id,
        profesorId: horario.profesorId,
        salaId: horario.salaId,
        fecha: fechaDia(horario.dia),
        horaInicio: horario.horaInicio,
        horaFin: horario.horaFin,
        aforo: horario.aforo,
      },
    });
  }

  for (const [index, alumno] of alumnos.entries()) {
    const horario = horarios[index % horarios.length];
    const inscripcionId = `demo-inscripcion-${String(index + 1).padStart(2, "0")}`;
    await prisma.inscripcion.create({
      data: {
        id: inscripcionId,
        userId: alumno.id,
        claseId: horario.id.replace("demo-horario-", "demo-class-"),
        modalidad: "SEMANAL",
        horarios: { create: { horarioId: horario.id } },
      },
    });
  }

  const cambios = [
    { alumnoId: alumnos[0].id, origenSesion: 0, destinoSesion: 4 },
    { alumnoId: alumnos[3].id, origenSesion: 2, destinoSesion: 5 },
    { alumnoId: alumnos[7].id, origenSesion: 6, destinoSesion: 7 },
  ];
  await prisma.cambio.createMany({
    data: cambios.map((cambio, index) => ({
      id: `demo-cambio-${index + 1}`,
      userId: cambio.alumnoId,
      sesionOrigenId: `demo-session-${cambio.origenSesion}`,
      sesionDestinoId: `demo-session-${cambio.destinoSesion}`,
      nota: index === 0 ? "Necesito cambiar el horario esta semana." : null,
      estado: "PENDIENTE",
    })),
  });

  const fechasReserva = [2, 3, 5];
  const reservas = [
    { id: "demo-reserva-pendiente", salaId: "demo-sala-alba", profesionalId: profesores[1].userId, estado: "PENDIENTE", motivo: "Taller de respiración", fecha: fechaDia(fechasReserva[0]), horaInicio: "12:00", horaFin: "13:00" },
    { id: "demo-reserva-aprobada", salaId: "demo-sala-brisa", profesionalId: profesores[2].userId, estado: "APROBADA", motivo: "Sesión individual", fecha: fechaDia(fechasReserva[1]), horaInicio: "15:00", horaFin: "16:00" },
    { id: "demo-reserva-rechazada", salaId: "demo-sala-alba", profesionalId: profesores[1].userId, estado: "RECHAZADA", motivo: "Encuentro de bienestar", fecha: fechaDia(fechasReserva[2]), horaInicio: "13:00", horaFin: "14:00" },
  ];
  await prisma.reserva.createMany({ data: reservas });

  console.log(`Seed local listo: 1 administrador, 3 profesionales, ${alumnos.length} alumnos, 9 clases, 3 cambios y 3 reservas ficticias.`);
} finally {
  await prisma.$disconnect();
}
