import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
import { readdir, access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateCaptures } from "./capture.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const composeFile = join(root, "scripts", "demo", "docker-compose.yml");
const prismaCli = join(root, "node_modules", "prisma", "build", "index.js");
const nextCli = join(root, "node_modules", "next", "dist", "bin", "next");
const projectName = `amaruzen-demo-${process.pid}`;
const dockerDatabaseUrl = "postgresql://demo:demo-only-local@127.0.0.1:55439/amaruzen_demo?schema=public";
const inheritedSensitiveVariables = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
];
const envKeys = [
  "PATH",
  "PATHEXT",
  "SystemRoot",
  "WINDIR",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "HOME",
  "APPDATA",
  "LOCALAPPDATA",
  "ComSpec",
];

function assertIsolatedEnvironment() {
  const inherited = inheritedSensitiveVariables.filter((key) => process.env[key]);
  if (inherited.length) {
    throw new Error(`Ejecución cancelada: elimina estas variables heredadas antes de usar la demo: ${inherited.join(", ")}.`);
  }

  return readdir(root).then((files) => {
    const dotenvFiles = files.filter((file) => /^\.env(?:\..+)?$/.test(file) && file !== ".env.example");
    if (dotenvFiles.length) {
      throw new Error(`Ejecución cancelada: Next.js podría leer archivos de entorno existentes (${dotenvFiles.join(", ")}). No se reutiliza ninguna configuración .env.`);
    }
  });
}

function cleanEnvironment(port, databaseUrl) {
  const env = {};
  for (const key of envKeys) {
    if (process.env[key]) env[key] = process.env[key];
  }
  Object.assign(env, {
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    NEXTAUTH_SECRET: randomBytes(32).toString("hex"),
    NEXTAUTH_URL: `http://127.0.0.1:${port}`,
    NEXT_TELEMETRY_DISABLED: "1",
    NODE_ENV: "development",
    PORT: String(port),
    RESEND_API_KEY: "",
    TZ: "UTC",
  });
  return env;
}

function assertLocalAdminUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("AMARUZEN_DEMO_POSTGRES_URL debe ser una URL PostgreSQL local a la base postgres.");
  }
  if (
    url.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.pathname !== "/postgres"
  ) {
    throw new Error("Ejecución cancelada: PostgreSQL nativo solo se admite en localhost y en la base administrativa postgres.");
  }
  return url;
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: options.env,
      stdio: options.stdio || "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} terminó con ${signal || `código ${code}`}.`));
    });
    options.onSpawn?.(child);
  });
}

function docker(args, env, stdio = "inherit") {
  return run("docker", ["compose", "--file", composeFile, "--project-name", projectName, ...args], { env, stdio });
}

function getLocalDockerEnvironment(env) {
  const version = spawnSync("docker", ["compose", "version"], { cwd: root, env, stdio: "ignore", windowsHide: true });
  if (version.status !== 0) return null;

  const endpoint = spawnSync("docker", [
    "context", "inspect", "--format", "{{(index .Endpoints \"docker\").Host}}",
  ], { cwd: root, env, encoding: "utf8", windowsHide: true });
  const host = endpoint.status === 0 ? endpoint.stdout.trim() : "";
  if (!/^(npipe:\/\/|unix:\/\/|tcp:\/\/(localhost|127\.0\.0\.1|\[::1\]):)/.test(host)) {
    throw new Error("Ejecución cancelada: Docker debe usar un socket local; no se iniciará la demo en un contexto remoto.");
  }
  return env;
}

async function ensurePortAvailable(port) {
  await new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") reject(new Error(`El puerto ${port} ya está ocupado; la demo no se iniciará para evitar conectarse a otro servicio.`));
      else reject(error);
    });
    server.listen(port, "127.0.0.1", () => server.close(resolvePromise));
  });
}

async function waitForDatabase(env) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const result = spawnSync("docker", [
      "compose", "--file", composeFile, "--project-name", projectName,
      "exec", "-T", "db", "pg_isready", "-U", "demo", "-d", "amaruzen_demo",
    ], { cwd: root, env, stdio: "ignore", windowsHide: true });
    if (result.status === 0) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000));
  }
  throw new Error("PostgreSQL demo no estuvo listo en 90 segundos.");
}

async function waitForApp(url, server) {
  const deadline = Date.now() + 180_000;
  let lastError;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Next.js terminó antes de iniciar (código ${server.exitCode}).`);
    try {
      const response = await fetch(`${url}/login`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000));
  }
  throw new Error(`Next.js no respondió en 180 segundos.${lastError ? ` ${lastError.message}` : ""}`);
}

async function findFreePort() {
  return new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolvePromise(address.port));
    });
  });
}

async function createLocalDemoDatabase(adminUrl, databaseName) {
  const { PrismaClient } = await import("@prisma/client");
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl.href } } });
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await admin.$disconnect();
  }
}

async function dropLocalDemoDatabase(adminUrl, databaseName) {
  const { PrismaClient } = await import("@prisma/client");
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl.href } } });
  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}"`);
  } finally {
    await admin.$disconnect();
  }
}

async function main() {
  await assertIsolatedEnvironment();
  for (const file of [prismaCli, nextCli]) {
    await access(file);
  }

  const port = await findFreePort();
  const dockerEnv = getLocalDockerEnvironment(cleanEnvironment(3000, dockerDatabaseUrl));
  const dockerAvailable = dockerEnv !== null;
  const adminUrl = dockerAvailable || !process.env.AMARUZEN_DEMO_POSTGRES_URL
    ? null
    : assertLocalAdminUrl(process.env.AMARUZEN_DEMO_POSTGRES_URL);
  const localDatabaseName = adminUrl
    ? `amaruzen_demo_${randomBytes(6).toString("hex")}`
    : null;
  const initialDatabaseUrl = adminUrl ? adminUrl.href : dockerDatabaseUrl;
  const appEnv = cleanEnvironment(port, initialDatabaseUrl);
  let server;
  let composeStarted = false;
  let localDatabaseCreated = false;

  try {
    await run(process.execPath, [prismaCli, "generate"], { env: appEnv });

    if (dockerAvailable) {
      await ensurePortAvailable(55439);
      composeStarted = true;
      await docker(["up", "--detach"], dockerEnv);
      await waitForDatabase(dockerEnv);
    } else {
      if (!adminUrl) {
        throw new Error("Docker Compose no está disponible. Actívalo o define AMARUZEN_DEMO_POSTGRES_URL con acceso CREATEDB a localhost/postgres; no se admite una base remota.");
      }
      await createLocalDemoDatabase(adminUrl, localDatabaseName);
      localDatabaseCreated = true;
      const localDemoUrl = new URL(adminUrl);
      localDemoUrl.pathname = `/${localDatabaseName}`;
      localDemoUrl.searchParams.set("schema", "public");
      appEnv.DATABASE_URL = localDemoUrl.href;
      appEnv.DIRECT_URL = localDemoUrl.href;
    }

    await run(process.execPath, [prismaCli, "db", "push", "--skip-generate"], { env: appEnv });
    await run(process.execPath, [process.execPath, join(root, "scripts", "demo", "seed.mjs")], { env: appEnv });

    server = spawn(process.execPath, [nextCli, "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: root,
      env: appEnv,
      stdio: "inherit",
      windowsHide: true,
    });
    await waitForApp(`http://127.0.0.1:${port}`, server);
    await generateCaptures(`http://127.0.0.1:${port}`);
    console.log("Capturas generadas en docs/screenshots/ con la aplicación real y datos ficticios.");
  } finally {
    if (server && server.exitCode === null) {
      server.kill();
      await new Promise((resolvePromise) => {
        if (server.exitCode !== null) resolvePromise();
        else {
          const timeout = setTimeout(resolvePromise, 10_000);
          server.once("exit", () => {
            clearTimeout(timeout);
            resolvePromise();
          });
        }
      });
    }
    if (composeStarted) {
      await docker(["down", "--volumes", "--remove-orphans"], dockerEnv);
    }
    if (localDatabaseCreated) {
      await dropLocalDemoDatabase(adminUrl, localDatabaseName);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
