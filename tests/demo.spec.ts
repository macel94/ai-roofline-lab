import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __observedAnimationFrames: number;
  }
}

async function setRangeValue(page: Page, selector: string, value: number): Promise<void> {
  await page.locator(selector).evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function installAnimationProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__observedAnimationFrames = 0;
    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback: FrameRequestCallback): number =>
      nativeRequestAnimationFrame((timestamp) => {
        window.__observedAnimationFrames += 1;
        callback(timestamp);
      });
  });
}

test.describe("demo statica senza autenticazione", () => {
  test("carica il titolo, gli otto profili e il grafico senza richieste esterne", async ({ page }) => {
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      const origin = new URL(request.url()).origin;
      if (origin !== "http://127.0.0.1:4173") externalRequests.push(request.url());
    });

    await page.goto("/");

    await expect(page).toHaveTitle(/AI Silicon \/ Roofline Lab/);
    await expect(page.locator("html")).toHaveAttribute("lang", "it");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Segui i dati.");
    await expect(page.locator(".profile-card")).toHaveCount(8);
    await expect(page.locator("#roofline-chart svg[role='img']")).toBeVisible();
    await expect(page.locator(".roofline-line")).toHaveCount(8);
    await expect(page.locator(".legend-item")).toHaveCount(8);
    expect(externalRequests).toEqual([]);
  });

  test("seleziona un profilo e aggiorna flusso, fonte e marker attivo", async ({ page }) => {
    await page.goto("/");
    const m4Card = page.getByRole("button", { name: /APPLE SILICON, M4 Max/ });

    await m4Card.click();

    await expect(m4Card).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#flow-vendor")).toHaveText("APPLE SILICON");
    await expect(page.locator("#flow-memory")).toHaveText("Memoria unificata");
    await expect(page.locator("#active-source")).toHaveAttribute("href", /apple\.com\/newsroom\/2024/);
    await expect(page.locator("#bottleneck-value")).toHaveText("memory-bound");
    await expect(page.locator(".roofline-line.is-active")).toHaveCount(1);
  });

  test("il decode e il prefill aggiornano l’intensità con batch e token", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#intensity-value")).toHaveText("4");

    await page.getByRole("radio", { name: /Prefill/ }).check();
    await expect(page.locator("#intensity-value")).toHaveText("2.048");
    await expect(page.locator("#chart-summary")).toContainText("2.048 FLOP/byte");
    await expect(page.locator("#context-size")).toBeEnabled();

    await setRangeValue(page, "#batch-size", 8);
    await expect(page.locator("#intensity-value")).toHaveText("16.384");

    await page.getByRole("radio", { name: /Decode/ }).check();
    await expect(page.locator("#intensity-value")).toHaveText("32");
    await expect(page.locator("#context-size")).toBeDisabled();
  });

  test("il fit segnala non entra, entra e unknown senza inventare capacità", async ({ page }) => {
    await page.goto("/");
    await setRangeValue(page, "#model-size", 70);
    await page.getByRole("button", { name: /GOOGLE · TPU, TPU v6e/ }).click();
    await expect(page.locator("#working-set-value")).toHaveText("42 GB");
    await expect(page.locator("#fit-value")).toContainText("non entra");

    await page.getByRole("button", { name: /GROQ · LPU, Language Processing Unit/ }).click();
    await expect(page.locator("#fit-value")).toHaveText("Fit: da verificare");

    await page.getByRole("button", { name: /AMD · X86, Zen 5/ }).click();
    await setRangeValue(page, "#host-ram", 64);
    await expect(page.locator("#fit-value")).toContainText("entra");
  });

  test("mostra i claim vendor senza confonderli con i dati per chip", async ({ page }) => {
    await page.goto("/");
    const groqCard = page.getByRole("button", { name: /GROQ · LPU/ });
    await expect(groqCard).toContainText("≥80 TB/s");
    await groqCard.click();
    await expect(page.locator("#active-source")).toHaveAttribute("href", "https://groq.com/lpu/");
    await expect(page.locator("#flow-compute")).toHaveText("TSP · dataflow");
    await expect(page.locator("#flow-note")).toContainText("non equivale");
  });

  test("i controlli sono utilizzabili da tastiera e la pagina non trabocca su mobile", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
    const modelSlider = page.getByRole("slider", { name: /Parametri del modello/ });
    await expect(modelSlider).toBeVisible();
    await modelSlider.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#model-size-value")).toHaveText("8 B");

    const width = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(width.page).toBeLessThanOrEqual(width.viewport + 1);
  });

  test("l’animazione avanza e si ferma con il controllo pausa", async ({ page }) => {
    await installAnimationProbe(page);
    await page.goto("/");
    await page.locator("#flow-board").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const runningFrames = await page.evaluate(() => window.__observedAnimationFrames);
    expect(runningFrames).toBeGreaterThan(5);

    const pauseButton = page.locator("#motion-toggle");
    await expect(pauseButton).toHaveAttribute("aria-pressed", "true");
    await pauseButton.click();
    await expect(pauseButton).toHaveAttribute("aria-pressed", "false");
    await page.waitForTimeout(160);
    const pausedFrames = await page.evaluate(() => window.__observedAnimationFrames);
    await page.waitForTimeout(160);
    const stillPausedFrames = await page.evaluate(() => window.__observedAnimationFrames);
    expect(stillPausedFrames).toBe(pausedFrames);

    await page.getByRole("button", { name: "Riprendi animazione" }).click();
    await page.waitForTimeout(160);
    const resumedFrames = await page.evaluate(() => window.__observedAnimationFrames);
    expect(resumedFrames).toBeGreaterThan(stillPausedFrames);

    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(160);
    const offscreenFrames = await page.evaluate(() => window.__observedAnimationFrames);
    await page.waitForTimeout(160);
    expect(await page.evaluate(() => window.__observedAnimationFrames)).toBe(offscreenFrames);
  });

  test("rispetta prefers-reduced-motion senza disabilitare controlli o calcoli", async ({ page }) => {
    await installAnimationProbe(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.locator("#flow-board").scrollIntoViewIfNeeded();

    const motionButton = page.getByRole("button", { name: "Movimento ridotto attivo" });
    await expect(motionButton).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#intensity-value")).toHaveText("4");
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__observedAnimationFrames)).toBe(0);

    await page.getByRole("radio", { name: /Prefill/ }).check();
    await expect(page.locator("#intensity-value")).toHaveText("2.048");
    await expect(page.locator("#chart-summary")).toContainText("2.048 FLOP/byte");
  });
});
