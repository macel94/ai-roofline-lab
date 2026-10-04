import { expect, test, type Page } from "@playwright/test";

async function setRangeValue(page: Page, selector: string, value: number): Promise<void> {
  await page.locator(selector).evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function loadSimulator(page: Page, width = 1280, height = 800): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto("/");
}

test.describe("English silicon data-path simulator", () => {
  test("opens on the shared physical map and explains the default decode bottleneck", async ({ page }) => {
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
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Why does AI wait?");
    await expect(page.getByRole("heading", { name: "Follow the weights to the matrix engine" })).toBeVisible();
    await expect(page.locator("#silicon-lanes .silicon-lane")).toHaveCount(8);
    await expect(page.locator("#silicon-lanes .lane-select[aria-pressed='true']")).toHaveCount(8);
    await expect(page.locator("#selected-count")).toHaveText("8 of 8 included");
    await expect(page.locator("#map-weight-volume")).toHaveText("3.5 GB");
    await expect(page.locator("#map-matrix-work")).toHaveText("14 GFLOP");
    await expect(page.locator("#map-intensity")).toHaveText("4 FLOP/byte");
    await expect(page.locator("#phase-note")).toContainText("one generated token per sequence");
    await expect(page.locator("#insight-title")).toHaveText("The memory feed is the wall in this scenario");
    await expect(page.locator("#insight-copy")).toContainText("8 of 8 paths wait on memory data");
    await expect(page.locator("#insight-copy")).toContainText("matrix work in 0.014 ms");

    const m5Max = page.locator('.silicon-lane[data-profile-id="m5-max"]');
    await expect(m5Max.locator(".lane-memory")).toContainText("Unified memory");
    await expect(m5Max.locator(".lane-engine")).toContainText("GPU · Neural Accelerators");
    await expect(m5Max.locator(".lane-verdict")).toContainText("Data feed");
    await expect(m5Max.locator(".lane-stage-time")).toContainText("5.7 ms");
    await expect(m5Max.locator(".lane-engine")).toContainText("0.014 ms");

    const intel = page.locator('.silicon-lane[data-profile-id="lion-cove"]');
    await expect(intel.locator(".lane-memory")).toContainText("DDR5 system RAM");
    await expect(intel.locator(".lane-engine")).toContainText("P-core · E-core");
    await expect(intel.locator(".lane-physics-note")).toContainText("theoretical platform ceiling");
    await expect(page.locator("#technical-details")).not.toHaveAttribute("open", "");

    const firstViewport = await page.evaluate(() => ({
      mapTop: document.querySelector("#silicon-workbench")?.getBoundingClientRect().top ?? Infinity,
      insightTop: document.querySelector("#workload-insight")?.getBoundingClientRect().top ?? Infinity,
    }));
    expect(firstViewport.mapTop).toBeLessThan(800);
    expect(firstViewport.insightTop).toBeLessThan(800);

    await page.context().setOffline(true);
    await page.getByRole("radio", { name: /Prefill/ }).check();
    await expect(page.locator("#map-matrix-work")).toHaveText("7,168 GFLOP");
    await page.getByRole("radio", { name: /Decode/ }).check();
    await expect(page.locator("#map-matrix-work")).toHaveText("14 GFLOP");
    await page.context().setOffline(false);
    expect(externalRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("chip lanes toggle independently without removing the other physical paths", async ({ page }) => {
    await loadSimulator(page);
    const m4 = page.locator('.lane-select[data-profile-id="m4-max"]');
    const m5 = page.locator('.lane-select[data-profile-id="m5-max"]');
    const intel = page.locator('.lane-select[data-profile-id="lion-cove"]');

    await m4.click();
    await expect(m4).toHaveAttribute("aria-pressed", "false");
    await expect(m5).toHaveAttribute("aria-pressed", "true");
    await expect(intel).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#selected-count")).toHaveText("7 of 8 included");
    await expect(page.locator('.silicon-lane[data-profile-id="m4-max"]')).toHaveClass(/is-excluded/);
    await expect(page.locator('.silicon-lane[data-profile-id="m5-max"]')).toHaveAttribute("data-bottleneck", "memory");

    await intel.click();
    await expect(page.locator("#selected-count")).toHaveText("6 of 8 included");
    await expect(m5).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#insight-copy")).toContainText("6 of 6 paths wait on memory data");

    await m4.click();
    await intel.click();
    await expect(page.locator("#selected-count")).toHaveText("8 of 8 included");
  });

  test("Select all, Clear all, and reset restore the shared scenario", async ({ page }) => {
    await loadSimulator(page);
    await page.locator("#technical-details summary").click();
    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page.locator(".lane-select[aria-pressed='true']")).toHaveCount(0);
    await expect(page.locator(".silicon-lane.is-excluded")).toHaveCount(8);
    await expect(page.locator("#insight-title")).toHaveText("Choose a chip lane to start the comparison");
    await expect(page.locator("#comparison-empty")).toBeVisible();

    await page.getByRole("button", { name: "Select all", exact: true }).click();
    await expect(page.locator(".lane-select[aria-pressed='true']")).toHaveCount(8);
    await expect(page.locator("#results-table-body tr")).toHaveCount(8);

    await page.getByRole("button", { name: "Clear all" }).click();
    await setRangeValue(page, "#model-size", 70);
    await page.getByRole("button", { name: "Reset scenario" }).click();
    await expect(page.locator(".lane-select[aria-pressed='true']")).toHaveCount(8);
    await expect(page.locator("#model-size-value")).toHaveText("7 B");
    await expect(page.locator("#map-weight-volume")).toHaveText("3.5 GB");
    await expect(page.locator("#map-intensity")).toHaveText("4 FLOP/byte");
    await expect(page.getByRole("radio", { name: /Decode/ })).toBeChecked();
  });

  test("Decode-to-Prefill changes the bottleneck because weights are reused", async ({ page }) => {
    await loadSimulator(page);
    await expect(page.locator('.silicon-lane[data-bottleneck="memory"]')).toHaveCount(8);

    await page.getByRole("radio", { name: /Prefill/ }).check();
    await expect(page.locator("#map-weight-volume")).toHaveText("3.5 GB");
    await expect(page.locator("#map-matrix-work")).toHaveText("7,168 GFLOP");
    await expect(page.locator("#map-intensity")).toHaveText("2,048 FLOP/byte");
    await expect(page.locator("#phase-note")).toContainText("reuses the same weights across many prompt tokens");
    await expect(page.locator("#insight-title")).toHaveText("More of these paths are waiting on matrix work");
    await expect(page.locator("#insight-copy")).toContainText("3 paths wait on memory · 5 wait on matrix work");
    await expect(page.locator('.silicon-lane[data-profile-id="m5-max"]')).toHaveAttribute("data-bottleneck", "compute");
    await expect(page.locator('.silicon-lane[data-profile-id="zen-5"]')).toHaveAttribute("data-bottleneck", "memory");
    await expect(page.locator('.silicon-lane[data-profile-id="m5-max"] .lane-engine')).toContainText("7.168 ms");

    await page.getByRole("radio", { name: /Decode/ }).check();
    await expect(page.locator("#map-intensity")).toHaveText("4 FLOP/byte");
    await expect(page.locator("#context-size")).toBeDisabled();
  });

  test("model size, weight bits, batch, context, and the reference rate update the explanation", async ({ page }) => {
    await loadSimulator(page);
    await setRangeValue(page, "#model-size", 70);
    await expect(page.locator("#map-weight-volume")).toHaveText("35 GB");
    await expect(page.locator("#working-set-value")).toHaveText("42 GB");

    await page.locator("#weight-bits").selectOption("8");
    await expect(page.locator("#map-weight-volume")).toHaveText("70 GB");
    await expect(page.locator("#map-intensity")).toHaveText("2 FLOP/byte");

    await page.locator("#weight-bits").selectOption("4");
    await page.getByRole("radio", { name: /Prefill/ }).check();
    await setRangeValue(page, "#batch-size", 8);
    await expect(page.locator("#map-matrix-work")).toHaveText("573,440 GFLOP");
    await expect(page.locator("#map-intensity")).toHaveText("16,384 FLOP/byte");

    await page.locator(".advanced-control summary").click();
    await setRangeValue(page, "#compute-ceiling", 100);
    await expect(page.locator("#reference-rate")).toHaveText("100 TFLOP/s");
    await expect(page.locator("#compute-ceiling-value")).toHaveText("100 TFLOP/s");
    await expect(page.locator("#insight-copy")).toContainText("shared 100 TFLOP/s teaching rate");
  });

  test("lane fit distinguishes capacity from bandwidth and preserves unknowns", async ({ page }) => {
    await loadSimulator(page);
    await setRangeValue(page, "#model-size", 70);
    await expect(page.locator('.silicon-lane[data-profile-id="tpu-v6e"] .lane-fit')).toContainText("Does not fit");
    await expect(page.locator('.silicon-lane[data-profile-id="groq-lpu"] .lane-fit')).toContainText("Unknown");
    await expect(page.locator('.silicon-lane[data-profile-id="blackwell-b200"] .lane-fit')).toContainText("Fits");

    await setRangeValue(page, "#host-ram", 64);
    await expect(page.locator('.silicon-lane[data-profile-id="zen-5"] .lane-fit')).toContainText("Fits");
    await expect(page.locator('.silicon-lane[data-profile-id="lion-cove"] .lane-memory')).toContainText("Configurable host RAM");
  });

  test("hardware notes and source links explain each physical path", async ({ page }) => {
    await loadSimulator(page);
    const groq = page.locator('.silicon-lane[data-profile-id="groq-lpu"]');
    await expect(groq.locator(".lane-memory")).toContainText("On-chip SRAM");
    await expect(groq.locator(".lane-engine")).toContainText("TSP · dataflow");
    await expect(groq.locator(".lane-physics-note")).toContainText("compiler schedules");
    await expect(groq.locator(".lane-source")).toHaveAttribute("href", "https://groq.com/lpu/");
    await expect(groq.locator(".lane-transfer-head")).toContainText("≥80 TB/s");
    await expect(groq.locator(".lane-compute-fact")).toContainText("no comparable compute peak");

    const b200 = page.locator('.silicon-lane[data-profile-id="blackwell-b200"]');
    await expect(b200.locator(".lane-compute-fact")).toContainText("9 PFLOP/s per GPU");
    await expect(b200.locator(".lane-compute-fact-label")).toContainText("DERIVED");

    const tpu = page.locator('.silicon-lane[data-profile-id="tpu-v6e"]');
    await expect(tpu.locator(".lane-compute-fact")).toContainText("918 TFLOP/s BF16");

    const apple = page.locator('.silicon-lane[data-profile-id="m4-max"]');
    await expect(apple.locator(".lane-physics-note")).toContainText("reduces explicit copies");
    await expect(page.locator(".workbench-caveat")).toContainText("not a chip spec or measured latency");
  });

  test("keyboard can include a path and the 360px layout has no horizontal overflow", async ({ page }) => {
    await loadSimulator(page, 360, 800);
    const m4 = page.locator('.lane-select[data-profile-id="m4-max"]');
    await m4.focus();
    await page.keyboard.press("Enter");
    await expect(m4).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".lane-select:focus")).toHaveAttribute("data-profile-id", "m4-max");

    const modelSlider = page.getByRole("slider", { name: /Model size/ });
    await modelSlider.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#model-size-value")).toHaveText("8 B");

    const width = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(width.page).toBeLessThanOrEqual(width.viewport + 1);
  });

  test("data-flow motion can pause/resume and respects reduced motion and offscreen state", async ({ page }) => {
    await loadSimulator(page);
    const workbench = page.locator("#silicon-workbench");
    const firstStream = page.locator(".lane-stream-signal").first();
    const motionButton = page.locator("#motion-toggle");
    await expect(motionButton).toHaveText(/Pause data flow/);
    await expect(firstStream).toHaveCSS("animation-play-state", "running");

    await motionButton.click();
    await expect(workbench).toHaveClass(/is-paused/);
    await expect(firstStream).toHaveCSS("animation-play-state", "paused");
    await page.getByRole("button", { name: "Resume data flow" }).click();
    await expect(workbench).not.toHaveClass(/is-paused/);
    await expect(firstStream).toHaveCSS("animation-play-state", "running");

    // Exercise the visibility handler without relying on headless tab scheduling.
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(workbench).toHaveClass(/is-paused/);
    await expect(firstStream).toHaveCSS("animation-play-state", "paused");
    await page.evaluate(() => {
      Reflect.deleteProperty(document, "visibilityState");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(firstStream).toHaveCSS("animation-play-state", "running");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.getByRole("button", { name: "Reduced motion is on" })).toHaveAttribute("aria-pressed", "false");
    await expect(workbench).toHaveClass(/is-paused/);
    await page.getByRole("radio", { name: /Prefill/ }).check();
    await expect(page.locator("#map-intensity")).toHaveText("2,048 FLOP/byte");

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await expect(workbench).toHaveClass(/is-paused/);
  });

  test("the optional Roofline chart and detailed results remain available", async ({ page }) => {
    await loadSimulator(page);
    await expect(page.locator("#technical-details")).not.toHaveAttribute("open", "");
    await page.locator("#technical-details summary").click();
    await expect(page.locator("#roofline-chart svg[role='img']")).toBeVisible();
    await expect(page.locator(".roofline-line")).toHaveCount(8);
    await expect(page.locator("#results-table-body tr")).toHaveCount(8);

    await page.locator('.lane-select[data-profile-id="m4-max"]').click();
    await expect(page.locator(".roofline-line")).toHaveCount(7);
    await expect(page.locator("#results-table-body tr")).toHaveCount(7);
    await expect(page.locator("#chart-summary")).toContainText("normalized reference compute ceiling");
  });
});
