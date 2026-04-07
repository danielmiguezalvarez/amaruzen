export type SalaLite = { id: string; nombre: string; aforo?: number };

export type EventoCalendario = {
  id: string;
  tipo: "CLASE" | "RESERVA";
  fecha: string;
  horaInicio: string;
  horaFin: string;
  salaId: string;
  salaNombre: string;
  titulo: string;
  subtitulo?: string;
  cancelada?: boolean;
  esInscrito?: boolean;
  raw: unknown;
};
