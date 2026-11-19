# Amaruzen

Aplicación de gestión para un centro de yoga: clases, alumnos, sesiones, cambios y reservas de salas.

## Desarrollo local

Requisitos: Node.js 20 o posterior, npm y PostgreSQL. Instala dependencias con `npm install`, configura las variables Prisma/NextAuth en un archivo de entorno local y ejecuta `npm run dev`. No compartas archivos `.env*`.

## Capturas reales con datos demo

El comando `npm run screenshots:demo` levanta una instancia PostgreSQL desechable con Docker Compose, sincroniza el esquema Prisma, crea datos sintéticos, inicia la aplicación real y captura las pantallas con Playwright a 1440 × 900. Las imágenes se guardan en `docs/screenshots/`:

- `01-panel-admin.png`: resumen de alumnos, clases, sesiones y cambios.
- `02-calendario-salas.png`: calendario semanal con clases, ocupación y reservas en dos salas.
- `03-reservas.png`: solicitudes de reserva en distintos estados.
- `04-alumnos-cambios.png`: coordinación de cambios solicitados por alumnos.
- `05-calendario-profesional.png`: calendario de una cuenta profesional.

### Requisitos y ejecución

1. Instala Node.js 20+, npm y Docker Desktop con Docker Compose activo. Como alternativa, se admite PostgreSQL ya instalado y accesible solo en localhost, con un usuario que pueda crear bases.
2. Ejecuta `npm install` y `npx playwright install chromium`.
3. Ejecuta `npm run screenshots:demo`.

El script no utiliza `.env`, `.env.local` ni `.env.development*`: si encuentra archivos de entorno en la raíz o variables heredadas de base de datos, NextAuth o Resend, aborta. Genera un secreto NextAuth efímero, inicia el servidor solo en loopback y deshabilita Resend. Con Docker, solo acepta un contexto Docker local, fija la conexión a `127.0.0.1:55439/amaruzen_demo`; la base vive en un `tmpfs` y el contenedor se elimina al terminar. Sin Docker, define `AMARUZEN_DEMO_POSTGRES_URL` en el proceso con una URL a `localhost/postgres` y un usuario local con permiso `CREATEDB`; el script crea una base aleatoria exclusiva para esa ejecución y la elimina al terminar. Nunca uses una URL remota ni la URL de la base de la aplicación.

La seed solo inserta datos si todas las tablas de la base desechable están vacías; aborta sin modificar datos si encuentra filas. Usa nombres y direcciones `.invalid` ficticios; no importes datos reales. Credenciales locales de automatización: `admin@demo.amaruzen.invalid` y `ana.soler@demo.amaruzen.invalid`, con contraseña `Amaruzen-demo-solo-local-2026`. Solo sirven dentro de la ejecución local de capturas; el servidor no se expone a la red.

Si una interrupción deja el contenedor levantado, detén únicamente el proyecto Compose `amaruzen-demo-<PID>` que corresponda a esa ejecución con `docker compose --file scripts/demo/docker-compose.yml --project-name amaruzen-demo-<PID> down --volumes --remove-orphans`. Las capturas son de pantallas reales de la aplicación con datos sintéticos y deben revisarse antes de publicarse.
