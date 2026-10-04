import {
  calculateScenario,
  type ScenarioResult,
  type WorkloadPhase,
} from "./domain/model";
import { getProfile, HARDWARE_PROFILES, type ArchitectureProfile } from "./data/profiles";
import { DataFlowAnimator, type MotionStatus } from "./visuals/data-flow";
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
  flowProfileId: string | null;
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
  flowProfileId: null,
};

const profileGrid = getElement<HTMLDivElement>("profile-grid");
const scenarioForm = getElement<HTMLFormElement>("scenario-form");
const modelSizeInput = getElement<HTMLInputElement>("model-size");
const weightBitsInput = getElement<HTMLSelectElement>("weight-bits");
const batchInput = getElement<HTMLInputElement>("batch-size");
const contextInput = getElement<HTMLInputElement>("context-size");
const computeInput = getElement<HTMLInputElement>("compute-ceiling");
const hostRamInput = getElement<HTMLInputElement>("host-ram");
const flowProfileSelect = getElement<HTMLSelectElement>("flow-profile-select");
const chartContainer = getElement<HTMLDivElement>("roofline-chart");
const chartLegend = getElement<HTMLDivElement>("chart-legend");
const resultsTableBody = getElement<HTMLTableSectionElement>("results-table-body");
const motionToggle = getElement<HTMLButtonElement>("motion-toggle");
const motionToggleLabel = getElement<HTMLSpanElement>("motion-toggle-label");
const motionIcon = motionToggle.querySelector<HTMLSpanElement>(".motion-icon");
const chartSummary = getElement<HTMLParagraphElement>("chart-summary");

if (!motionIcon) throw new Error("Motion control icon not found.");

const animator = new DataFlowAnimator(getElement<HTMLCanvasElement>("flow-canvas"), updateMotionControl);

renderProfileCards();
renderFlowOptions();
updateAnimatorScenario();
render();

scenarioForm.addEventListener("submit", (event) => event.preventDefault());
scenarioForm.addEventListener("input", updateFromControls);
scenarioForm.addEventListener("change", updateFromControls);
profileGrid.addEventListener("click", toggleProfile);
getElement<HTMLButtonElement>("select-all-profiles").addEventListener("click", selectAllProfiles);
getElement<HTMLButtonElement>("clear-profiles").addEventListener("click", clearProfiles);
getElement<HTMLButtonElement>("empty-select-all").addEventListener("click", selectAllProfiles);
getElement<HTMLButtonElement>("reset-scenario").addEventListener("click", resetScenario);
flowProfileSelect.addEventListener("change", updateFlowFocus);
motionToggle.addEventListener("click", animator.toggle);

function readInputs(): void {
  const selectedPhase = document.querySelector<HTMLInputElement>('input[name="phase"]:checked');
  const rawBits = Number(weightBitsInput.value);
  if (!selectedPhase || ![4, 8, 16].includes(rawBits)) return;

  state.phase = selectedPhase.value as WorkloadPhase;
  state.modelParamsBillion = Number(modelSizeInput.value);
  state.weightBits = rawBits as 4 | 8 | 16;
  state.batch = Number(batchInput.value);
  state.contextTokens = Number(contextInput.value);
  state.computeCeilingTFLOPS = Number(computeInput.value);
  state.hostRamGB = Number(hostRamInput.value);
}

function updateFromControls(): void {
  readInputs();
  updateAnimatorScenario();
  render();
}

function toggleProfile(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>("button[data-profile-id]");
  const profileId = button?.dataset.profileId;
  const profile = profileId ? getProfile(profileId) : undefined;
  if (!profileId || !profile) return;

  const wasIncluded = state.selectedProfileIds.has(profileId);
  if (wasIncluded) {
    state.selectedProfileIds.delete(profileId);
    if (state.flowProfileId === profileId) state.flowProfileId = null;
  } else {
    state.selectedProfileIds.add(profileId);
  }

  updateAnimatorScenario();
  render();
  getElement<HTMLParagraphElement>("selection-status").textContent =
    `${profile.name} ${wasIncluded ? "removed from" : "added to"} the comparison. ` +
    `${state.selectedProfileIds.size} of ${HARDWARE_PROFILES.length} profiles included.`;
}

function selectAllProfiles(): void {
  state.selectedProfileIds = new Set(HARDWARE_PROFILES.map((profile) => profile.id));
  updateAnimatorScenario();
  render();
  getElement<HTMLParagraphElement>("selection-status").textContent =
    "All eight profiles are included in this comparison.";
}

function clearProfiles(): void {
  state.selectedProfileIds.clear();
  state.flowProfileId = null;
  updateAnimatorScenario();
  render();
  getElement<HTMLParagraphElement>("selection-status").textContent =
    "Comparison cleared. Select one or more profiles to continue.";
}

function resetScenario(): void {
  scenarioForm.reset();
  state.phase = "decode";
  state.modelParamsBillion = 7;
  state.weightBits = 4;
  state.batch = 1;
  state.contextTokens = 512;
  state.computeCeilingTFLOPS = 1_000;
  state.hostRamGB = 128;
  state.selectedProfileIds = new Set(HARDWARE_PROFILES.map((profile) => profile.id));
  state.flowProfileId = null;
  updateAnimatorScenario();
  render();
  getElement<HTMLParagraphElement>("selection-status").textContent =
    "Scenario reset. All eight profiles are included.";
}

function updateFlowFocus(): void {
  state.flowProfileId = flowProfileSelect.value || null;
  updateAnimatorScenario();
  render();
}

function render(): void {
  const selectedProfiles = HARDWARE_PROFILES.filter((profile) => state.selectedProfileIds.has(profile.id));
  const results = new Map(
    selectedProfiles.map((profile) => [profile.id, calculateScenario(state, profile)] as const),
  );
  const tokensPerStep = state.phase === "decode" ? 1 : state.contextTokens;
  const arithmeticIntensity = (16 * state.batch * tokensPerStep) / state.weightBits;

  renderProfileSelection();
  renderFlowOptions();
  renderControls(selectedProfiles.some((profile) => profile.capacityMode === "host"));
  renderComparison(selectedProfiles, results);
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
    state.flowProfileId,
    state,
  );
  renderFlowProfile();
  chartSummary.textContent = selectedProfiles.length
    ? `${selectedProfiles.length} profiles share this ${state.phase} workload at ${formatNumber(arithmeticIntensity, 1)} FLOP/byte. The compute ceiling is normalized across profiles.`
    : "No profiles selected. Use Select all to restore the Roofline comparison.";
}

function renderProfileCards(): void {
  const fragment = document.createDocumentFragment();
  for (const profile of HARDWARE_PROFILES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "profile-card";
    button.dataset.profileId = profile.id;
    button.style.setProperty("--profile-color", profile.color);

    const indicator = document.createElement("span");
    indicator.className = "profile-check";
    indicator.setAttribute("aria-hidden", "true");
    indicator.textContent = "✓";

    const copy = document.createElement("span");
    copy.className = "profile-card-copy";
    const vendor = document.createElement("span");
    vendor.className = "profile-vendor";
    vendor.textContent = profile.vendor;
    const name = document.createElement("span");
    name.className = "profile-name";
    name.textContent = profile.name;
    const architecture = document.createElement("span");
    architecture.className = "profile-arch";
    architecture.textContent = profile.architecture;
    const bandwidth = document.createElement("span");
    bandwidth.className = "profile-bandwidth";
    bandwidth.textContent = profile.bandwidthLabel;

    copy.append(vendor, name, architecture, bandwidth);
    button.append(indicator, copy);
    fragment.append(button);
  }
  profileGrid.replaceChildren(fragment);
}

function renderProfileSelection(): void {
  for (const button of profileGrid.querySelectorAll<HTMLButtonElement>("button[data-profile-id]")) {
    const profileId = button.dataset.profileId;
    const profile = profileId ? getProfile(profileId) : undefined;
    if (!profileId || !profile) continue;

    const included = state.selectedProfileIds.has(profileId);
    button.setAttribute("aria-pressed", String(included));
    button.setAttribute(
      "aria-label",
      `${profile.name}, ${profile.vendor}. ${included ? "Included" : "Not included"}. ${profile.bandwidthLabel}. Toggle comparison inclusion.`,
    );
  }
}

function renderFlowOptions(): void {
  const currentValue = state.flowProfileId ?? "";
  const fragment = document.createDocumentFragment();
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "No focus · equal comparison";
  fragment.append(empty);

  for (const profile of HARDWARE_PROFILES) {
    if (!state.selectedProfileIds.has(profile.id)) continue;
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = `${profile.name} · ${profile.vendor}`;
    fragment.append(option);
  }

  flowProfileSelect.replaceChildren(fragment);
  flowProfileSelect.value = currentValue;
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
  const estimatedWorkingSetGB = weightFootprintGB * 1.2;
  modelOutput.value = `${formatNumber(state.modelParamsBillion, 0)} B`;
  workingSetOutput.value = `${formatNumber(estimatedWorkingSetGB, 1)} GB`;
  batchOutput.value = formatNumber(state.batch, 0);
  contextOutput.value = formatNumber(state.contextTokens, 0);
  computeOutput.value = `${formatNumber(state.computeCeilingTFLOPS, 0)} TFLOP/s`;
  hostRamOutput.value = `${formatNumber(state.hostRamGB, 0)} GB`;

  contextInput.disabled = state.phase === "decode";
  contextControl.classList.toggle("is-disabled", state.phase === "decode");
  contextHelp.textContent =
    state.phase === "decode"
      ? "Decode models one token per sequence; prompt length is excluded from this simplified phase."
      : "In prefill, prompt tokens increase idealized weight reuse.";
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
    ? "Every included profile is calculated from the same workload inputs."
    : "Select one or more profiles to calculate a comparison.";
  comparisonEmpty.hidden = count !== 0;
  resultsTable.hidden = count === 0;

  const bottleneckParts = [
    memoryCount ? `${memoryCount} memory-bound` : "",
    computeCount ? `${computeCount} compute-bound` : "",
    balancedCount ? `${balancedCount} balanced` : "",
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
      ? "All eight profiles are included in this comparison."
      : count === 0
        ? "No profiles are included. Select all to restore the comparison."
        : `${count} of ${HARDWARE_PROFILES.length} profiles included. Every included profile uses the same inputs.`;
}

function renderFlowProfile(): void {
  const profile = state.flowProfileId ? getProfile(state.flowProfileId) : undefined;
  const vendor = getElement<HTMLElement>("flow-vendor");
  const memory = getElement<HTMLElement>("flow-memory");
  const memoryType = getElement<HTMLElement>("flow-memory-type");
  const compute = getElement<HTMLElement>("flow-compute");
  const computeType = getElement<HTMLElement>("flow-compute-type");
  const note = getElement<HTMLParagraphElement>("flow-note");
  const source = getElement<HTMLAnchorElement>("active-source");

  if (!profile) {
    vendor.textContent = "NO PROFILE FOCUSED";
    memory.textContent = "Select a profile to inspect its data path";
    memoryType.textContent = "The multi-chip comparison stays visible";
    compute.textContent = "Choose an optional focus";
    computeType.textContent = "No comparison curves are removed";
    note.textContent = "Use the selector. Focus never replaces the comparison.";
    source.href = "https://www2.eecs.berkeley.edu/Pubs/TechRpts/2008/Archive/EECS-2008-134.pdf";
    getElement<HTMLElement>("active-source-label").textContent = "Roofline model source";
    getElement<HTMLDivElement>("flow-board").setAttribute("aria-label", "No data path focused");
    getElement<HTMLDivElement>("flow-board").style.setProperty("--profile-color", "#6be5f0");
    return;
  }

  vendor.textContent = profile.vendor;
  memory.textContent = profile.memoryNode;
  memoryType.textContent = profile.memoryType;
  compute.textContent = profile.computeNode;
  computeType.textContent = profile.architecture;
  note.textContent = profile.flowNote;
  source.href = profile.sourceUrl;
  getElement<HTMLElement>("active-source-label").textContent = `Source: ${profile.sourceLabel}`;
  getElement<HTMLDivElement>("flow-board").setAttribute("aria-label", `Data path for ${profile.name}`);
  getElement<HTMLDivElement>("flow-board").style.setProperty("--profile-color", profile.color);
}

function updateAnimatorScenario(): void {
  const profile = state.flowProfileId ? getProfile(state.flowProfileId) : undefined;
  const tokensPerStep = state.phase === "decode" ? 1 : state.contextTokens;
  const intensity = (16 * state.batch * tokensPerStep) / state.weightBits;
  animator.setScenario(intensity, profile?.color ?? "#6be5f0");
}

function updateMotionControl(status: MotionStatus): void {
  motionToggle.setAttribute("aria-pressed", String(status.playing));
  motionToggleLabel.textContent = status.reducedMotion
    ? "Reduced motion active"
    : status.playing
      ? "Pause animation"
      : "Resume animation";
  if (motionIcon) motionIcon.textContent = status.playing ? "Ⅱ" : "▶";
}
