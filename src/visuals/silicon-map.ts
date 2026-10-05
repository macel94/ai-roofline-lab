import type { ScenarioResult } from "../domain/model";
import type { ArchitectureProfile } from "../data/profiles";
import type { ArchitectureResult, ChipOverride, ClusterInput } from "../domain/architecture";
import { formatNumber } from "./roofline";
import { physicalMap, RESOURCE_LABELS } from "./architecture-map";

export interface SiliconMapTargets {
  readonly lanes: HTMLElement;
  readonly weightVolume: HTMLElement;
  readonly matrixWork: HTMLElement;
  readonly intensity: HTMLElement;
  readonly phaseNote: HTMLElement;
  readonly insightTitle: HTMLElement;
  readonly insightCopy: HTMLElement;
  readonly referenceRate: HTMLElement;
}
const f = formatNumber;
export function renderSiliconMap(
  targets: SiliconMapTargets,
  profiles: readonly ArchitectureProfile[],
  results: ReadonlyMap<string, ScenarioResult>,
  includedProfileIds: ReadonlySet<string>,
  input: ClusterInput,
  architectureResults: ReadonlyMap<string, ArchitectureResult>,
  overrides: ReadonlyMap<string, ChipOverride>,
  animateChanges = false,
): void {
  const reference = results.get(profiles[0]?.id ?? "");
  const architectureReference = architectureResults.get(profiles[0]?.id ?? "");
  targets.weightVolume.textContent = `${f(architectureReference?.weightsGB ?? 0, 2)} GB`;
  targets.matrixWork.textContent = `${f((reference?.operationsGFLOP ?? 0) * input.activeFraction, 2)} GFLOP`;
  targets.intensity.textContent = `${f((reference?.operationsGFLOP ?? 0) * input.activeFraction / (architectureReference?.activeWeightsGB ?? 1), 1)} FLOP/byte`;
  targets.referenceRate.textContent = `${f(input.computeCeilingTFLOPS, 0)} TFLOP/s`;
  targets.phaseNote.textContent = input.phase === "decode"
    ? "DECODE: one generated token per sequence. Context adds KV traffic; batch reuses weights."
    : `PREFILL: reuses the same weights across ${f(input.contextTokens, 0)} prompt tokens. Math grows; capacity includes the selected cache layout.`;

  const selected = profiles.filter(p => includedProfileIds.has(p.id)).map(p => architectureResults.get(p.id)!);
  const counts = new Map<string, number>();
  for (const result of selected) {
    const key = result.blockedReason ? (result.bottleneck === "unknown" ? "capacity unknown" : "blocked") : RESOURCE_LABELS[result.bottleneck];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  targets.insightTitle.textContent = !selected.length ? "Choose a chip lane to start the comparison"
    : selected.some(r => r.blockedReason) ? "Memory fit is not the same as execution speed"
    : "Same model. Different physical bottlenecks.";
  targets.insightCopy.textContent = selected.length
    ? [...counts].map(([label, count]) => `${count} ${label.toLowerCase()}`).join(" · ") +
      `. Red marks the limiting component; other stages can be faster without improving total speed. ${input.phase === "prefill" ? "Prefill processes the prompt, not next-token generation." : "Decode reads weights and existing KV for each next token."} Auto count fits memory; the target calculator also accounts for compute and communication. All speeds are assumption-based estimates.`
    : "All physical architectures remain visible. Include a chip to compare its memory space, bus, math, and network constraints.";

  const openDetails = new Set(Array.from(targets.lanes.querySelectorAll<HTMLDetailsElement>("details[open]")).map(d => d.dataset.chipId));
  const previous = new Map(Array.from(targets.lanes.querySelectorAll<HTMLElement>(".architecture-lane")).map(lane => [
    lane.dataset.profileId,
    {
      scrollLeft: lane.querySelector(".physical-viewport")?.scrollLeft ?? 0,
      bars: Array.from(lane.querySelectorAll<HTMLElement>(".occupancy-fill, .resource-bar i")).map(bar => parseFloat(bar.style.width)),
    },
  ] as const));
  const scale = Math.max(0.001, ...selected.flatMap(r => r.stages.map(s => s.ms)));
  const fragment = document.createDocumentFragment();
  for (const profile of profiles) {
    const result = architectureResults.get(profile.id);
    if (!result) continue;
    const lane = createLane(profile, result, includedProfileIds.has(profile.id), input, scale, overrides.get(profile.id));
    const detail = lane.querySelector<HTMLDetailsElement>("details");
    if (detail) detail.open = openDetails.has(profile.id);
    fragment.append(lane);
  }
  targets.lanes.replaceChildren(fragment);
  for (const lane of targets.lanes.querySelectorAll<HTMLElement>(".architecture-lane")) {
    const before = previous.get(lane.dataset.profileId);
    if (!before) continue;
    const viewport = lane.querySelector<HTMLElement>(".physical-viewport");
    if (viewport) viewport.scrollLeft = before.scrollLeft;
    if (!animateChanges || lane.classList.contains("is-excluded") || lane.dataset.blocked === "true") continue;
    for (const [index, bar] of Array.from(lane.querySelectorAll<HTMLElement>(".occupancy-fill, .resource-bar i")).entries()) {
      const from = before.bars[index] ?? 0;
      const to = parseFloat(bar.style.width);
      const bounds = bar.getBoundingClientRect();
      if (to <= 0 || Math.abs(from - to) < 0.1 || bounds.bottom < 0 || bounds.top > window.innerHeight) continue;
      bar.animate([{ transform: `scaleX(${from / to})` }, { transform: "scaleX(1)" }], {
        duration: 220, easing: "cubic-bezier(.16, 1, .3, 1)",
      });
    }
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function createLane(profile: ArchitectureProfile, result: ArchitectureResult, included: boolean, input: ClusterInput, scale: number, override?: ChipOverride): HTMLElement {
  const lane = el("article", `silicon-lane architecture-lane ${included ? "is-included" : "is-excluded"}`);
  lane.dataset.profileId = profile.id;
  lane.dataset.bottleneck = included ? result.bottleneck : "excluded";
  lane.dataset.blocked = String(!!result.blockedReason);
  lane.style.setProperty("--profile-color", profile.color);
  const memoryMs = result.stages.find(s => s.resource === "memory")!.ms;
  lane.style.setProperty("--flow-duration", `${(1.1 + Math.log10(1 + memoryMs) * 1.7).toFixed(3)}s`);
  lane.style.setProperty("--step-duration", `${(1.5 + Math.log10(1 + (result.stepMs ?? 0)) * 2).toFixed(3)}s`);
  lane.setAttribute("aria-label", `${profile.name}, ${included ? RESOURCE_LABELS[result.bottleneck] : "excluded"}. ${result.units} memory domains.`);

  const identity = el("div", "lane-identity");
  const select = el("button", "lane-select");
  select.type = "button";
  select.dataset.profileId = profile.id;
  select.setAttribute("aria-pressed", String(included));
  select.setAttribute("aria-label", `${profile.name}, ${profile.vendor}. ${included ? "Included" : "Excluded"}. Toggle this chip in the comparison.`);
  const copy = el("span", "lane-identity-copy");
  copy.append(el("span", "lane-vendor", `${result.architecture.kind.toUpperCase()} · ${profile.vendor}`), el("strong", "", profile.name), el("small", "", profile.architecture));
  select.append(el("span", "lane-select-mark", included ? "✓" : "+"), copy);
  identity.append(select);
  const unitBadge = el("span", "unit-badge", `${f(result.units, 0)} ${result.units === 1 ? "unit" : "units"} · ${input.unitsMode === "auto" ? "auto fit" : "manual"}`);
  identity.append(unitBadge);

  const physical = el("div", "architecture-physical");
  const viewport = el("div", "physical-viewport");
  viewport.tabIndex = 0;
  viewport.setAttribute("aria-label", `${profile.name} schematic; scroll horizontally on small screens`);
  viewport.innerHTML = physicalMap(profile, result, input.hostRamGB);
  const capacity = el("div", "capacity-readout");
  capacity.dataset.resource = "capacity";
  capacity.classList.toggle("is-hot", result.bottleneck === "capacity");
  const occupancy = el("div", "occupancy-track");
  const fill = el("span", "occupancy-fill");
  fill.style.width = `${Math.min(100, (result.capacityFraction ?? 0) * 100)}%`;
  fill.classList.toggle("overflow", (result.capacityFraction ?? 0) > 1);
  occupancy.append(fill);
  const capacityText = result.capacityGB === null ? "Usable capacity unknown" :
    `${f(result.workingSetGB / result.units, 2)} / ${f(result.capacityGB, 1)} GB per unit (${f((result.capacityFraction ?? 0) * 100, 1)}%)`;
  capacity.append(el("strong", "lane-fit", capacityText), occupancy,
    el("small", "", `${f(result.weightsGB, 2)} GB weights + 20% reserve + ${f(result.kvGB, 2)} GB cache/state across the system`));
  physical.append(viewport, el("p", "schematic-scroll-hint", "Scroll to follow the full path →"), capacity,
    el("p", "lane-physics-note", result.cacheLabel));

  const detail = el("div", "lane-detail");
  const verdict = el("div", "lane-verdict");
  verdict.dataset.bottleneck = result.bottleneck;
  verdict.append(el("span", "lane-verdict-label", !included ? "Excluded from comparison" : result.blockedReason ? "Cannot run this configuration" : "Limiting physical resource"),
    el("strong", "", RESOURCE_LABELS[result.bottleneck]));
  const speed = el("strong", "simulation-speed", result.tokensPerSecond === null ? "Blocked / unknown" : `${f(result.tokensPerSecond, 2)} tokens/s`);
  speed.dataset.rate = result.tokensPerSecond === null ? "unknown" : String(result.tokensPerSecond);
  verdict.append(speed, el("small", "", result.stepMs === null ? "No throughput claim for a blocked system" :
    `${milliseconds(result.stepMs)} per ${input.phase === "decode" ? "next-token step" : "prompt"} · ${f(result.aggregateTokensPerSecond!, 1)} aggregate tokens/s`),
    el("small", "math-assumption", `${result.architecture.mathEvidence.startsWith("Vendor") ? "Vendor BF16 ceiling" : "Assumed math ceiling"}: ${f(result.architecture.mathTFLOPS, 2)} TFLOP/s × ${f(input.efficiency * 100, 0)}%. Speeds are modeled, not measured.`));
  const why = el("p", "bottleneck-why", explain(result, input));
  detail.append(verdict, why);
  const sizing = el("dl", "sizing-results");
  sizing.append(el("dt", "", "Memory-fit floor"), el("dd", "minimum-units", result.minimumUnits === null ? "Unknown" : `${f(result.minimumUnits, 0)} ${result.minimumUnits === 1 ? "unit" : "units"}`),
    el("dt", "", `${f(input.targetTokensPerSecond, 1)} tokens/s target`), el("dd", "target-units", result.targetStatus === "unknown" ? "Capacity / bandwidth unknown" : result.targetUnits === null ? "Not reached within 1,024 units" : `${f(result.targetUnits, 0)} ${result.targetUnits === 1 ? "unit" : "units"} (modeled)`));
  detail.append(sizing);

  const times = el("div", "resource-times");
  times.setAttribute("aria-label", "Stage service times; bar scale shared across included architectures");
  for (const stage of result.stages) {
    const row = el("div", "resource-time");
    row.dataset.resource = stage.resource;
    row.classList.toggle("is-hot", included && result.bottleneck === stage.resource);
    const bar = el("span", "resource-bar");
    const inner = el("i", "");
    inner.style.width = `${stage.ms === 0 ? 0 : Math.max(0.5, stage.ms / scale * 100)}%`;
    bar.append(inner);
    row.append(el("span", "", { memory: "RAM → tiles", host: "Host DDR", bus: "PCIe bus", compute: "Tile math", network: "Network" }[stage.resource]),
      bar, el("strong", "", stage.ms === 0 ? "not used" : milliseconds(stage.ms)));
    times.append(row);
  }
  const transport = el("div", "transport-note", `${profile.bandwidthLabel} · ${result.architecture.busLabel}` + (result.loadMs === null ? "" :
    ` · first weight load ${milliseconds(result.loadMs)} (not charged every step unless offloading)`));
  const note = el("p", "lane-physics-note", profile.flowNote);
  const source = el("a", "lane-source", profile.sourceLabel);
  source.href = profile.sourceUrl;
  source.target = "_blank";
  source.rel = "noreferrer";

  const assumptions = el("details", "chip-assumptions");
  assumptions.dataset.chipId = profile.id;
  assumptions.append(el("summary", "", "Chip assumptions & evidence · edit"));
  assumptions.append(el("p", "", `${f(result.architecture.mathTFLOPS, 2)} TFLOP/s × ${f(input.efficiency * 100, 0)}% efficiency. ${result.architecture.mathEvidence}. Memory: ${profile.bandwidthLabel} (${profile.bandwidthEvidence}). Internal cache/fabric timing is aggregated, not independently modeled.`));
  const controls = el("div", "chip-override-controls");
  const rateLabel = el("label", "", "Effective matrix ceiling · TFLOP/s");
  const rate = el("input", "chip-rate");
  rate.type = "number"; rate.min = "0.01"; rate.max = "100000"; rate.step = "any";
  rate.placeholder = String(result.architecture.mathTFLOPS);
  rate.value = override?.mathTFLOPS === undefined ? "" : String(override.mathTFLOPS);
  rateLabel.append(rate);
  const capLabel = el("label", "", "Usable capacity per unit · GB");
  const cap = el("input", "chip-capacity");
  cap.type = "number"; cap.min = "0.001"; cap.max = "100000"; cap.step = "any";
  cap.placeholder = result.capacityGB === null ? "Unknown · enter an assumption" : String(result.capacityGB);
  cap.value = override?.capacityGB === undefined ? "" : String(override.capacityGB);
  capLabel.append(cap);
  const apply = el("button", "", "Apply chip assumptions");
  apply.type = "button"; apply.dataset.applyChip = profile.id;
  controls.append(rateLabel, capLabel, apply);
  assumptions.append(controls, el("p", "", "Blank restores the default. A supplied capacity is a user assumption, not newly sourced evidence. NPU support and multi-host runtimes are not validated. Units mean separate memory domains, not extra cores in one shared pool."),
    el("p", "lane-compute-fact", profile.performanceFact), source);
  lane.append(identity, physical, detail, times, transport, note, assumptions);
  return lane;
}

function explain(result: ArchitectureResult, input: ClusterInput): string {
  if (result.blockedReason) return result.blockedReason;
  const time = result.stages.find(s => s.resource === result.bottleneck)!.ms;
  if (result.bottleneck === "memory") return `${milliseconds(time)} feeding weights/KV through the memory controller. Matrix tiles finish sooner and wait. More memory space alone does not widen this path.`;
  if (result.bottleneck === "compute") return `${milliseconds(time)} in processing tiles. ${input.phase === "prefill" ? "Prompt reuse adds matrix work without rereading all weights per token." : "Effective math throughput cannot keep up with the data feed."}`;
  if (result.bottleneck === "network") return `${milliseconds(time)} synchronizing ${result.units} units. Ring payload and hop latency dominate; adding more chips can make this slower.`;
  if (result.bottleneck === "bus") return `${f(result.spillGB, 2)} GB spills per unit. Active nonresident weights cross PCIe every step; fast HBM cannot remove the host-bus wall.`;
  return `${milliseconds(time)} streaming from host DDR. Offload trades a capacity failure for a slow data path.`;
}
export function milliseconds(value: number): string {
  return value >= 1000 ? `${f(value / 1000, 2)} s` : `${f(value, value < 0.1 ? 4 : 2)} ms`;
}
