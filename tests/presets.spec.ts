import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { MODEL_PRESETS, getModelPreset, presetKVGB } from "../src/data/models";
import { getProfile } from "../src/data/profiles";
import { calculateArchitecture, validateCluster, type ClusterInput } from "../src/domain/architecture";
import { calculateScenario } from "../src/domain/model";
import { networkBudget } from "../src/visuals/planning";

function input(id: string, overrides: Partial<ClusterInput> = {}): ClusterInput {
  const m = getModelPreset(id)!;
  const phase = overrides.phase ?? "decode";
  return { phase, modelPresetId: id, storageFormat: "native", modelParamsBillion: m.paramsBillion,
    weightBits: m.weightBits, layers: m.layers, hiddenWidth: m.hiddenWidth, kvWidth: m.kvWidth,
    activeFraction: m.activeBillion[phase] / m.paramsBillion, kvRatio: 0.125,
    contextTokens: 512, batch: 1, computeCeilingTFLOPS: 1000, hostRamGB: 128,
    unitsMode: "auto", units: 1, networkGbps: 400, networkLatencyUs: 2, offload: false,
    efficiency: 0.7, targetTokensPerSecond: 20, ...overrides };
}
const calculate = (i: ClusterInput, id = "blackwell-b200") => calculateArchitecture(i, getProfile(id)!);

test.describe("Revision-pinned model and hardware assumptions", () => {
  test("every named model has offline provenance and phase-consistent metadata", () => {
    expect(MODEL_PRESETS.length).toBe(6);
    for (const m of MODEL_PRESETS) {
      expect(m.revision).toMatch(/^[0-9a-f]{40}$/);
      expect(m.repository).toContain("/");
      for (const phase of ["decode", "prefill"] as const) {
        const i = input(m.id, { phase });
        expect(validateCluster(i)).toBeNull();
        const r = calculate(i);
        expect(r.weightsGB).toBe(m.nativeWeightsGB);
        expect(r.kvGB).toBe(presetKVGB(m, 512, 1));
        expect(r.workingSetGB).toBeCloseTo(m.nativeWeightsGB * 1.2 + r.kvGB, 8);
        expect(r.minimumUnits).toBe(Math.ceil(r.workingSetGB / 180));
        expect(calculateScenario(i, getProfile("blackwell-b200")!).weightFootprintGB).toBe(m.nativeWeightsGB);
      }
    }
  });
  test("preset shape and context match revision-pinned official config fixtures", () => {
    for (const m of MODEL_PRESETS) {
      const root = JSON.parse(readFileSync(new URL(`fixtures/model-configs/${m.repository.replace("/", "--")}.json`, import.meta.url), "utf8"));
      const config = root.text_config ?? root;
      expect(m.layers).toBe(config.num_hidden_layers);
      expect(m.hiddenWidth).toBe(config.hidden_size);
      expect(m.maxContextTokens).toBe(config.max_position_embeddings);
      if (["qwen38-27b", "qwen3-30b-a3b", "gpt-oss-120b", "deepseek-v41-flash"].includes(m.id))
        expect(m.kvWidth).toBe(config.num_key_value_heads * config.head_dim);
      if (m.id === "qwen38-27b") expect(m.cache.fullLayers).toBe(config.layer_types.filter((type: string) => type === "full_attention").length);
      if (m.id === "gemma4-31b") {
        expect(m.cache.fullWidth).toBe(config.num_global_key_value_heads * config.global_head_dim);
        expect(m.cache.slidingWidth).toBe(config.num_key_value_heads * config.head_dim);
      }
      if (m.id === "mistral-small4") expect(m.kvWidth).toBe(config.kv_lora_rank + config.qk_rope_head_dim);
    }
  });
  test("DeepSeek checkpoint storage is mixed, not a uniform 763B Q4 or Q8", () => {
    const i = input("deepseek-v41-flash"), r = calculate(i);
    expect(r.weightsGB).toBe(510.286023);
    expect(r.minimumUnits).toBe(4);
    expect(r.activeWeightsGB).toBeCloseTo(32);
    expect(calculate({ ...i, storageFormat: "uniform", weightBits: 4 }).weightsGB).toBeCloseTo(381.602657897);
    expect(calculate({ ...i, storageFormat: "uniform", weightBits: 8 }).weightsGB).toBeCloseTo(763.205315794);
    const prefill = calculate(input("deepseek-v41-flash", { phase: "prefill" }));
    expect(prefill.activeWeightsGB).toBeCloseTo(16);
    expect(prefill.weightsGB).toBe(r.weightsGB);
    expect(prefill.kvGB).toBe(r.kvGB);
    expect(prefill.stages.find(s => s.resource === "compute")!.ms / r.stages.find(s => s.resource === "compute")!.ms).toBeCloseTo(256);
  });
  test("DeepSeek uses 890 global bytes/token plus bounded window/compressor state", () => {
    const m = getModelPreset("deepseek-v41-flash")!;
    const short = presetKVGB(m, 512, 1), long = presetKVGB(m, 1048576, 1);
    expect((long - short) * 1e9 / (1048576 - 512)).toBeCloseTo(890);
    expect(long).toBeCloseTo((890 * 1048576 + 40 * 128 * 528 + 24576) / 1e9, 10);
    expect(presetKVGB(m, 512, 8)).toBe(short * 8);
  });
  test("Qwen hybrid cache grows only through its 16 full-attention layers", () => {
    const m = getModelPreset("qwen38-27b")!;
    expect(m.layers).toBe(64); expect(m.hiddenWidth).toBe(5120); expect(m.kvWidth).toBe(1024);
    expect((presetKVGB(m, 8192, 1) - presetKVGB(m, 512, 1)) * 1e9).toBeCloseTo(16 * 1024 * 4 * (8192 - 512), 2);
    expect(presetKVGB(m, 512, 1)).toBeGreaterThan(16 * 1024 * 4 * 512 / 1e9);
  });
  test("GPT OSS has bounded sliding caches and released bytes exceed uniform Q4", () => {
    const m = getModelPreset("gpt-oss-120b")!;
    expect(presetKVGB(m, 512, 1)).toBe(18 * 512 * 4 * (512 + 128) / 1e9);
    expect(m.nativeWeightsGB).toBeGreaterThan(m.paramsBillion / 2);
    expect(presetKVGB(m, 8192, 1) - presetKVGB(m, 512, 1)).toBeCloseTo(18 * 512 * 4 * (8192 - 512) / 1e9);
  });
  test("Gemma local/global dimensions and MLA single latent are not GQA ratios", () => {
    expect(presetKVGB(getModelPreset("gemma4-31b")!, 8192, 1)).toBe((10 * 2048 * 8192 + 50 * 4096 * 1024) * 4 / 1e9);
    expect(presetKVGB(getModelPreset("mistral-small4")!, 8192, 1)).toBe(36 * 320 * 2 * 8192 / 1e9);
    const custom = input("mistral-small4", { modelPresetId: undefined, storageFormat: "uniform", kvWidth: 320 });
    expect(calculate(custom).kvGB).toBe(36 * 320 * 4 * 512 / 1e9);
  });
  test("preset callers cannot retain sourced labels while corrupting shape or active metadata", () => {
    for (const patch of [{ modelParamsBillion: 7 }, { layers: 32 }, { hiddenWidth: 8192 }, { activeFraction: 1 }])
      expect(() => calculate(input("deepseek-v41-flash", patch))).toThrow(/preset metadata/);
    expect(() => calculate(input("qwen38-27b", { modelPresetId: "missing" }))).toThrow(/Unknown model/);
    expect(() => calculate(input("qwen38-27b", { modelPresetId: undefined }))).toThrow(/requires a sourced/);
    expect(() => calculate(input("qwen38-27b", { contextTokens: 1048577 }))).toThrow(/1,048,576/);
    expect(() => calculate(input("qwen38-27b", { kvWidth: 0 }))).toThrow(/KV width/);
  });
  test("audited hardware distinguishes peak capacity, encoding ceiling and Groq generation", () => {
    expect(calculate(input("qwen38-27b"), "zen-5").capacityGB).toBe(128);
    expect(calculate(input("qwen38-27b", { hostRamGB: 512 }), "zen-5").capacityGB).toBe(256);
    const groq = calculate(input("deepseek-v41-flash"), "groq-lpu");
    expect(groq.capacityGB).toBe(0.22);
    expect(groq.minimumUnits).toBeGreaterThan(1024);
    expect(groq.tokensPerSecond).toBeNull();
    expect(getProfile("groq-lpu")!.sourceUrl).toContain("HotChips34");
    expect(calculate(input("qwen38-27b")).architecture.busGBs).toBeCloseTo(63.015384615);
    expect(calculate(input("qwen38-27b"), "m4-npu").architecture.mathEvidence).toContain("NOT");
  });
  test("network guidance inverts the same ring formula and includes hop latency", () => {
    const i = input("qwen38-27b", { unitsMode: "manual", units: 4, targetTokensPerSecond: 100 });
    const r = calculate(i), budget = networkBudget(i, r);
    expect(budget.gbps).not.toBeNull();
    const exact = calculate({ ...i, networkGbps: budget.gbps! });
    expect(exact.tokensPerSecond).toBeCloseTo(100, 8);
    expect(calculate({ ...i, networkGbps: budget.gbps! / 2 }).tokensPerSecond).toBeLessThan(100);
    expect(calculate({ ...i, networkLatencyUs: budget.maxHopUs! }).tokensPerSecond).toBeCloseTo(100, 8);
    expect(networkBudget(i, calculate({ ...i, units: 1 })).gbps).toBe(0);
    expect(networkBudget({ ...i, targetTokensPerSecond: 10000 }, r).gbps).toBeNull();
  });
});

test.describe("Named presets and planning interaction", () => {
  test("loads Qwen metadata atomically, retains cluster settings and works offline", async ({ page }) => {
    const external: string[] = [], errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("request", r => { if (!r.url().startsWith("http://127.0.0.1:4173")) external.push(r.url()); });
    await page.goto("/");
    await page.locator("#target-rate").fill("30");
    await page.locator("#network-bandwidth").selectOption("100");
    await page.locator("#network-latency").fill("3");
    await page.context().setOffline(true);
    await page.locator("#model-preset").selectOption("qwen38-27b");
    await expect(page.locator("#weight-bits")).toHaveValue("native");
    await expect(page.locator("#model-size-exact")).toHaveValue("27.781427952");
    await expect(page.locator("#map-weight-volume")).toHaveText("55.56 GB");
    await expect(page.locator("#model-layers")).toHaveValue("64");
    await expect(page.locator("#hidden-width")).toHaveValue("5120");
    await expect(page.locator("#kv-width")).toHaveValue("1024");
    await expect(page.locator("#target-rate")).toHaveValue("30");
    await expect(page.locator("#network-bandwidth")).toHaveValue("100");
    await expect(page.locator("#network-latency")).toHaveValue("3");
    await expect(page.locator("#model-source")).toHaveAttribute("href", /1d4bf0f2ff6012fd82039f2fa52739d0dd7c60c0/);
    await expect(page.locator("#scenario-error")).toBeHidden();
    expect(errors).toEqual([]); expect(external).toEqual([]);
  });
  test("DeepSeek switches active work on phase changes without resetting storage or target", async ({ page }) => {
    await page.goto("/");
    await page.locator("#model-preset").selectOption("deepseek-v41-flash");
    await expect(page.locator("#map-weight-volume")).toHaveText("510.29 GB");
    await expect(page.locator("#map-matrix-work")).toHaveText("32 GFLOP");
    await expect(page.locator("#map-intensity")).toHaveText("1 FLOP/byte");
    await expect(page.locator('[data-profile-id="blackwell-b200"] .minimum-units')).toHaveText("4 units");
    await page.getByRole("radio", { name: /Prefill/ }).check();
    await expect(page.locator("#map-matrix-work")).toHaveText("8,192 GFLOP");
    await expect(page.locator("#model-preset-summary")).toContainText("8B active (prefill)");
    await expect(page.locator("#model-preset")).toHaveValue("deepseek-v41-flash");
    await page.locator("#context-exact").fill("1048576");
    await expect(page.locator("#scenario-error")).toBeHidden();
    await expect(page.locator("#model-preset")).toHaveValue("deepseek-v41-flash");
    await page.locator("#weight-bits").selectOption("4");
    await expect(page.locator("#map-weight-volume")).toHaveText("381.6 GB");
    await expect(page.locator("#model-preset-summary")).toContainText("theoretical repack");
  });
  test("custom edits detach special cache rules while precision keeps the sourced layout", async ({ page }) => {
    await page.goto("/");
    await page.locator("#model-preset").selectOption("mistral-small4");
    await page.locator("#weight-bits").selectOption("16");
    await expect(page.locator("#model-preset")).toHaveValue("mistral-small4");
    await page.locator(".shape-controls summary").click();
    await page.locator("#kv-width").fill("512");
    await expect(page.locator("#model-preset")).toHaveValue("custom");
    await expect(page.locator("#model-source")).toBeHidden();
    await page.locator("#hidden-width").fill("8192");
    await expect(page.locator("#kv-width")).toHaveValue("512");
    await expect(page.locator("#scenario-error")).toBeHidden();
    await page.locator("#model-preset").selectOption("gpt-oss-120b");
    await page.locator("#active-fraction").fill("10");
    await expect(page.locator("#model-preset")).toHaveValue("custom");
    await expect(page.locator("#weight-bits")).toHaveValue("4");
    await page.getByRole("button", { name: "Reset scenario" }).click();
    await expect(page.locator("#model-preset")).toHaveValue("custom");
    await expect(page.locator("#map-weight-volume")).toHaveText("3.5 GB");
  });
  for (const m of MODEL_PRESETS) {
  test(`${m.name} preserves batch, context, phase, manual allocation and offload`, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("radio", { name: /Prefill/ }).check();
    await page.locator("#units-mode").selectOption("manual");
    await page.locator("#unit-count").fill("4");
    await page.locator("#host-offload").check();
    await page.locator("#context-exact").fill("8192");
    await page.locator("#batch-size").evaluate(el => { (el as HTMLInputElement).value = "8"; el.dispatchEvent(new Event("input", { bubbles: true })); });
      await page.locator("#model-preset").selectOption(m.id);
      await expect(page.locator("#model-layers")).toHaveValue(String(m.layers));
      await expect(page.locator("#hidden-width")).toHaveValue(String(m.hiddenWidth));
      await expect(page.locator("#weight-bits")).toHaveValue("native");
      await expect(page.locator("#units-mode")).toHaveValue("manual");
      await expect(page.locator("#unit-count")).toHaveValue("4");
      await expect(page.locator("#batch-size")).toHaveValue("8");
      await expect(page.locator("#context-exact")).toHaveValue("8192");
      await expect(page.locator("#host-offload")).toBeChecked();
      await expect(page.getByRole("radio", { name: /Prefill/ })).toBeChecked();
      await expect(page.locator("#scenario-error")).toBeHidden();
  });
  }
  test("long context warns about config limits without pretending extension is supported", async ({ page }) => {
    await page.goto("/");
    await page.locator("#model-preset").selectOption("qwen3-30b-a3b");
    await page.locator("#context-exact").fill("1048576");
    await expect(page.locator("#model-preset-summary")).toContainText("exceeds config limit 40,960");
    await expect(page.locator("#scenario-error")).toBeHidden();
    await page.locator("#context-exact").fill("1048577");
    await expect(page.locator("#scenario-error")).toBeVisible();
    await page.locator("#context-exact").fill("512");
    await expect(page.locator("#scenario-error")).toBeHidden();
    await expect(page.locator("#model-preset-summary")).not.toContainText("exceeds config limit");
  });
  test("shortlist details persist, target count can be explored and exclusions remain interactive", async ({ page }) => {
    await page.goto("/");
    await page.locator("#model-preset").selectOption("deepseek-v41-flash");
    const plan = page.locator('[data-plan-profile="blackwell-b200"]');
    await plan.locator("summary").click();
    await expect(plan).toContainText("4 units for target");
    await expect(plan).toContainText("usable Gbit/s per rank");
    await page.locator("#target-rate").fill("25");
    await expect(plan).toHaveAttribute("open", "");
    await plan.getByRole("button", { name: "Explore 4 units" }).click();
    await expect(page.locator("#units-mode")).toHaveValue("manual");
    await expect(page.locator("#unit-count")).toHaveValue("4");
    await page.getByRole("button", { name: "Clear all", exact: true }).click();
    await expect(page.locator("#planning-results details")).toHaveCount(0);
    await expect(page.locator("#planning-summary")).toContainText("Include a chip");
  });
});
