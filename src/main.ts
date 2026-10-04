import {
  calculateScenario,
  type ScenarioResult,
  type WorkloadPhase,
} from "./domain/model";
import { getProfile, HARDWARE_PROFILES, type ArchitectureProfile } from "./data/profiles";
import { DataFlowAnimator, type MotionStatus } from "./visuals/data-flow";
import { bottleneckLabel, fitLabel, formatItalian, renderRoofline } from "./visuals/roofline";

interface AppState {
  phase: WorkloadPhase;
  modelParamsBillion: number;
  weightBits: 4 | 8 | 16;
  batch: number;
  contextTokens: number;
  computeCeilingTFLOPS: number;
  hostRamGB: number;
  activeProfileId: string;
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Elemento richiesto non trovato: #${id}`);
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
  activeProfileId: "m5-max",
};

const profileGrid = getElement<HTMLDivElement>("profile-grid");
const scenarioForm = getElement<HTMLFormElement>("scenario-form");
const modelSizeInput = getElement<HTMLInputElement>("model-size");
const weightBitsInput = getElement<HTMLSelectElement>("weight-bits");
const batchInput = getElement<HTMLInputElement>("batch-size");
const contextInput = getElement<HTMLInputElement>("context-size");
const computeInput = getElement<HTMLInputElement>("compute-ceiling");
const hostRamInput = getElement<HTMLInputElement>("host-ram");
const chartContainer = getElement<HTMLDivElement>("roofline-chart");
const chartLegend = getElement<HTMLDivElement>("chart-legend");
const resultsTableBody = getElement<HTMLTableSectionElement>("results-table-body");
const motionToggle = getElement<HTMLButtonElement>("motion-toggle");
const motionToggleLabel = getElement<HTMLSpanElement>("motion-toggle-label");
const motionIcon = motionToggle.querySelector<HTMLSpanElement>(".motion-icon");
const chartSummary = getElement<HTMLParagraphElement>("chart-summary");

if (!motionIcon) throw new Error("Icona di movimento non trovata.");

const animator = new DataFlowAnimator(getElement<HTMLCanvasElement>("flow-canvas"), updateMotionControl);

renderProfileCards();
updateAnimatorScenario();
render();

scenarioForm.addEventListener("submit", (event) => event.preventDefault());
scenarioForm.addEventListener("input", updateFromControls);
scenarioForm.addEventListener("change", updateFromControls);
profileGrid.addEventListener("click", selectProfile);
motionToggle.addEventListener("click", animator.toggle);

function updateFromControls(): void {
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

  updateAnimatorScenario();
  render();
}

function selectProfile(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const card = target.closest<HTMLButtonElement>("button[data-profile-id]");
  const profileId = card?.dataset.profileId;
  if (!profileId || !getProfile(profileId)) return;

  state.activeProfileId = profileId;
  updateAnimatorScenario();
  render();
}

function render(): void {
  const activeProfile = getProfile(state.activeProfileId);
  if (!activeProfile) throw new Error(`Profilo attivo non valido: ${state.activeProfileId}`);

  const results = new Map(
    HARDWARE_PROFILES.map((profile) => [profile.id, calculateScenario(state, profile)] as const),
  );
  const activeResult = results.get(activeProfile.id);
  if (!activeResult) throw new Error(`Risultato non calcolato: ${activeProfile.id}`);

  renderProfileSelection(activeProfile.id);
  renderControls(activeProfile.capacityMode === "host");
  renderMetrics(activeProfile, activeResult);
  renderRoofline(
    { chart: chartContainer, legend: chartLegend, tableBody: resultsTableBody },
    HARDWARE_PROFILES,
    results,
    activeProfile.id,
    state,
  );
  renderFlowProfile(activeProfile);

  const resultCount = Array.from(results.values()).filter((result) => result.bottleneck !== "unknown").length;
  chartSummary.textContent =
    `${activeProfile.name}: ${bottleneckLabel(activeResult.bottleneck)} a ${formatItalian(activeResult.intensityFLOPPerByte, 1)} FLOP/byte. ` +
    `${resultCount} profili hanno una curva con banda disponibile; il tetto compute è normalizzato.`;
}

function renderProfileCards(): void {
  const fragment = document.createDocumentFragment();

  for (const profile of HARDWARE_PROFILES) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "profile-card";
    card.dataset.profileId = profile.id;
    card.style.setProperty("--profile-color", profile.color);
    card.setAttribute("aria-pressed", "false");
    card.setAttribute(
      "aria-label",
      `${profile.vendor}, ${profile.name}. Banda: ${profile.bandwidthLabel}; memoria: ${profile.capacityLabel}. Seleziona il profilo.`,
    );

    const vendor = document.createElement("span");
    vendor.className = "profile-vendor";
    vendor.textContent = profile.vendor;

    const name = document.createElement("span");
    name.className = "profile-name";
    name.textContent = profile.name;

    const architecture = document.createElement("span");
    architecture.className = "profile-arch";
    architecture.textContent = profile.architecture;

    const detail = document.createElement("span");
    detail.className = "profile-card-bottom";

    const bandwidth = document.createElement("span");
    bandwidth.className = "profile-bandwidth";
    bandwidth.textContent = profile.bandwidthLabel;

    const badge = document.createElement("span");
    badge.className = "profile-badge";
    badge.textContent = profile.badge;

    detail.append(bandwidth, badge);
    card.append(vendor, name, architecture, detail);
    fragment.append(card);
  }

  profileGrid.replaceChildren(fragment);
}

function renderProfileSelection(activeProfileId: string): void {
  for (const card of profileGrid.querySelectorAll<HTMLButtonElement>("button[data-profile-id]")) {
    const active = card.dataset.profileId === activeProfileId;
    card.setAttribute("aria-pressed", String(active));
    card.classList.toggle("is-active", active);
  }
}

function renderControls(isHostProfile: boolean): void {
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
  modelOutput.value = `${formatItalian(state.modelParamsBillion, 0)} B`;
  workingSetOutput.value = `${formatItalian(estimatedWorkingSetGB, 1)} GB`;
  batchOutput.value = formatItalian(state.batch, 0);
  contextOutput.value = formatItalian(state.contextTokens, 0);
  computeOutput.value = `${formatItalian(state.computeCeilingTFLOPS, 0)} TFLOP/s`;
  hostRamOutput.value = `${formatItalian(state.hostRamGB, 0)} GB`;

  contextInput.disabled = state.phase === "decode";
  contextControl.classList.toggle("is-disabled", state.phase === "decode");
  contextHelp.textContent =
    state.phase === "decode"
      ? "Decode elabora un token per sequenza; il contesto non entra in questo modello semplificato."
      : "In prefill i token del prompt aumentano il riuso ideale dei pesi.";

  hostRamInput.disabled = !isHostProfile;
}

function renderMetrics(profile: ArchitectureProfile, result: ScenarioResult): void {
  const intensity = getElement<HTMLElement>("intensity-value");
  const memoryCeiling = getElement<HTMLElement>("memory-ceiling-value");
  const bottleneck = getElement<HTMLElement>("bottleneck-value");
  const fit = getElement<HTMLElement>("fit-value");

  intensity.textContent = formatItalian(result.intensityFLOPPerByte, 1);
  memoryCeiling.textContent =
    result.memoryCeilingTFLOPS === null ? "n.d." : formatItalian(result.memoryCeilingTFLOPS, 1);
  bottleneck.textContent = bottleneckLabel(result.bottleneck);
  bottleneck.dataset.bound = result.bottleneck;

  if (result.fit === "unknown") {
    fit.textContent = "Fit: da verificare";
  } else {
    fit.textContent = `Fit (${formatItalian(result.estimatedWorkingSetGB, 1)} / ${formatItalian(result.availableCapacityGB ?? 0, 0)} GB): ${fitLabel(result.fit)}`;
  }

  getElement<HTMLDivElement>("flow-board").setAttribute("aria-label", `Percorso dati del profilo ${profile.name}`);
}

function renderFlowProfile(profile: ArchitectureProfile): void {
  getElement<HTMLElement>("flow-vendor").textContent = profile.vendor;
  getElement<HTMLElement>("flow-memory").textContent = profile.memoryNode;
  getElement<HTMLElement>("flow-memory-type").textContent = profile.memoryType;
  getElement<HTMLElement>("flow-compute").textContent = profile.computeNode;
  getElement<HTMLElement>("flow-compute-type").textContent = profile.architecture;
  getElement<HTMLParagraphElement>("flow-note").textContent = profile.flowNote;

  const source = getElement<HTMLAnchorElement>("active-source");
  source.href = profile.sourceUrl;
  getElement<HTMLElement>("active-source-label").textContent = `Fonte: ${profile.sourceLabel}`;
  getElement<HTMLDivElement>("flow-board").style.setProperty("--profile-color", profile.color);
}

function updateMotionControl(status: MotionStatus): void {
  motionToggle.setAttribute("aria-pressed", String(status.playing));
  motionToggleLabel.textContent = status.reducedMotion
    ? "Movimento ridotto attivo"
    : status.playing
      ? "Metti in pausa"
      : "Riprendi animazione";
  if (motionIcon) motionIcon.textContent = status.playing ? "Ⅱ" : "▶";
}

function updateAnimatorScenario(): void {
  const profile = getProfile(state.activeProfileId);
  if (!profile) return;

  const tokensPerStep = state.phase === "decode" ? 1 : state.contextTokens;
  const intensity = (16 * state.batch * tokensPerStep) / state.weightBits;
  animator.setScenario(intensity, profile.color);
}
