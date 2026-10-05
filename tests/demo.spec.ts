import { expect, test, type Page } from "@playwright/test";
import { HARDWARE_PROFILES } from "../src/data/profiles";
const count = HARDWARE_PROFILES.length;
const lane = (page: Page, id: string) => page.locator(`.silicon-lane[data-profile-id="${id}"]`);
async function range(page: Page, selector: string, value: number): Promise<void> {
  await page.locator(selector).evaluate((element, next) => {
    (element as HTMLInputElement).value = String(next);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}
async function load(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/");
}
async function manual(page: Page, units: number) {
  await page.locator("#units-mode").selectOption("manual");
  await page.locator("#unit-count").fill(String(units));
}

test.describe("Physical architecture simulation and calculator", () => {
  test("renders distinct physical CPU, GPU, TPU, NPU schematics with no runtime requests or errors", async ({ page }) => {
    const errors: string[] = [], external: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("request", r => { if (new URL(r.url()).origin !== "http://127.0.0.1:4173") external.push(r.url()); });
    await load(page);
    await expect(page).toHaveTitle(/AI Silicon \/ Roofline Lab/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Why does AI wait?");
    await expect(page.locator(".physical-map")).toHaveCount(count);
    await expect(page.locator(".lane-select[aria-pressed=true]")).toHaveCount(count);
    await expect(lane(page, "zen-5").getByRole("img")).toHaveAttribute("data-kind", "cpu");
    await expect(lane(page, "zen-5").getByRole("img")).toContainText("Shared L3");
    await expect(lane(page, "blackwell-b200").getByRole("img")).toContainText("HBM3e stacks");
    await expect(lane(page, "blackwell-b200").getByRole("img")).toContainText("SM / Tensor Core tiles");
    await expect(lane(page, "tpu-v6e").locator(".processor-cell")).toHaveCount(2);
    await expect(lane(page, "tpu-v6e").locator(".systolic-cell")).toHaveCount(50);
    await expect(lane(page, "m4-npu").getByRole("img")).toContainText("Neural Engine / MAC tiles");
    await expect(lane(page, "m4-max").getByRole("img")).toContainText("no CPU ↔ accelerator PCIe copy");
    await expect(lane(page, "blackwell-b200")).toHaveAttribute("data-bottleneck", "memory");
    await expect(lane(page, "blackwell-b200").locator('.physical-component.hot[data-resource="memory"]')).toHaveCount(1);
    await expect(lane(page, "blackwell-b200").locator(".physical-component.unmodeled")).toContainText("unmodeled");
    await expect(lane(page, "blackwell-b200").locator(".memory-cell.occupied").first()).toHaveCSS("fill", "rgb(174, 215, 101)");
    await expect(lane(page, "blackwell-b200").locator('[data-resource="host"] .memory-cell.occupied')).toHaveCount(0);
    await expect(lane(page, "groq-lpu").locator(".minimum-units")).toHaveText("Unknown");
    await expect(lane(page, "groq-lpu").locator(".simulation-speed")).toHaveText("Blocked / unknown");
    await page.context().setOffline(true);
    await page.getByRole("button", { name: "2T", exact: true }).click();
    await expect(page.locator("#map-weight-volume")).toHaveText("1,000 GB");
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
  test("2T preset sizes independent memory domains and shows exact model control", async ({ page }) => {
    await load(page);
    await page.getByRole("button", { name: "2T", exact: true }).click();
    await expect(page.locator("#model-size-value")).toHaveText("2 T");
    await expect(page.locator("#model-size-exact")).toHaveValue("2000");
    await expect(page.locator("#model-size")).toHaveValue("2000");
    await expect(lane(page, "blackwell-b200").locator(".minimum-units")).toHaveText("7 units");
    await expect(lane(page, "tpu-v6e").locator(".minimum-units")).toHaveText("38 units");
    await expect(lane(page, "m4-npu").locator(".minimum-units")).toHaveText("10 units");
    await expect(lane(page, "blackwell-b200").locator(".target-units")).toHaveText("7 units (modeled)");
    await page.locator("#model-size-exact").fill("405");
    await expect(page.locator("#model-size-value")).toHaveText("405 B");
    await expect(page.locator("#model-size")).toHaveValue("405");
    await range(page, "#model-size", 70);
    await expect(page.locator("#model-size-exact")).toHaveValue("70");
  });
  test("manual OOM is visibly blocked; offload moves the hotspot into PCIe", async ({ page }) => {
    await load(page);
    await page.getByRole("button", { name: "405B", exact: true }).click();
    await manual(page, 1);
    const gpu = lane(page, "blackwell-b200");
    await expect(gpu).toHaveAttribute("data-bottleneck", "capacity");
    await expect(gpu.locator(".physical-blocked")).toHaveText("■ OUT OF MEMORY");
    await expect(gpu.locator(".simulation-speed")).toHaveText("Blocked / unknown");
    await expect(gpu.locator(".occupancy-fill")).toHaveClass(/overflow/);
    await page.locator("#host-offload").check();
    await expect(gpu).toHaveAttribute("data-bottleneck", "bus");
    await expect(gpu.locator('.physical-component.hot[data-resource="bus"]')).toContainText("PCIe");
    await expect(gpu.locator(".bottleneck-why")).toContainText("cross PCIe every step");
    expect(await gpu.locator('[data-resource="host"] .memory-cell.occupied').count()).toBeGreaterThan(0);
    await expect(gpu.locator('[data-resource="host"] .memory-cell.occupied').first()).toHaveCSS("fill", "rgb(174, 215, 101)");
    await expect(gpu.locator(".simulation-speed")).not.toHaveText("Blocked / unknown");
    await expect(lane(page, "m4-npu")).toHaveAttribute("data-bottleneck", "capacity");
    await range(page, "#host-ram", 16);
    await expect(gpu.locator(".bottleneck-why")).toContainText("Host RAM");
  });
  test("network latency and disconnected network are visible at the physical link", async ({ page }) => {
    await load(page);
    await manual(page, 16);
    await page.locator("#network-latency").fill("100");
    const gpu = lane(page, "blackwell-b200");
    await expect(gpu).toHaveAttribute("data-bottleneck", "network");
    await expect(gpu.locator('.physical-component.hot[data-resource="network"]')).toContainText("16 UNITS");
    await expect(gpu.locator(".bottleneck-why")).toContainText("adding more chips can make this slower");
    await page.locator("#network-bandwidth").selectOption("0");
    await expect(gpu.locator(".physical-blocked")).toHaveText("■ NETWORK DISCONNECTED");
    await expect(gpu.locator(".simulation-speed")).toHaveText("Blocked / unknown");
    await page.locator("#unit-count").fill("1");
    await expect(gpu).toHaveAttribute("data-bottleneck", "memory");
    await expect(gpu.locator('.resource-time[data-resource="network"]')).toContainText("not used");
  });
  test("decode versus prefill illuminates different processing stages and labels rate scope", async ({ page }) => {
    await load(page);
    await expect(lane(page, "zen-5")).toHaveAttribute("data-bottleneck", "memory");
    await page.getByRole("radio", { name: /Prefill/ }).check();
    await expect(lane(page, "zen-5")).toHaveAttribute("data-bottleneck", "compute");
    await expect(lane(page, "tpu-v6e")).toHaveAttribute("data-bottleneck", "compute");
    await expect(lane(page, "tpu-v6e").locator('.physical-component.hot[data-resource="compute"]')).toHaveCount(1);
    expect(Number(await lane(page, "tpu-v6e").locator(".physical-map").getAttribute("data-compute-duty"))).toBeCloseTo(100);
    await expect(page.locator("#map-matrix-work")).toHaveText("7,168 GFLOP");
    await expect(page.locator("#phase-note")).toContainText("reuses the same weights");
    await expect(page.locator("#insight-copy")).toContainText("not next-token generation");
    await page.getByRole("radio", { name: /Decode/ }).check();
    await expect(page.locator("#context-size")).toBeEnabled();
  });
  test("context, precision, shape and MoE update capacity separately from active compute", async ({ page }) => {
    await load(page);
    const gpu = lane(page, "blackwell-b200");
    const first = await gpu.locator(".capacity-readout small").textContent();
    await range(page, "#context-size", 8192);
    expect(await gpu.locator(".capacity-readout small").textContent()).not.toBe(first);
    await page.locator("#weight-bits").selectOption("16");
    await expect(page.locator("#map-weight-volume")).toHaveText("14 GB");
    await page.locator(".shape-controls summary").click();
    await page.locator("#active-fraction").fill("10");
    await expect(page.locator("#map-matrix-work")).toHaveText("1.4 GFLOP");
    await expect(page.locator("#map-weight-volume")).toHaveText("14 GB");
    await page.locator("#shape-mode").selectOption("manual");
    await page.locator("#model-layers").fill("80");
    await page.locator("#hidden-width").fill("8192");
    await page.locator("#kv-ratio").selectOption("1");
    await expect(gpu.locator(".capacity-readout small")).toContainText("21.47 GB BF16 KV");
  });
  test("unknown capacity can be an explicit user assumption and resetting clears it", async ({ page }) => {
    await load(page);
    const groq = lane(page, "groq-lpu");
    await groq.locator("summary").click();
    await expect(groq.locator(".chip-capacity")).toHaveAttribute("placeholder", /Unknown/);
    await groq.locator(".chip-capacity").fill("10");
    await groq.locator(".chip-rate").fill("20");
    await groq.getByRole("button", { name: "Apply chip assumptions" }).click();
    await expect(groq.locator(".minimum-units")).toHaveText("1 unit");
    await expect(groq.locator(".simulation-speed")).not.toHaveText("Blocked / unknown");
    await expect(groq.locator("details")).toHaveAttribute("open", "");
    await expect(groq.locator("details")).toContainText("User-supplied");
    await page.getByRole("button", { name: "Reset scenario" }).click();
    await expect(groq.locator(".minimum-units")).toHaveText("Unknown");
    await expect(groq.locator(".chip-capacity")).toHaveValue("");
    await expect(page.locator("#units-mode")).toHaveValue("auto");
    await expect(page.locator("#network-bandwidth")).toHaveValue("400");
  });
  test("invalid inputs retain the last valid visualization and recover without page errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await load(page);
    await page.locator("#model-size-exact").fill("2001");
    await expect(page.locator("#scenario-error")).toBeVisible();
    await expect(page.locator("#scenario-error")).toContainText("Last valid visualization retained");
    await expect(page.locator("#map-weight-volume")).toHaveText("3.5 GB");
    await page.locator("#model-size-exact").fill("2000");
    await expect(page.locator("#scenario-error")).toBeHidden();
    await expect(page.locator("#map-weight-volume")).toHaveText("1,000 GB");
    await page.locator("#efficiency").fill("0");
    await expect(page.locator("#scenario-error")).toContainText("Efficiency");
    await page.locator("#efficiency").fill("70");
    await expect(page.locator("#scenario-error")).toBeHidden();
    expect(errors).toEqual([]);
  });
  test("selection, keyboard, clear and technical Roofline remain independent", async ({ page }) => {
    await load(page);
    await page.locator("#technical-details summary").click();
    await expect(page.locator(".roofline-line")).toHaveCount(count);
    await expect(page.locator("#results-table-body tr")).toHaveCount(count);
    const select = lane(page, "m4-max").locator(".lane-select");
    await select.focus();
    await page.keyboard.press("Enter");
    await expect(select).toHaveAttribute("aria-pressed", "false");
    await expect(select).toBeFocused();
    await expect(page.locator(".roofline-line")).toHaveCount(count - 1);
    await expect(page.locator(".physical-map")).toHaveCount(count);
    await page.getByRole("button", { name: "Clear all", exact: true }).click();
    await expect(page.locator("#comparison-empty")).toBeVisible();
    await expect(page.locator("#insight-title")).toContainText("Choose a chip");
    await page.getByRole("button", { name: "Select all", exact: true }).click();
    await expect(page.locator(".lane-select[aria-pressed=true]")).toHaveCount(count);
    await expect(page.locator("#chart-summary")).toContainText("normalized reference compute ceiling");
  });
  test("motion pauses, resumes, stops offscreen/hidden and respects reduced motion", async ({ page }) => {
    await load(page);
    await page.locator(".physical-viewport").first().scrollIntoViewIfNeeded();
    const packet = page.locator(".packet").first();
    await expect(packet).toHaveCSS("animation-play-state", "running");
    await page.locator("#motion-toggle").click();
    await expect(packet).toHaveCSS("animation-play-state", "paused");
    await page.locator("#motion-toggle").click();
    await page.locator(".physical-viewport").first().scrollIntoViewIfNeeded();
    await expect(packet).toHaveCSS("animation-play-state", "running");
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(packet).toHaveCSS("animation-play-state", "paused");
    await page.evaluate(() => {
      Reflect.deleteProperty(document, "visibilityState"); document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("#motion-toggle-label")).toHaveText("Reduced motion is on");
    await expect(packet).toHaveCSS("animation-name", "none");
    await expect(page.locator(".physical-map")).toHaveCount(count);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 400 });
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; window.scrollTo(0, document.documentElement.scrollHeight); });
    await expect(page.locator("#silicon-workbench")).toHaveClass(/is-paused/);
  });
  test("target search explains failure and chip-specific math can be overridden", async ({ page }) => {
    await load(page);
    await page.locator("#target-rate").fill("10000");
    const gpu = lane(page, "blackwell-b200");
    await expect(gpu.locator(".target-units")).toHaveText("Not reached within 1,024 units");
    await gpu.locator("summary").click();
    await gpu.locator(".chip-rate").fill("0.01");
    await gpu.getByRole("button", { name: "Apply chip assumptions" }).click();
    await expect(gpu).toHaveAttribute("data-bottleneck", "compute");
    await expect(gpu.locator(".physical-component.hot[data-resource=compute]")).toHaveCount(1);
    await expect(gpu.locator("details")).toContainText("User-supplied effective matrix ceiling");
  });
  for (const width of [360, 768, 1440]) {
    test(`responsive ${width}px controls and schematics do not overflow the document`, async ({ page }) => {
      await load(page, width);
      await page.getByRole("button", { name: "2T", exact: true }).click();
      const viewport = lane(page, "blackwell-b200").locator(".physical-viewport");
      await viewport.focus();
      if (width === 360) {
        const before = await viewport.evaluate(el => el.scrollLeft);
        await page.keyboard.press("ArrowRight");
        await expect.poll(() => viewport.evaluate(el => el.scrollLeft)).toBeGreaterThan(before);
      }
      const widths = await page.evaluate(() => ({ screen: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
      expect(widths.page).toBeLessThanOrEqual(widths.screen + 1);
      await page.screenshot({ path: `test-results/architecture-${width}.png`, fullPage: true, animations: "disabled" });
    });
  }
});
