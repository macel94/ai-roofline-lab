import type { ScenarioInput, ScenarioResult } from "../domain/model";
import type { ArchitectureProfile } from "../data/profiles";
import { bottleneckLabel, fitLabel, formatNumber } from "./roofline";

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

export function renderSiliconMap(
  targets: SiliconMapTargets,
  profiles: readonly ArchitectureProfile[],
  results: ReadonlyMap<string, ScenarioResult>,
  includedProfileIds: ReadonlySet<string>,
  input: ScenarioInput,
): void {
  const reference = results.get(profiles[0]?.id ?? "");
  const weightVolumeGB = reference?.weightFootprintGB ?? 0;
  const matrixWorkGFLOP = reference?.operationsGFLOP ?? 0;
  const intensity = reference?.intensityFLOPPerByte ?? 0;

  targets.weightVolume.textContent = `${formatNumber(weightVolumeGB, 2)} GB`;
  targets.matrixWork.textContent = `${formatNumber(matrixWorkGFLOP, 2)} GFLOP`;
  targets.intensity.textContent = `${formatNumber(intensity, 1)} FLOP/byte`;
  targets.referenceRate.textContent = `${formatNumber(input.computeCeilingTFLOPS, 0)} TFLOP/s`;
  targets.phaseNote.textContent = phaseExplanation(input);

  const includedProfiles = profiles.filter((profile) => includedProfileIds.has(profile.id));
  const includedResults = includedProfiles
    .map((profile) => results.get(profile.id))
    .filter((result): result is ScenarioResult => result !== undefined);
  renderInsight(targets, includedResults, weightVolumeGB, matrixWorkGFLOP, intensity, input);

  const fragment = document.createDocumentFragment();
  for (const profile of profiles) {
    const result = results.get(profile.id);
    if (!result) continue;
    fragment.append(createLane(profile, result, includedProfileIds.has(profile.id), input));
  }
  targets.lanes.replaceChildren(fragment);
}

function renderInsight(
  targets: SiliconMapTargets,
  results: readonly ScenarioResult[],
  weightVolumeGB: number,
  matrixWorkGFLOP: number,
  intensity: number,
  input: ScenarioInput,
): void {
  if (results.length === 0) {
    targets.insightTitle.textContent = "Choose a chip lane to start the comparison";
    targets.insightCopy.textContent =
      "The map keeps every architecture visible. Include one or more chips to calculate how their memory feed compares with the matrix work.";
    return;
  }

  const memoryCount = results.filter((result) => result.bottleneck === "memory").length;
  const computeCount = results.filter((result) => result.bottleneck === "compute").length;
  const balancedCount = results.filter((result) => result.bottleneck === "balanced").length;
  const measurableTimes = results
    .map((result) => result.weightStreamTimeMs)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const minimumStreamTime = measurableTimes.length ? Math.min(...measurableTimes) : null;
  const maximumStreamTime = measurableTimes.length ? Math.max(...measurableTimes) : null;
  const referenceMatrixTime = results[0]?.referenceMatrixTimeMs ?? 0;
  const prefix =
    `This ${input.phase} step moves about ${formatNumber(weightVolumeGB, 2)} GB of weights for ` +
    `${formatNumber(matrixWorkGFLOP, 2)} GFLOP of matrix work (${formatNumber(intensity, 1)} FLOP/byte). `;
  const range =
    minimumStreamTime === null || maximumStreamTime === null
      ? "A complete memory-time range is unavailable. "
      : `At the cited peak/theoretical bandwidths, one ideal weight stream spans ${formatMilliseconds(minimumStreamTime)}–${formatMilliseconds(maximumStreamTime)}. `;
  const math =
    `The shared ${formatNumber(input.computeCeilingTFLOPS, 0)} TFLOP/s teaching rate would do that matrix work in ` +
    `${formatMilliseconds(referenceMatrixTime)}. `;

  if (memoryCount === results.length) {
    targets.insightTitle.textContent = "The memory feed is the wall in this scenario";
    targets.insightCopy.textContent =
      `${results.length} of ${results.length} paths wait on memory data. ` +
      prefix + range + math +
      "The matrix engine finishes its reference work before the next weight stream arrives. Switch to Prefill: the same weights are reused across prompt tokens, so the wait can move to matrix work.";
    return;
  }

  if (computeCount === results.length) {
    targets.insightTitle.textContent = "The matrix work is now the wall";
    targets.insightCopy.textContent =
      `${results.length} of ${results.length} paths reach the shared matrix-work limit first. ` +
      prefix + range + math +
      "Here the memory feed delivers the weights before the reference engine finishes its matrix work. This is the opposite wait from low-reuse Decode.";
    return;
  }

  targets.insightTitle.textContent =
    memoryCount > computeCount
      ? "The same workload hits different walls on different chips"
      : computeCount > memoryCount
        ? "More of these paths are waiting on matrix work"
        : "This workload is split between memory and matrix limits";
  targets.insightCopy.textContent =
    `${memoryCount} paths wait on memory · ${computeCount} wait on matrix work · ${balancedCount} are near balance. ` +
    prefix + range + math +
    "Switch Decode and Prefill: more reuse raises the matrix work per weight read and can move the wait from the data link to the engine.";
}

function createLane(
  profile: ArchitectureProfile,
  result: ScenarioResult,
  included: boolean,
  input: ScenarioInput,
): HTMLElement {
  const lane = document.createElement("article");
  lane.className = `silicon-lane${included ? " is-included" : " is-excluded"}`;
  lane.dataset.profileId = profile.id;
  lane.dataset.bottleneck = included ? result.bottleneck : "excluded";
  lane.dataset.fit = included ? result.fit : "excluded";
  lane.style.setProperty("--profile-color", profile.color);
  lane.style.setProperty("--flow-duration", flowDuration(profile.bandwidthGBs));
  lane.setAttribute("aria-label", laneDescription(profile, result, included));

  const identity = document.createElement("div");
  identity.className = "lane-identity";
  const select = document.createElement("button");
  select.type = "button";
  select.className = "lane-select";
  select.dataset.profileId = profile.id;
  select.setAttribute("aria-pressed", String(included));
  select.setAttribute(
    "aria-label",
    `${profile.name}, ${profile.vendor}. ${included ? "Included" : "Excluded"}. Toggle this chip in the comparison.`,
  );
  const check = document.createElement("span");
  check.className = "lane-select-mark";
  check.setAttribute("aria-hidden", "true");
  check.textContent = included ? "✓" : "+";
  const identityCopy = document.createElement("span");
  identityCopy.className = "lane-identity-copy";
  const vendor = document.createElement("span");
  vendor.className = "lane-vendor";
  vendor.textContent = profile.vendor;
  const name = document.createElement("strong");
  name.textContent = profile.name;
  const architecture = document.createElement("small");
  architecture.textContent = profile.architecture;
  identityCopy.append(vendor, name, architecture);
  select.append(check, identityCopy);
  identity.append(select);

  const memory = document.createElement("div");
  memory.className = "lane-stage lane-memory";
  memory.dataset.stage = "memory";
  const memoryKicker = document.createElement("span");
  memoryKicker.className = "lane-stage-kicker";
  memoryKicker.textContent = `WEIGHT STORE · ${formatNumber(result.weightFootprintGB, 2)} GB`;
  const memoryName = document.createElement("strong");
  memoryName.textContent = profile.memoryNode;
  const memoryInfo = document.createElement("small");
  memoryInfo.textContent = `${profile.memoryType} · ${profile.capacityLabel}`;
  const fit = document.createElement("span");
  fit.className = "lane-fit";
  fit.dataset.fit = included ? result.fit : "excluded";
  fit.textContent = included ? `${fitLabel(result.fit)} · 20% reserve` : "Not in active comparison";
  memory.append(memoryKicker, memoryName, memoryInfo, fit);

  const transfer = document.createElement("div");
  transfer.className = "lane-transfer";
  transfer.dataset.stage = "transfer";
  const transferHead = document.createElement("div");
  transferHead.className = "lane-transfer-head";
  const transferLabel = document.createElement("span");
  transferLabel.textContent = "DATA FEED";
  const transferRate = document.createElement("strong");
  transferRate.textContent = profile.bandwidthLabel;
  transferHead.append(transferLabel, transferRate);
  const track = document.createElement("div");
  track.className = "lane-data-track";
  track.setAttribute("aria-hidden", "true");
  const rail = document.createElement("span");
  rail.className = "lane-data-rail";
  const streamSignal = document.createElement("span");
  streamSignal.className = "lane-stream-signal";
  const arrow = document.createElement("span");
  arrow.className = "lane-data-arrow";
  arrow.textContent = "›";
  track.append(rail, streamSignal, arrow);
  const transferTime = document.createElement("small");
  transferTime.className = "lane-stage-time";
  transferTime.textContent = included
    ? `Stream once: ${formatMaybeMilliseconds(result.weightStreamTimeMs)}`
    : "Include to compare this workload";
  transfer.append(transferHead, track, transferTime);

  const engine = document.createElement("div");
  engine.className = "lane-stage lane-engine";
  engine.dataset.stage = "matrix";
  const engineKicker = document.createElement("span");
  engineKicker.className = "lane-stage-kicker";
  engineKicker.textContent = `MATRIX WORK · ${formatNumber(result.operationsGFLOP, 2)} GFLOP`;
  const engineName = document.createElement("strong");
  engineName.textContent = profile.computeNode;
  const engineInfo = document.createElement("small");
  engineInfo.className = "lane-reference-time";
  engineInfo.textContent = included
    ? `Reference math: ${formatMilliseconds(result.referenceMatrixTimeMs)}`
    : "Include to calculate reference time";
  const computeFactLabel = document.createElement("small");
  computeFactLabel.className = "lane-compute-fact-label";
  computeFactLabel.textContent = `CHIP COMPUTE FACT · ${profile.performanceEvidence.replace("vendor-claim", "claim").toUpperCase()}`;
  const computeFact = document.createElement("small");
  computeFact.className = "lane-compute-fact";
  computeFact.textContent = profile.performanceFact;
  engine.append(engineKicker, engineName, engineInfo, computeFactLabel, computeFact);

  const verdict = document.createElement("div");
  verdict.className = "lane-verdict";
  verdict.dataset.bottleneck = included ? result.bottleneck : "excluded";
  const verdictLabel = document.createElement("span");
  verdictLabel.className = "lane-verdict-label";
  const verdictTitle = document.createElement("strong");
  const verdictCopy = document.createElement("small");
  if (!included) {
    verdictLabel.textContent = "CHIP LANE";
    verdictTitle.textContent = "Excluded";
    verdictCopy.textContent = "Select the chip to add it to the shared workload.";
  } else if (result.bottleneck === "memory") {
    verdictLabel.textContent = "THE WAIT";
    verdictTitle.textContent = "Data feed";
    verdictCopy.textContent = compareTimes(result, "The matrix engine waits for weights.");
  } else if (result.bottleneck === "compute") {
    verdictLabel.textContent = "THE WAIT";
    verdictTitle.textContent = "Matrix work";
    verdictCopy.textContent = compareTimes(result, "Weights arrive before the reference engine finishes.");
  } else if (result.bottleneck === "balanced") {
    verdictLabel.textContent = "THE WAIT";
    verdictTitle.textContent = "Near balance";
    verdictCopy.textContent = compareTimes(result, "Memory feed and matrix work take similar time.");
  } else {
    verdictLabel.textContent = "THE WAIT";
    verdictTitle.textContent = "Unknown";
    verdictCopy.textContent = "A required memory or compute input is unavailable.";
  }
  verdict.append(verdictLabel, verdictTitle, verdictCopy);

  const note = document.createElement("p");
  note.className = "lane-physics-note";
  note.textContent = profile.flowNote;
  const source = document.createElement("a");
  source.className = "lane-source";
  source.href = profile.sourceUrl;
  source.target = "_blank";
  source.rel = "noreferrer";
  source.textContent = profile.sourceLabel;
  source.setAttribute("aria-label", `${profile.sourceLabel}, opens in a new tab`);

  const path = document.createElement("div");
  path.className = "lane-path";
  path.append(memory, transfer, engine);
  const detail = document.createElement("div");
  detail.className = "lane-detail";
  detail.append(verdict, note, source);
  lane.append(identity, path, detail);

  if (input.phase === "prefill") lane.dataset.phase = "prefill";
  return lane;
}

function phaseExplanation(input: ScenarioInput): string {
  const tokens = input.phase === "decode" ? 1 : input.contextTokens;
  const stepKind = input.phase === "decode" ? "one generated token per sequence" : `${formatNumber(tokens, 0)} prompt tokens`;
  const reuse = input.phase === "decode"
    ? "Decode does little work per weight read: the data feed is often the limiter."
    : "Prefill reuses the same weights across many prompt tokens: matrix work grows while weight bytes stay similar.";
  const batchNote = input.batch > 1 ? ` Batch ${formatNumber(input.batch, 0)} reuses weights across sequences in this idealized model.` : "";
  return `${input.phase === "decode" ? "DECODE" : "PREFILL"}: ${stepKind}. ${reuse}${batchNote}`;
}

function compareTimes(result: ScenarioResult, ending: string): string {
  if (result.weightStreamTimeMs === null) return "Memory time unavailable at the cited bandwidth.";
  const memoryMs = result.weightStreamTimeMs;
  const mathMs = result.referenceMatrixTimeMs;
  const ratio = Math.max(memoryMs, mathMs) / Math.max(Number.MIN_VALUE, Math.min(memoryMs, mathMs));
  return `${formatNumber(ratio, 1)}× stage gap. ${ending}`;
}

function laneDescription(profile: ArchitectureProfile, result: ScenarioResult, included: boolean): string {
  if (!included) return `${profile.name} architecture lane, excluded from this workload comparison.`;
  return `${profile.name} data path: ${profile.memoryType} to ${profile.computeNode}. ${bottleneckLabel(result.bottleneck)}. ${fitLabel(result.fit)}.`;
}

function flowDuration(bandwidthGBs: number | null): string {
  if (bandwidthGBs === null || bandwidthGBs <= 0) return "4.6s";
  const progress = Math.max(0, Math.min(1, (Math.log10(bandwidthGBs) - 1.8) / 3.2));
  return `${(4.6 - progress * 3.2).toFixed(2)}s`;
}

function formatMaybeMilliseconds(value: number | null): string {
  return value === null ? "Unknown" : `${formatMilliseconds(value)} ideal*`;
}

function formatMilliseconds(value: number): string {
  const digits = value < 0.001 ? 6 : value < 0.1 ? 4 : value < 10 ? 3 : 1;
  return `${formatNumber(value, digits)} ms`;
}
