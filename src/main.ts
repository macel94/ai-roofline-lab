import {
  calculateScenario,
  type ScenarioResult,
  type WorkloadPhase,
} from "./domain/model";
import { HARDWARE_PROFILES, type ArchitectureProfile } from "./data/profiles";
import { calculateArchitecture, estimateShape, validateCluster, type ChipOverride } from "./domain/architecture";
import { renderSiliconMap, type SiliconMapTargets } from "./visuals/silicon-map";
import { formatNumber, renderRoofline } from "./visuals/roofline";

interface AppState {
  phase: WorkloadPhase;
  modelParamsBillion: number;
  weightBits: 4 | 8 | 16;
  batch: number;
  contextTokens: number;
  computeCeilingTFLOPS: number;
  hostRamGB: number;
  selectedProfileIds: Set<string>;
  unitsMode: "auto" | "manual";
  units: number;
  networkGbps: number;
  networkLatencyUs: number;
  offload: boolean;
  efficiency: number;
  targetTokensPerSecond: number;
  layers: number;
  hiddenWidth: number;
  kvRatio: number;
  activeFraction: number;
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Required element not found: #${id}`);
  return element as T;
}

const state: AppState = {
  phase: "decode",
  modelParamsBillion: 7,
  weightBits: 4,
  batch: 1,
  contextTokens: 512,
  computeCeilingTFLOPS: 1_000,
  hostRamGB: 128,
  selectedProfileIds: new Set(HARDWARE_PROFILES.map((profile) => profile.id)),
  unitsMode: "auto", units: 1, networkGbps: 400, networkLatencyUs: 2,
  offload: false, efficiency: 0.7, targetTokensPerSecond: 20,
  ...estimateShape(7), kvRatio: 0.125, activeFraction: 1,
};
const chipOverrides = new Map<string, ChipOverride>();
let lastScenarioSignature = "";

const siliconWorkbench = getElement<HTMLElement>("silicon-workbench");
const siliconLanes = getElement<HTMLDivElement>("silicon-lanes");
const phaseControl = getElement<HTMLFieldSetElement>("phase-control");
const scenarioForm = getElement<HTMLFormElement>("scenario-form");
const modelSizeInput = getElement<HTMLInputElement>("model-size");
const exactModelInput = getElement<HTMLInputElement>("model-size-exact");
// Put controls before the long physical diagrams so a 2T scenario is easy to explore.
siliconWorkbench.before(scenarioForm);
const weightBitsInput = getElement<HTMLSelectElement>("weight-bits");
const batchInput = getElement<HTMLInputElement>("batch-size");
const contextInput = getElement<HTMLInputElement>("context-size");
const computeInput = getElement<HTMLInputElement>("compute-ceiling");
const hostRamInput = getElement<HTMLInputElement>("host-ram");
const chartContainer = getElement<HTMLDivElement>("roofline-chart");
const chartLegend = getElement<HTMLDivElement>("chart-legend");
const resultsTableBody = getElement<HTMLTableSectionElement>("results-table-body");
const chartSummary = getElement<HTMLParagraphElement>("chart-summary");
const motionToggle = getElement<HTMLButtonElement>("motion-toggle");
const motionToggleLabel = getElement<HTMLSpanElement>("motion-toggle-label");
const motionIcon = motionToggle.querySelector<HTMLSpanElement>(".motion-icon");

if (!motionIcon) throw new Error("Motion control icon not found.");

const siliconMapTargets: SiliconMapTargets = {
  lanes: siliconLanes,
  weightVolume: getElement<HTMLElement>("map-weight-volume"),
  matrixWork: getElement<HTMLElement>("map-matrix-work"),
  intensity: getElement<HTMLElement>("map-intensity"),
  phaseNote: getElement<HTMLElement>("phase-note"),
  insightTitle: getElement<HTMLElement>("insight-title"),
  insightCopy: getElement<HTMLElement>("insight-copy"),
  referenceRate: getElement<HTMLElement>("reference-rate"),
};

const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
let userPausedMotion = false;
let mapInViewport = false;
let mapObserver: IntersectionObserver | null = null;
const visibleMaps = new Set<Element>();

if ("IntersectionObserver" in window) {
  mapObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visibleMaps.add(entry.target);
        else visibleMaps.delete(entry.target);
        entry.target.closest(".silicon-lane")?.classList.toggle("is-offscreen", !entry.isIntersecting);
      }
      mapInViewport = visibleMaps.size > 0;
      updateMotionControl();
    },
    { rootMargin: "0px" },
  );
} else {
  mapInViewport = true;
}

render();
updateMotionControl();

scenarioForm.addEventListener("submit", (event) => event.preventDefault());
scenarioForm.addEventListener("input", updateFromControls);
scenarioForm.addEventListener("change", updateFromControls);
scenarioForm.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-model-size]") : null;
  if (!button) return;
  modelSizeInput.value = button.dataset.modelSize ?? "7";
  exactModelInput.value = modelSizeInput.value;
  updateFromControls();
});
phaseControl.addEventListener("change", updateFromControls);
siliconLanes.addEventListener("click", toggleProfile);
getElement<HTMLButtonElement>("select-all-profiles").addEventListener("click", selectAllProfiles);
getElement<HTMLButtonElement>("clear-profiles").addEventListener("click", clearProfiles);
getElement<HTMLButtonElement>("empty-select-all").addEventListener("click", selectAllProfiles);
getElement<HTMLButtonElement>("reset-scenario").addEventListener("click", resetScenario);
motionToggle.addEventListener("click", toggleMotion);
document.addEventListener("visibilitychange", updateMotionControl);
motionPreference.addEventListener("change", updateMotionControl);
window.addEventListener("pagehide", () => mapObserver?.disconnect(), { once: true });

function readInputs(): void {
  const selectedPhase = document.querySelector<HTMLInputElement>('input[name="phase"]:checked');
  const rawBits = Number(weightBitsInput.value);
  if (!selectedPhase || ![4, 8, 16].includes(rawBits)) return;

  state.phase = selectedPhase.value as WorkloadPhase;
  state.modelParamsBillion = Number(exactModelInput.value);
  state.weightBits = rawBits as 4 | 8 | 16;
  state.batch = Number(batchInput.value);
  state.contextTokens = Number(contextInput.value);
  state.computeCeilingTFLOPS = Number(computeInput.value);
  state.hostRamGB = Number(hostRamInput.value);
  state.unitsMode = getElement<HTMLSelectElement>("units-mode").value as "auto" | "manual";
  const unitInput = getElement<HTMLInputElement>("unit-count");
  if (state.unitsMode === "auto" && (!unitInput.validity.valid || unitInput.value === "")) unitInput.value = "1";
  state.units = Number(unitInput.value);
  state.networkGbps = Number(getElement<HTMLSelectElement>("network-bandwidth").value);
  state.networkLatencyUs = Number(getElement<HTMLInputElement>("network-latency").value);
  state.offload = getElement<HTMLInputElement>("host-offload").checked;
  state.efficiency = Number(getElement<HTMLInputElement>("efficiency").value) / 100;
  state.targetTokensPerSecond = Number(getElement<HTMLInputElement>("target-rate").value);
  state.kvRatio = Number(getElement<HTMLSelectElement>("kv-ratio").value);
  state.activeFraction = Number(getElement<HTMLInputElement>("active-fraction").value) / 100;
  const autoShape = getElement<HTMLSelectElement>("shape-mode").value === "auto";
  const layers = getElement<HTMLInputElement>("model-layers");
  const hidden = getElement<HTMLInputElement>("hidden-width");
  if (autoShape && state.modelParamsBillion >= 1 && state.modelParamsBillion <= 2000) {
    const shape = estimateShape(state.modelParamsBillion);
    layers.value = String(shape.layers);
    hidden.value = String(shape.hiddenWidth);
  }
  layers.disabled = autoShape;
  hidden.disabled = autoShape;
  state.layers = Number(layers.value);
  state.hiddenWidth = Number(hidden.value);
  getElement<HTMLInputElement>("unit-count").disabled = state.unitsMode === "auto";
}

function updateFromControls(event?: Event): void {
  if (event?.target === modelSizeInput) exactModelInput.value = modelSizeInput.value;
  if (event?.target === exactModelInput && exactModelInput.validity.valid && exactModelInput.value !== "") modelSizeInput.value = exactModelInput.value;
  readInputs();
  // Native change fires on blur after input. Do not replace a pending click target.
  if (JSON.stringify(state) === lastScenarioSignature && getElement<HTMLElement>("scenario-error").hidden) return;
  render();
}

function toggleProfile(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const apply = target.closest<HTMLButtonElement>("button[data-apply-chip]");
  if (apply) {
    const id = apply.dataset.applyChip!;
    const lane = apply.closest<HTMLElement>(".silicon-lane")!;
    const rate = lane.querySelector<HTMLInputElement>(".chip-rate")!;
    const capacity = lane.querySelector<HTMLInputElement>(".chip-capacity")!;
    if (!rate.reportValidity() || !capacity.reportValidity()) return;
    chipOverrides.set(id, {
      ...(rate.value ? { mathTFLOPS: Number(rate.value) } : {}),
      ...(capacity.value ? { capacityGB: Number(capacity.value) } : {}),
    });
    render();
    siliconLanes.querySelector<HTMLButtonElement>(`button[data-apply-chip="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
    return;
  }
  const button = target.closest<HTMLButtonElement>("button[data-profile-id]");
  const profileId = button?.dataset.profileId;
  const profile = profileId ? HARDWARE_PROFILES.find((item) => item.id === profileId) : undefined;
  if (!profileId || !profile) return;

  if (state.selectedProfileIds.has(profileId)) {
    state.selectedProfileIds.delete(profileId);
  } else {
    state.selectedProfileIds.add(profileId);
  }

  render();
  siliconLanes.querySelector<HTMLButtonElement>(`button[data-profile-id="${CSS.escape(profileId)}"]`)?.focus({
    preventScroll: true,
  });
}

function selectAllProfiles(): void {
  state.selectedProfileIds = new Set(HARDWARE_PROFILES.map((profile) => profile.id));
  render();
}

function clearProfiles(): void {
  state.selectedProfileIds.clear();
  render();
}

function resetScenario(): void {
  scenarioForm.reset();
  chipOverrides.clear();
  const decodeRadio = phaseControl.querySelector<HTMLInputElement>('input[name="phase"][value="decode"]');
  if (decodeRadio) decodeRadio.checked = true;

  state.phase = "decode";
  state.modelParamsBillion = 7;
  state.weightBits = 4;
  state.batch = 1;
  state.contextTokens = 512;
  state.computeCeilingTFLOPS = 1_000;
  state.hostRamGB = 128;
  state.selectedProfileIds = new Set(HARDWARE_PROFILES.map((profile) => profile.id));
  render();
}

function render(): void {
  readInputs();
  const validationError = validateCluster(state);
  const errorOutput = getElement<HTMLParagraphElement>("scenario-error");
  errorOutput.hidden = !validationError;
  errorOutput.textContent = validationError ? `${validationError} Last valid visualization retained.` : "";
  if (validationError) return;
  lastScenarioSignature = JSON.stringify(state);
  const architectureResults = new Map(HARDWARE_PROFILES.map(profile =>
    [profile.id, calculateArchitecture(state, profile, chipOverrides.get(profile.id))] as const));
  const allResults = new Map(
    HARDWARE_PROFILES.map((profile) => [profile.id, calculateScenario(state, profile)] as const),
  );
  const selectedProfiles = HARDWARE_PROFILES.filter((profile) => state.selectedProfileIds.has(profile.id));
  const results = new Map(
    selectedProfiles.map((profile) => [profile.id, allResults.get(profile.id)!] as const),
  );
  const firstProfileId = HARDWARE_PROFILES[0]?.id ?? "";
  const arithmeticIntensity = allResults.get(firstProfileId)?.intensityFLOPPerByte ?? 0;

  renderControls(state.offload || selectedProfiles.some((profile) => profile.capacityMode === "host"));
  renderComparison(selectedProfiles, results);
  renderSiliconMap(
    siliconMapTargets,
    HARDWARE_PROFILES,
    allResults,
    state.selectedProfileIds,
    state,
    architectureResults,
    chipOverrides,
    !motionPreference.matches && !userPausedMotion && document.visibilityState === "visible",
  );
  if (mapObserver) {
    mapObserver.disconnect();
    visibleMaps.clear();
    mapInViewport = false;
    for (const viewport of siliconLanes.querySelectorAll(".physical-viewport")) {
      viewport.closest(".silicon-lane")?.classList.add("is-offscreen");
      mapObserver.observe(viewport);
    }
    updateMotionControl();
  }
  getElement<HTMLElement>("intensity-value").textContent = formatNumber(arithmeticIntensity, 1);

  const memoryRoofs = Array.from(results.values())
    .map((result) => result.memoryCeilingTFLOPS)
    .filter((value): value is number => value !== null);
  const roofRange = getElement<HTMLElement>("roof-range-value");
  if (memoryRoofs.length === 0) {
    roofRange.textContent = "Unknown";
  } else {
    const minimum = Math.min(...memoryRoofs);
    const maximum = Math.max(...memoryRoofs);
    roofRange.textContent =
      minimum === maximum
        ? `${formatNumber(minimum, 1)} TFLOP/s`
        : `${formatNumber(minimum, 1)}–${formatNumber(maximum, 1)} TFLOP/s`;
  }

  renderRoofline(
    { chart: chartContainer, legend: chartLegend, tableBody: resultsTableBody },
    selectedProfiles,
    results,
    null,
    state,
  );
  chartSummary.textContent = selectedProfiles.length
    ? `${selectedProfiles.length} chip paths share this ${state.phase} workload at ${formatNumber(arithmeticIntensity, 1)} FLOP/byte. The technical view uses one normalized reference compute ceiling, not chip-specific compute peaks.`
    : "No chip paths included. Use Select all in the shared map to restore the comparison.";
}

function renderControls(hasHostProfile: boolean): void {
  const modelOutput = getElement<HTMLOutputElement>("model-size-value");
  const workingSetOutput = getElement<HTMLOutputElement>("working-set-value");
  const batchOutput = getElement<HTMLOutputElement>("batch-size-value");
  const contextOutput = getElement<HTMLOutputElement>("context-size-value");
  const computeOutput = getElement<HTMLOutputElement>("compute-ceiling-value");
  const hostRamOutput = getElement<HTMLOutputElement>("host-ram-value");
  const contextControl = getElement<HTMLDivElement>("context-control");
  const contextHelp = getElement<HTMLParagraphElement>("context-help");

  const weightFootprintGB = (state.modelParamsBillion * state.weightBits) / 8;
  const kvGB = 2 * state.layers * state.hiddenWidth * state.kvRatio * 2 * state.contextTokens * state.batch / 1e9;
  const estimatedWorkingSetGB = weightFootprintGB * 1.2 + kvGB;
  modelOutput.value = state.modelParamsBillion >= 1000 ? `${formatNumber(state.modelParamsBillion / 1000, 3)} T` : `${formatNumber(state.modelParamsBillion, 0)} B`;
  workingSetOutput.value = `${formatNumber(estimatedWorkingSetGB, 1)} GB`;
  batchOutput.value = formatNumber(state.batch, 0);
  contextOutput.value = formatNumber(state.contextTokens, 0);
  computeOutput.value = `${formatNumber(state.computeCeilingTFLOPS, 0)} TFLOP/s`;
  hostRamOutput.value = `${formatNumber(state.hostRamGB, 0)} GB`;
  for (const preset of scenarioForm.querySelectorAll<HTMLButtonElement>("button[data-model-size]")) {
    preset.setAttribute("aria-pressed", String(Number(preset.dataset.modelSize) === state.modelParamsBillion));
  }

  contextInput.disabled = false;
  contextControl.classList.remove("is-disabled");
  contextHelp.textContent = state.phase === "decode"
    ? "Context increases KV capacity and decode memory traffic. One generated token per step."
    : "Prompt tokens increase matrix reuse and KV storage in the architecture model.";
  hostRamInput.disabled = !hasHostProfile;
}

function renderComparison(
  selectedProfiles: readonly ArchitectureProfile[],
  results: ReadonlyMap<string, ScenarioResult>,
): void {
  const selectedCount = getElement<HTMLElement>("selected-count");
  const selectedCountKpi = getElement<HTMLElement>("selected-count-kpi");
  const bottleneckSummary = getElement<HTMLElement>("bottleneck-summary");
  const fitSummary = getElement<HTMLElement>("fit-summary");
  const comparisonTotal = getElement<HTMLElement>("comparison-total");
  const comparisonCaption = getElement<HTMLParagraphElement>("comparison-caption");
  const comparisonEmpty = getElement<HTMLDivElement>("comparison-empty");
  const resultsTable = getElement<HTMLTableElement>("comparison-table");
  const count = selectedProfiles.length;
  const memoryCount = Array.from(results.values()).filter((result) => result.bottleneck === "memory").length;
  const computeCount = Array.from(results.values()).filter((result) => result.bottleneck === "compute").length;
  const balancedCount = Array.from(results.values()).filter((result) => result.bottleneck === "balanced").length;
  const unknownCount = count - memoryCount - computeCount - balancedCount;
  const unknownFitCount = Array.from(results.values()).filter((result) => result.fit === "unknown").length;
  const notFitCount = Array.from(results.values()).filter((result) => result.fit === "does-not-fit").length;

  selectedCount.textContent = `${count} of ${HARDWARE_PROFILES.length} included`;
  selectedCountKpi.textContent = `${count} / ${HARDWARE_PROFILES.length}`;
  comparisonTotal.textContent = `${count} / ${HARDWARE_PROFILES.length}`;
  comparisonCaption.textContent = count
    ? "Every included chip path receives the same workload. Toggle lanes in the shared map."
    : "Select one or more chip lanes in the shared map to calculate a comparison.";
  comparisonEmpty.hidden = count !== 0;
  resultsTable.hidden = count === 0;

  const bottleneckParts = [
    memoryCount ? `${memoryCount} data-feed limited` : "",
    computeCount ? `${computeCount} matrix-work limited` : "",
    balancedCount ? `${balancedCount} near balance` : "",
    unknownCount ? `${unknownCount} unknown` : "",
  ].filter(Boolean);
  bottleneckSummary.textContent = bottleneckParts.length ? bottleneckParts.join(" · ") : "No profiles";

  const fitParts = [
    notFitCount ? `${notFitCount} do not fit` : "",
    unknownFitCount ? `${unknownFitCount} capacity unknown` : "",
  ].filter(Boolean);
  fitSummary.textContent =
    fitParts.length > 0
      ? fitParts.join(" · ")
      : count > 0
        ? "All included profiles fit (estimate)"
        : "No profiles selected";

  getElement<HTMLParagraphElement>("selection-status").textContent =
    count === HARDWARE_PROFILES.length
      ? `All ${HARDWARE_PROFILES.length} chip lanes are active in this shared workload.`
      : count === 0
        ? "No chip lanes are active. Use Select all to restore the comparison."
        : `${count} of ${HARDWARE_PROFILES.length} chip lanes are active. Each included lane uses the same workload.`;
}

function toggleMotion(): void {
  if (motionPreference.matches) return;
  userPausedMotion = !userPausedMotion;
  updateMotionControl();
}

function updateMotionControl(): void {
  const requestedPlaying = !userPausedMotion && !motionPreference.matches;
  const playing =
    requestedPlaying &&
    document.visibilityState === "visible" &&
    mapInViewport;
  siliconWorkbench.classList.toggle("is-paused", !playing);
  document.body.classList.toggle("motion-paused", !playing);
  // The control reflects the user's preference, not the offscreen scheduler.
  motionToggle.setAttribute("aria-pressed", String(requestedPlaying));
  motionToggle.disabled = motionPreference.matches;
  motionToggleLabel.textContent = motionPreference.matches
    ? "Reduced motion is on"
    : requestedPlaying
      ? "Pause data flow"
      : "Resume data flow";
  if (motionIcon) motionIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="${requestedPlaying ? "M8 5v14M16 5v14" : "M7 4l14 8-14 8Z"}"/></svg>`;
}
