import { expect, test } from "@playwright/test";

test.describe("Readable, restrained silicon lab", () => {
  test("uses local fonts and a consistent readable scale without decorative clutter", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("body")).toHaveCSS("font-size", "18px");
    await expect(page.locator("#model-size-exact")).toHaveCSS("font-size", "16px");
    await expect(page.locator(".control-help").first()).toHaveCSS("font-size", "14px");
    expect(await page.evaluate(() => document.fonts.check('16px "Atkinson Hyperlegible Next"'))).toBe(true);
    await expect(page.locator(".eyebrow, .section-kicker, .live-pill, .topbar-status, .insight-spark")).toHaveCount(0);
    await page.locator(".skip-link").focus();
    await page.locator(".skip-link").hover();
    await expect(page.locator(".skip-link")).toHaveCSS("color", "rgb(17, 25, 35)");
    await page.locator("#technical-details summary").click();
    await page.locator(".source-details summary").click();
    const small = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter(el => el.namespaceURI === "http://www.w3.org/1999/xhtml" && el.getClientRects().length &&
        Array.from(el.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) &&
        parseFloat(getComputedStyle(el).fontSize) < 14)
      .map(el => `${el.tagName}.${el.className}: ${getComputedStyle(el).fontSize}`));
    expect(small).toEqual([]);
  });

  test("compute-limit labels stay clear of component titles and processing arrays", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("radio", { name: /Prefill/ }).check();
    await page.evaluate(() => document.fonts.ready);
    const labels = page.locator('.physical-component[data-resource="compute"] .physical-limit');
    expect(await labels.count()).toBeGreaterThan(0);
    const overlaps = await labels.evaluateAll(elements => elements.filter(el => {
      const title = el.parentElement!.querySelector(":scope > text")!.getBoundingClientRect();
      const flag = el.getBoundingClientRect();
      return title.right > flag.left - 4 || Math.abs(title.top - flag.top) > 4;
    }).map(el => el.closest(".physical-map")?.getAttribute("data-chip")));
    expect(overlaps).toEqual([]);
  });

  test("active presets follow exact edits and reset without delaying results", async ({ page }) => {
    await page.goto("/");
    const small = page.getByRole("button", { name: "7B", exact: true });
    const huge = page.getByRole("button", { name: "2T", exact: true });
    await expect(small).toHaveAttribute("aria-pressed", "true");
    await huge.click();
    await expect(huge).toHaveAttribute("aria-pressed", "true");
    await expect(small).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#map-weight-volume")).toHaveText("1,000 GB");
    await page.locator("#model-size-exact").fill("71");
    await expect(page.locator(".model-presets button[aria-pressed=true]")).toHaveCount(0);
    await page.getByRole("button", { name: "Reset scenario" }).click();
    await expect(small).toHaveAttribute("aria-pressed", "true");
  });

  test("all enabled form controls and disclosure controls have generous targets", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto("/");
    await page.locator(".advanced-control summary").click();
    await page.locator(".shape-controls summary").click();
    await page.locator(".chip-assumptions summary").first().click();
    const short = await page.locator("button, select, input[type=number], input[type=range], summary, .phase-option").evaluateAll(elements =>
      elements.filter(el => el.getClientRects().length && el.getBoundingClientRect().height < 43.9)
        .map(el => `${el.tagName}#${el.id}.${el.className}: ${el.getBoundingClientRect().height}`));
    expect(short).toEqual([]);
  });

  test("HTML text and control borders meet AA contrast across rendered states", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "2T", exact: true }).click();
    await page.locator("#technical-details summary").click();
    await page.locator(".advanced-control summary").click();
    await page.locator(".chip-assumptions summary").first().click();
    await page.locator("#efficiency").fill("0");
    const failures = await page.evaluate(() => {
      const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number);
      const lum = (color: number[]) => color.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
      const ratio = (a: number[], b: number[]) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
      const background = (el: Element): number[] => {
        for (let parent: Element | null = el; parent; parent = parent.parentElement) {
          const c = rgb(getComputedStyle(parent).backgroundColor);
          if (c.length === 3 || c[3] === 1) return c;
        }
        return [17, 25, 35];
      };
      const bad: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>("body *")) {
        if (el.namespaceURI !== "http://www.w3.org/1999/xhtml" || !el.getClientRects().length) continue;
        const style = getComputedStyle(el);
        if (parseFloat(style.opacity) < 1 || el.closest(":disabled")) continue;
        const hasText = Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
        if (hasText || el.matches("input[type=number], select")) {
          const size = parseFloat(style.fontSize), weight = parseInt(style.fontWeight);
          const minimum = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
          const contrast = ratio(rgb(style.color), background(el));
          if (contrast < minimum) bad.push(`${el.tagName}.${el.className}: text ${contrast.toFixed(2)}`);
        }
        if (el.matches("input[type=number], select")) {
          const border = ratio(rgb(style.borderTopColor), background(el.parentElement!));
          if (border < 3) bad.push(`${el.id}: border ${border.toFixed(2)}`);
        }
      }
      return bad;
    });
    expect(failures).toEqual([]);
  });

  test("preserves a schematic's horizontal exploration when the workload changes", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto("/");
    const viewport = page.locator(".physical-viewport").first();
    await viewport.evaluate(el => { el.scrollLeft = 480; });
    await page.getByRole("button", { name: "2T", exact: true }).click();
    expect(await viewport.evaluate(el => el.scrollLeft)).toBe(480);
  });

  test("changed bars acknowledge values briefly, but obey reduced motion and pause", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    const notes = page.locator(".capacity-readout").first();
    await notes.scrollIntoViewIfNeeded();
    const change = () => page.locator("#model-size-exact").evaluate(el => {
      (el as HTMLInputElement).value = (el as HTMLInputElement).value === "70" ? "7" : "70";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return document.getAnimations().filter(a => {
        const target = (a.effect as KeyframeEffect | null)?.target;
        return target instanceof HTMLElement && target.matches(".occupancy-fill, .resource-bar i");
      }).length;
    });
    expect(await change()).toBeGreaterThan(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(250);
    expect(await change()).toBe(0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.locator("#motion-toggle").click();
    await expect(page.locator("#motion-toggle")).toHaveAttribute("aria-pressed", "false");
    await notes.scrollIntoViewIfNeeded();
    expect(await change()).toBe(0);
  });

  for (const width of [320, 360, 768, 1440]) {
    test(`reflows at ${width}px with 200% HTML text and open disclosures`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/");
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      await page.locator(".advanced-control summary").click();
      await page.locator(".shape-controls summary").click();
      await page.locator("#technical-details summary").click();
      await page.locator(".source-details summary").click();
      await page.locator(".chip-assumptions summary").first().click();
      const size = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth }));
      expect(size.document).toBeLessThanOrEqual(size.viewport + 1);
      await expect(page.locator("body")).toHaveCSS("font-size", "36px");
      await expect(page.locator("#model-size-exact")).toHaveCSS("font-size", "32px");
    });
  }
});
