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

async function captureProfessionalBooking(page, baseUrl) {
  await page.goto(`${baseUrl}/profesional/calendario`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Calendario" }).waitFor();
  await page.getByText("Vinyasa", { exact: false }).first().waitFor();
  await page.getByText("Sala Alba", { exact: true }).first().waitFor();

  const calendar = page.locator('div.hidden[class~="lg:block"]');
  const dayGrid = calendar.locator(":scope > div > div.grid").nth(1);
  const wednesday = dayGrid.locator(":scope > div").nth(3);
  const salaAlba = wednesday
    .locator(":scope > div.grid > div")
    .filter({ hasText: "Sala Alba" });
  assert.equal(await salaAlba.count(), 1, "No se encontró Sala Alba el miércoles.");

  const freeSlot = salaAlba.locator(":scope > div.relative").last();
  const slotBounds = await freeSlot.boundingBox();
  assert.ok(slotBounds, "No se pudo localizar el hueco libre de la sala.");
  await freeSlot.click({
    position: { x: slotBounds.width / 2, y: (14 - 8) * 48 + 24 },
  });

  const modal = page.locator(".fixed.inset-0");
  await modal.getByRole("heading", { name: "Solicitar reserva" }).waitFor();
  const form = modal.locator("form");
  assert.equal(await form.locator("select").inputValue(), "demo-sala-alba");
  assert.match(await form.locator('input[type="date"]').inputValue(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(await form.locator('input[type="time"]').nth(0).inputValue(), "14:00");
  assert.equal(await form.locator('input[type="time"]').nth(1).inputValue(), "15:00");
  await modal.getByText("Motivo (opcional)", { exact: true }).waitFor();
  await modal.getByRole("button", { name: "Enviar solicitud" }).waitFor();

  const body = await page.locator("body").innerText();
  assert.doesNotMatch(body, /Cargando\.\.\.|Cargando calendario|Internal Server Error|Application error/i);
  const output = join(screenshotsDir, "05-calendario-profesional.png");
  await page.screenshot({ path: output, fullPage: true, animations: "disabled" });
  assert.ok((await stat(output)).size > 5_000, "La captura del formulario no parece completa.");
}

export async function generateCaptures(baseUrl, { professionalOnly = false } = {}) {
  await mkdir(screenshotsDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const browserErrors = [];

  try {
    if (!professionalOnly) {
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
        requiredText: ["Sesiones de hoy", "Cambios pendientes", "Sofía Vega", "Vinyasa"],
      }, baseUrl);
      await capture(adminPage, "02-calendario-salas.png", {
        path: "/admin/sesiones",
        heading: "Calendario",
        requiredText: ["Sala Alba", "Sala Brisa", "Vinyasa", "Reserva"],
      }, baseUrl);
      await capture(adminPage, "03-reservas.png", {
        path: "/admin/reservas",
        heading: "Reservas",
        requiredText: ["Taller de respiración", "APROBADA", "PENDIENTE"],
      }, baseUrl);
      await capture(adminPage, "04-alumnos-cambios.png", {
        path: "/admin/cambios",
        heading: "Cambios de sesión",
        requiredText: ["Sofía Vega", "Pendiente", "Vinyasa"],
      }, baseUrl);
      await adminContext.close();
    }

    const professionalContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      timezoneId: "UTC",
      locale: "es-ES",
    });
    const professionalPage = await professionalContext.newPage();
    professionalPage.on("pageerror", (error) => browserErrors.push(error.message));
    await signIn(professionalPage, baseUrl, professionalEmail);
    await captureProfessionalBooking(professionalPage, baseUrl);
    await professionalContext.close();

    assert.deepEqual(browserErrors, [], `Errores de navegador: ${browserErrors.join("; ")}`);
  } finally {
    await browser.close();
  }
}
