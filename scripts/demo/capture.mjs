import assert from "node:assert/strict";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../../", import.meta.url));
const screenshotsDir = join(root, "docs", "screenshots");
const adminEmail = "admin@demo.amaruzen.invalid";
const professionalEmail = "ana.soler@demo.amaruzen.invalid";
const demoPassword = "Amaruzen-demo-solo-local-2026";

async function signIn(page, baseUrl, email) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(demoPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(admin|profesional\/calendario)(?:\/)?$/);
}

async function capture(page, name, title, baseUrl) {
  await page.goto(`${baseUrl}${title.path}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: title.heading }).waitFor();
  for (const text of title.requiredText) {
    await page.getByText(text, { exact: false }).first().waitFor();
  }
  const body = await page.locator("body").innerText();
  assert.doesNotMatch(body, /Cargando\.\.\.|Cargando calendario|Internal Server Error|Application error/i);
  const output = join(screenshotsDir, name);
  await page.screenshot({ path: output, fullPage: true, animations: "disabled" });
  assert.ok((await stat(output)).size > 5_000, `${name} no parece una captura completa.`);
}

export async function generateCaptures(baseUrl) {
  await mkdir(screenshotsDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const browserErrors = [];

  try {
    const adminContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      timezoneId: "UTC",
      locale: "es-ES",
    });
    const adminPage = await adminContext.newPage();
    adminPage.on("pageerror", (error) => browserErrors.push(error.message));

    await signIn(adminPage, baseUrl, adminEmail);
    await capture(adminPage, "01-panel-admin.png", {
      path: "/admin",
      heading: "Panel de gestión",
      requiredText: ["Sesiones de hoy", "Cambios pendientes", "Sofía Vega", "Vinyasa de la mañana"],
    }, baseUrl);
    await capture(adminPage, "02-calendario-salas.png", {
      path: "/admin/sesiones",
      heading: "Calendario",
      requiredText: ["Sala Alba", "Sala Brisa", "Vinyasa de la mañana", "Reserva"],
    }, baseUrl);
    await capture(adminPage, "03-reservas.png", {
      path: "/admin/reservas",
      heading: "Reservas",
      requiredText: ["Taller de respiración", "APROBADA", "PENDIENTE"],
    }, baseUrl);
    await capture(adminPage, "04-alumnos-cambios.png", {
      path: "/admin/cambios",
      heading: "Cambios de sesión",
      requiredText: ["Sofía Vega", "Pendiente", "Vinyasa de la mañana"],
    }, baseUrl);
    await adminContext.close();

    const professionalContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      timezoneId: "UTC",
      locale: "es-ES",
    });
    const professionalPage = await professionalContext.newPage();
    professionalPage.on("pageerror", (error) => browserErrors.push(error.message));
    await signIn(professionalPage, baseUrl, professionalEmail);
    await capture(professionalPage, "05-calendario-profesional.png", {
      path: "/profesional/calendario",
      heading: "Calendario",
      requiredText: ["Vinyasa de la mañana", "Sala Alba"],
    }, baseUrl);
    await professionalContext.close();

    assert.deepEqual(browserErrors, [], `Errores de navegador: ${browserErrors.join("; ")}`);
  } finally {
    await browser.close();
  }
}
