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

async function loadSimulator(page: Page, width = 1280, height = 800): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto("/");
}

test.describe("English multi-chip Roofline simulator", () => {
  test("loads above the fold with all eight chips included and visible results", async ({ page }) => {
    const externalRequests: string[] = [];
    const pageErrors: string[] = [];
    page.on("request", (request) => {
      const origin = new URL(request.url()).origin;
      if (origin !== "http://127.0.0.1:4173") externalRequests.push(request.url());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await loadSimulator(page);

    await expect(page).toHaveTitle(/AI Silicon \/ Roofline Lab/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Where AI hits");
    await expect(page.locator(".profile-card")).toHaveCount(8);
    await expect(page.locator(".profile-card[aria-pressed='true']")).toHaveCount(8);
    await expect(page.locator("#selected-count")).toHaveText("8 of 8 included");
    await expect(page.locator("#roofline-chart svg[role='img']")).toBeVisible();
    await expect(page.locator(".roofline-line")).toHaveCount(8);
    await expect(page.locator(".legend-item")).toHaveCount(8);
    await expect(page.locator("#results-table-body tr")).toHaveCount(8);
    await expect(page.locator("#comparison-table")).toBeVisible();

    const firstViewport = await page.evaluate(() => ({
      chartTop: document.querySelector("#roofline-chart")?.getBoundingClientRect().top ?? Infinity,
      controlsTop: document.querySelector("#scenario-form")?.getBoundingClientRect().top ?? Infinity,
    }));
    expect(firstViewport.controlsTop).toBeLessThan(800);
    expect(firstViewport.chartTop).toBeLessThan(800);

    const visibleCopy = await page.locator("body").innerText();
    expect(visibleCopy).toContain("Where AI hits");
    expect(visibleCopy).toContain("Choose the paths to include");
    expect(externalRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("toggles profile inclusion independently and compares several chips together", async ({ page }) => {
    await loadSimulator(page);
    const m4 = page.locator('[data-profile-id="m4-max"]');
    const m5 = page.locator('[data-profile-id="m5-max"]');
    const intel = page.locator('[data-profile-id="lion-cove"]');

    await m4.click();
    await expect(m4).toHaveAttribute("aria-pressed", "false");
    await expect(m5).toHaveAttribute("aria-pressed", "true");
    await expect(intel).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".roofline-line")).toHaveCount(7);
    await expect(page.locator("#results-table-body tr")).toHaveCount(7);

    await intel.click();
    await expect(page.locator(".roofline-line")).toHaveCount(6);
    await expect(page.locator("#results-table-body tr")).toHaveCount(6);
    await expect(m5).toHaveAttribute("aria-pressed", "true");

    await m4.click();
    await expect(page.locator(".roofline-line")).toHaveCount(7);
    await expect(page.locator("#results-table-body tr")).toHaveCount(7);
    await intel.click();
    await expect(page.locator(".roofline-line")).toHaveCount(8);
    await expect(page.locator("#results-table-body tr")).toHaveCount(8);
  });

  test("Select all, Clear all, and reset restore the documented comparison set", async ({ page }) => {
    await loadSimulator(page);
    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page.locator(".profile-card[aria-pressed='true']")).toHaveCount(0);
    await expect(page.locator("#roofline-chart .roofline-line")).toHaveCount(0);
    await expect(page.locator("#comparison-empty")).toBeVisible();
    await expect(page.locator("#comparison-table")).toBeHidden();

    await page.getByRole("button", { name: "Select all eight" }).click();
    await expect(page.locator(".profile-card[aria-pressed='true']")).toHaveCount(8);
    await expect(page.locator("#results-table-body tr")).toHaveCount(8);

    await page.getByRole("button", { name: "Clear all" }).click();
    await setRangeValue(page, "#model-size", 70);
    await page.getByRole("button", { name: "Reset scenario" }).click();
    await expect(page.locator(".profile-card[aria-pressed='true']")).toHaveCount(8);
    await expect(page.locator("#model-size-value")).toHaveText("7 B");
    await expect(page.locator("#intensity-value")).toHaveText("4");
  });

  test("data-path focus highlights one chip without removing comparison results", async ({ page }) => {
    await loadSimulator(page);
    await page.locator("#flow-details summary").click();
    await page.locator("#flow-profile-select").selectOption("m4-max");

    await expect(page.locator("#flow-memory")).toHaveText("Unified memory");
    await expect(page.locator("#active-source")).toHaveAttribute("href", /apple\.com\/newsroom\/2024/);
    await expect(page.locator(".profile-card[aria-pressed='true']")).toHaveCount(8);
    await expect(page.locator(".roofline-line")).toHaveCount(8);
    await expect(page.locator("#results-table-body tr")).toHaveCount(8);
    await expect(page.locator(".roofline-line.is-focused")).toHaveCount(1);

    await page.locator("#flow-profile-select").selectOption("");
    await expect(page.locator(".roofline-line.is-focused")).toHaveCount(0);
    await expect(page.locator(".roofline-line")).toHaveCount(8);
  });

  test("decode, prefill, batch, and prompt length update every selected result", async ({ page }) => {
    await loadSimulator(page);
    await expect(page.locator("#intensity-value")).toHaveText("4");
    await expect(page.locator("#chart-summary")).toContainText("4 FLOP/byte");

    await page.getByRole("radio", { name: /Prefill/ }).check();
    await expect(page.locator("#intensity-value")).toHaveText("2,048");
    await expect(page.locator("#chart-summary")).toContainText("2,048 FLOP/byte");
    await expect(page.locator("#context-size")).toBeEnabled();

    await setRangeValue(page, "#batch-size", 8);
    await expect(page.locator("#intensity-value")).toHaveText("16,384");
    await expect(page.locator("#results-table-body tr")).toHaveCount(8);

    await page.getByRole("radio", { name: /Decode/ }).check();
    await expect(page.locator("#intensity-value")).toHaveText("32");
    await expect(page.locator("#context-size")).toBeDisabled();
  });

  test("capacity fit distinguishes does-not-fit, fits, and unknown", async ({ page }) => {
    await loadSimulator(page);
    await setRangeValue(page, "#model-size", 70);
    const tpuRow = page.locator("#results-table-body tr").filter({ hasText: "TPU v6e" });
    await expect(tpuRow).toContainText("Does not fit");

    const groqRow = page.locator("#results-table-body tr").filter({ hasText: "Groq LPU" });
    await expect(groqRow).toContainText("Unknown");

    await setRangeValue(page, "#host-ram", 64);
    const amdRow = page.locator("#results-table-body tr").filter({ hasText: "Zen 5" });
    await expect(amdRow).toContainText("Fits · estimated");
  });

  test("profile details qualify manufacturer claims and expose a source", async ({ page }) => {
    await loadSimulator(page);
    const groq = page.locator('[data-profile-id="groq-lpu"]');
    await expect(groq).toContainText("≥80 TB/s");

    await page.locator("#flow-details summary").click();
    await page.locator("#flow-profile-select").selectOption("groq-lpu");
    await expect(page.locator("#active-source")).toHaveAttribute("href", "https://groq.com/lpu/");
    await expect(page.locator("#flow-compute")).toHaveText("TSP · dataflow");
    await expect(page.locator("#flow-note")).toContainText("not equivalent");
    await expect(page.locator("#results-table-body tr")).toHaveCount(8);
  });

  test("keyboard controls work and the page has no mobile horizontal overflow", async ({ page }) => {
    await loadSimulator(page, 360, 800);
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();

    const modelSlider = page.getByRole("slider", { name: /Model size/ });
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

  test("animation runs on-screen, pauses, resumes, and suspends offscreen", async ({ page }) => {
    await installAnimationProbe(page);
    await loadSimulator(page);
    await page.locator("#flow-details summary").click();
    await page.locator("#flow-board").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const runningFrames = await page.evaluate(() => window.__observedAnimationFrames);
    expect(runningFrames).toBeGreaterThan(5);

    const motionButton = page.locator("#motion-toggle");
    await expect(motionButton).toHaveAttribute("aria-pressed", "true");
    await motionButton.click();
    await expect(motionButton).toHaveAttribute("aria-pressed", "false");
    await page.waitForTimeout(160);
    const pausedFrames = await page.evaluate(() => window.__observedAnimationFrames);
    await page.waitForTimeout(160);
    expect(await page.evaluate(() => window.__observedAnimationFrames)).toBe(pausedFrames);

    await page.getByRole("button", { name: "Resume animation" }).click();
    await page.waitForTimeout(160);
    const resumedFrames = await page.evaluate(() => window.__observedAnimationFrames);
    expect(resumedFrames).toBeGreaterThan(pausedFrames);

    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
    });
    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const canvas = document.getElementById("flow-canvas");
        if (!canvas) {
          reject(new Error("Flow canvas not found"));
          return;
        }
        const observer = new IntersectionObserver((entries) => {
          if (entries.some((entry) => !entry.isIntersecting)) {
            observer.disconnect();
            resolve();
          }
        });
        observer.observe(canvas);
        window.setTimeout(() => {
          observer.disconnect();
          reject(new Error("Flow canvas did not leave the viewport"));
        }, 3_000);
      });
    });
    await page.waitForTimeout(100);
    const offscreenFrames = await page.evaluate(() => window.__observedAnimationFrames);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__observedAnimationFrames)).toBe(offscreenFrames);
  });

  test("respects reduced motion while keeping comparison controls active", async ({ page }) => {
    await installAnimationProbe(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await loadSimulator(page);
    await page.locator("#flow-details summary").click();
    await page.locator("#flow-board").scrollIntoViewIfNeeded();

    const motionButton = page.getByRole("button", { name: "Reduced motion active" });
    await expect(motionButton).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#intensity-value")).toHaveText("4");
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__observedAnimationFrames)).toBe(0);

    await page.getByRole("radio", { name: /Prefill/ }).check();
    await expect(page.locator("#intensity-value")).toHaveText("2,048");
  });
});
