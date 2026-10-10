// Visual smoke test: renders the main screens on desktop and mobile and reports console errors.
// Usage: node scripts/screenshots.mjs [baseUrl]   (requires `npx playwright install chromium`)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3000";
const OUT = "shots";
mkdirSync(OUT, { recursive: true });
const errors = [];

async function run(name, viewport, fn, isMobile = false) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile, hasTouch: isMobile, locale: "pt-BR" });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`[${name}] ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`[${name}] pageerror: ${e.message}`));
  page.on("response", (r) => r.status() >= 400 && errors.push(`[${name}] HTTP ${r.status()} ${r.url().slice(0, 120)}`));
  try {
    await fn(page);
  } catch (e) {
    errors.push(`[${name}] script: ${e.message}`);
    await page.screenshot({ path: `${OUT}/${name}-failure.png` });
  }
  await browser.close();
}

const shot = (page, n, full = false) => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: full });
const settle = (page, ms = 2500) => page.waitForTimeout(ms);

await run("desktop", { width: 1440, height: 900 }, async (page) => {
  await page.goto(BASE + "/");
  await settle(page, 1200);
  await shot(page, "01-landing");
  await shot(page, "01b-landing-full", true);

  await page.goto(BASE + "/trips");
  await settle(page, 1500);
  await shot(page, "02-trips");

  await page.goto(BASE + "/map");
  await page.waitForURL(/\/plan$/, { timeout: 15000 });
  await page.waitForSelector(".leaflet-container", { timeout: 15000 });
  await settle(page, 9000); // routes come from OSRM
  await shot(page, "03-planner-day1");

  await page.getByRole("button", { name: /Organizar melhor roteiro/ }).click();
  await settle(page, 6000);
  await shot(page, "04-optimize-banner");
  const ver = page.getByRole("button", { name: "Ver sugestão" });
  if (await ver.count()) {
    await ver.click();
    await settle(page, 1500);
    await shot(page, "05-optimize-dialog");
    await page.getByRole("button", { name: "Manter meu roteiro" }).click();
  }

  await page.getByRole("tab", { name: /Agenda do dia/ }).click();
  await settle(page, 1500);
  await shot(page, "06-agenda");

  await page.getByRole("tab", { name: /Descobrir/ }).click();
  await page.getByRole("button", { name: /Museus/ }).click();
  await settle(page, 9000);
  await shot(page, "07-discover-museums");

  await page.getByRole("tab", { name: /Roteiro/ }).click();
  await page.getByRole("button", { name: /Melhor caminho/ }).click();
  await page.getByRole("button", { name: /Mais econômico/ }).click();
  await settle(page, 9000);
  await shot(page, "08-best-path");
  await page.keyboard.press("Escape");

  // Leg details
  await page.locator("button[data-leg-toggle]").first().click();
  await settle(page, 5000);
  await shot(page, "09-leg-details");

  await page.getByRole("button", { name: /Todos/ }).first().click();
  await settle(page, 4000);
  await shot(page, "10-all-days");

  const url = page.url().replace(/\/plan$/, "");
  await page.goto(url);
  await settle(page, 8000);
  await shot(page, "11-dashboard", true);

  await page.goto(url + "/budget");
  await settle(page, 1500);
  await shot(page, "12-budget", true);

  await page.goto(BASE + "/explore");
  await settle(page, 1500);
  await shot(page, "13-explore");
  await page.getByText("Paris romântica").click();
  await settle(page, 3000);
  await shot(page, "14-explore-dialog");

  await page.goto(BASE + "/trips/new");
  await page.getByLabel("Destino").fill("Lisboa");
  await settle(page, 3500);
  await shot(page, "15-new-trip");

  await page.goto(BASE + "/settings");
  await settle(page, 1500);
  await shot(page, "16-settings");
});

await run(
  "mobile",
  { width: 390, height: 844 },
  async (page) => {
    await page.goto(BASE + "/");
    await settle(page, 1200);
    await shot(page, "20-m-landing");
    await page.goto(BASE + "/map");
    await page.waitForURL(/\/plan$/, { timeout: 15000 });
    await settle(page, 9000);
    await shot(page, "21-m-planner");
    await page.getByRole("tab", { name: "Dia" }).click();
    await settle(page, 1500);
    await shot(page, "22-m-day");
    await page.getByRole("tab", { name: "Mapa" }).click();
    await settle(page, 2000);
    await shot(page, "23-m-map");
    const url = page.url().replace(/\/plan$/, "");
    await page.goto(url);
    await settle(page, 6000);
    await shot(page, "24-m-dashboard");
  },
  true,
);

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "NO CONSOLE ERRORS");
