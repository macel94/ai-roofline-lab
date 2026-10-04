import type { ScenarioInput, ScenarioResult } from "../domain/model";
import type { ArchitectureProfile } from "../data/profiles";

const SVG_NS = "http://www.w3.org/2000/svg";
const VIEW_WIDTH = 840;
const VIEW_HEIGHT = 340;
const PLOT = { left: 74, top: 16, width: 744, height: 272 };
const X_MIN = 1;
const X_MAX = 2_000_000;
const Y_MIN = 0.1;
const Y_MAX = 10_000;
const X_TICKS = [1, 10, 100, 1_000, 10_000, 100_000, 1_000_000] as const;
const Y_TICKS = [0.1, 1, 10, 100, 1_000, 10_000] as const;

export interface RooflineRenderTargets {
  readonly chart: HTMLElement;
  readonly legend: HTMLElement;
  readonly tableBody: HTMLElement;
}

export function renderRoofline(
  targets: RooflineRenderTargets,
  profiles: readonly ArchitectureProfile[],
  results: ReadonlyMap<string, ScenarioResult>,
  activeProfileId: string,
  input: ScenarioInput,
): void {
  targets.chart.replaceChildren(createChart(profiles, results, activeProfileId, input));
  renderLegend(targets.legend, profiles);
  renderResultsTable(targets.tableBody, profiles, results);
}

function createChart(
  profiles: readonly ArchitectureProfile[],
  results: ReadonlyMap<string, ScenarioResult>,
  activeProfileId: string,
  input: ScenarioInput,
): SVGSVGElement {
  const svg = svgElement("svg");
  svg.classList.add("roofline-svg");
  svg.setAttribute("viewBox", `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-labelledby", "roofline-svg-title roofline-svg-description");

  const title = svgElement("title");
  title.id = "roofline-svg-title";
  title.textContent = "Grafico Roofline normalizzato per l’inferenza AI";
  svg.append(title);

  const description = svgElement("desc");
  description.id = "roofline-svg-description";
  description.textContent =
    "Le linee diagonali rappresentano il limite di memoria per ciascun profilo; la linea orizzontale è il tetto compute condiviso scelto nello scenario. Il punto mostra l’intensità aritmetica corrente.";
  svg.append(description);

  drawGrid(svg);
  drawComputeCeiling(svg, input.computeCeilingTFLOPS);

  const orderedProfiles = [
    ...profiles.filter((profile) => profile.id !== activeProfileId),
    ...profiles.filter((profile) => profile.id === activeProfileId),
  ];

  for (const profile of orderedProfiles) {
    const result = results.get(profile.id);
    if (!result || profile.bandwidthGBs === null || result.memoryCeilingTFLOPS === null) {
      continue;
    }

    const isActive = profile.id === activeProfileId;
    const path = svgElement("path");
    path.classList.add("roofline-line");
    if (isActive) path.classList.add("is-active");
    path.setAttribute("d", createRooflinePath(profile.bandwidthGBs, input.computeCeilingTFLOPS));
    path.setAttribute("stroke", profile.color);
    path.setAttribute("opacity", isActive ? "1" : "0.63");
    if (profile.lineDash) path.setAttribute("stroke-dasharray", profile.lineDash);

    const lineTitle = svgElement("title");
    lineTitle.textContent = `${profile.name}: limite di memoria con banda ${profile.bandwidthLabel}.`;
    path.append(lineTitle);
    svg.append(path);

    if (result.ridgeIntensityFLOPPerByte !== null && isActive) {
      drawRidgeGuide(svg, result.ridgeIntensityFLOPPerByte);
    }

    const markerX = xPosition(clamp(result.intensityFLOPPerByte, X_MIN, X_MAX));
    const markerYValue = Math.min(result.memoryCeilingTFLOPS, result.computeCeilingTFLOPS);
    const markerY = yPosition(clamp(markerYValue, Y_MIN, Y_MAX));
    const halo = svgElement("circle");
    halo.classList.add("roofline-marker-halo");
    halo.setAttribute("cx", markerX.toFixed(2));
    halo.setAttribute("cy", markerY.toFixed(2));
    halo.setAttribute("r", isActive ? "7.3" : "4.7");
    halo.setAttribute("stroke", profile.color);
    svg.append(halo);

    const marker = svgElement("circle");
    marker.classList.add("roofline-marker");
    marker.setAttribute("cx", markerX.toFixed(2));
    marker.setAttribute("cy", markerY.toFixed(2));
    marker.setAttribute("r", isActive ? "3.2" : "2.1");
    marker.setAttribute("fill", profile.color);
    svg.append(marker);
  }

  drawAxisTitles(svg);
  return svg;
}

function drawGrid(svg: SVGSVGElement): void {
  for (const tick of X_TICKS) {
    const x = xPosition(tick);
    const line = svgElement("line");
    line.classList.add("chart-grid-line");
    line.setAttribute("x1", x.toFixed(2));
    line.setAttribute("x2", x.toFixed(2));
    line.setAttribute("y1", PLOT.top.toString());
    line.setAttribute("y2", (PLOT.top + PLOT.height).toString());
    svg.append(line);

    const label = svgElement("text");
    label.classList.add("chart-tick-label");
    label.setAttribute("x", x.toFixed(2));
    label.setAttribute("y", (PLOT.top + PLOT.height + 19).toString());
    label.setAttribute("text-anchor", "middle");
    label.textContent = formatAxisValue(tick);
    svg.append(label);
  }

  for (const tick of Y_TICKS) {
    const y = yPosition(tick);
    const line = svgElement("line");
    line.classList.add("chart-grid-line");
    line.setAttribute("x1", PLOT.left.toString());
    line.setAttribute("x2", (PLOT.left + PLOT.width).toString());
    line.setAttribute("y1", y.toFixed(2));
    line.setAttribute("y2", y.toFixed(2));
    svg.append(line);

    const label = svgElement("text");
    label.classList.add("chart-tick-label");
    label.setAttribute("x", (PLOT.left - 11).toString());
    label.setAttribute("y", (y + 3).toFixed(2));
    label.setAttribute("text-anchor", "end");
    label.textContent = formatAxisValue(tick);
    svg.append(label);
  }

  const xAxis = svgElement("line");
  xAxis.classList.add("chart-axis-line");
  xAxis.setAttribute("x1", PLOT.left.toString());
  xAxis.setAttribute("x2", (PLOT.left + PLOT.width).toString());
  xAxis.setAttribute("y1", (PLOT.top + PLOT.height).toString());
  xAxis.setAttribute("y2", (PLOT.top + PLOT.height).toString());
  svg.append(xAxis);

  const yAxis = svgElement("line");
  yAxis.classList.add("chart-axis-line");
  yAxis.setAttribute("x1", PLOT.left.toString());
  yAxis.setAttribute("x2", PLOT.left.toString());
  yAxis.setAttribute("y1", PLOT.top.toString());
  yAxis.setAttribute("y2", (PLOT.top + PLOT.height).toString());
  svg.append(yAxis);
}

function drawComputeCeiling(svg: SVGSVGElement, computeCeilingTFLOPS: number): void {
  const y = yPosition(clamp(computeCeilingTFLOPS, Y_MIN, Y_MAX));
  const line = svgElement("line");
  line.classList.add("compute-ceiling-line");
  line.setAttribute("x1", PLOT.left.toString());
  line.setAttribute("x2", (PLOT.left + PLOT.width).toString());
  line.setAttribute("y1", y.toFixed(2));
  line.setAttribute("y2", y.toFixed(2));
  svg.append(line);

  const label = svgElement("text");
  label.classList.add("compute-ceiling-label");
  label.setAttribute("x", (PLOT.left + PLOT.width - 4).toString());
  label.setAttribute("y", (y - 5).toFixed(2));
  label.setAttribute("text-anchor", "end");
  label.textContent = "tetto compute comune";
  svg.append(label);
}

function drawRidgeGuide(svg: SVGSVGElement, ridgeIntensity: number): void {
  if (ridgeIntensity < X_MIN || ridgeIntensity > X_MAX) return;

  const line = svgElement("line");
  line.classList.add("ridge-guide");
  line.setAttribute("x1", xPosition(ridgeIntensity).toFixed(2));
  line.setAttribute("x2", xPosition(ridgeIntensity).toFixed(2));
  line.setAttribute("y1", PLOT.top.toString());
  line.setAttribute("y2", (PLOT.top + PLOT.height).toString());
  svg.append(line);
}

function drawAxisTitles(svg: SVGSVGElement): void {
  const yTitle = svgElement("text");
  yTitle.classList.add("chart-axis-label");
  yTitle.setAttribute("transform", `translate(17 ${PLOT.top + PLOT.height / 2}) rotate(-90)`);
  yTitle.setAttribute("text-anchor", "middle");
  yTitle.textContent = "Prestazione teorica · TFLOP/s";
  svg.append(yTitle);
}

function createRooflinePath(bandwidthGBs: number, computeCeilingTFLOPS: number): string {
  const points: string[] = [];
  const startLog = Math.log10(X_MIN);
  const endLog = Math.log10(X_MAX);
  const sampleCount = 120;

  for (let index = 0; index <= sampleCount; index += 1) {
    const intensity = 10 ** (startLog + ((endLog - startLog) * index) / sampleCount);
    const performance = Math.min(computeCeilingTFLOPS, (bandwidthGBs * intensity) / 1000);
    const x = xPosition(intensity);
    const y = yPosition(clamp(performance, Y_MIN, Y_MAX));
    points.push(`${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
  }

  return points.join(" ");
}

function renderLegend(container: HTMLElement, profiles: readonly ArchitectureProfile[]): void {
  const fragment = document.createDocumentFragment();
  for (const profile of profiles) {
    const item = document.createElement("span");
    item.className = "legend-item";
    item.style.setProperty("--profile-color", profile.color);

    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.setAttribute("aria-hidden", "true");
    swatch.dataset.derived = String(
      profile.bandwidthEvidence === "derived" || profile.bandwidthEvidence === "vendor-claim",
    );

    const label = document.createElement("span");
    label.textContent = profile.name;
    item.append(swatch, label);
    fragment.append(item);
  }
  container.replaceChildren(fragment);
}

function renderResultsTable(
  container: HTMLElement,
  profiles: readonly ArchitectureProfile[],
  results: ReadonlyMap<string, ScenarioResult>,
): void {
  const fragment = document.createDocumentFragment();
  for (const profile of profiles) {
    const result = results.get(profile.id);
    if (!result) continue;

    const row = document.createElement("tr");
    const name = document.createElement("th");
    name.scope = "row";
    name.textContent = profile.name;

    const bandwidth = document.createElement("td");
    bandwidth.textContent = `${profile.bandwidthLabel} · ${profile.memoryType}`;

    const memoryLimit = document.createElement("td");
    memoryLimit.textContent =
      result.memoryCeilingTFLOPS === null
        ? "n.d."
        : `${formatItalian(result.memoryCeilingTFLOPS, 1)} TFLOP/s`;

    const bound = document.createElement("td");
    bound.textContent = bottleneckLabel(result.bottleneck);

    const fit = document.createElement("td");
    fit.textContent = fitLabel(result.fit);

    row.append(name, bandwidth, memoryLimit, bound, fit);
    fragment.append(row);
  }
  container.replaceChildren(fragment);
}

export function bottleneckLabel(bottleneck: ScenarioResult["bottleneck"]): string {
  switch (bottleneck) {
    case "memory":
      return "memory-bound";
    case "compute":
      return "compute-bound";
    case "balanced":
      return "bilanciato ±5%";
    case "unknown":
      return "dati insufficienti";
  }
}

export function fitLabel(fit: ScenarioResult["fit"]): string {
  switch (fit) {
    case "fits":
      return "entra · stima";
    case "does-not-fit":
      return "non entra · stima";
    case "unknown":
      return "da verificare";
  }
}

export function formatItalian(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
    useGrouping: true,
  }).format(value);
}

function xPosition(value: number): number {
  const progress = (Math.log10(value) - Math.log10(X_MIN)) / (Math.log10(X_MAX) - Math.log10(X_MIN));
  return PLOT.left + progress * PLOT.width;
}

function yPosition(value: number): number {
  const progress = (Math.log10(value) - Math.log10(Y_MIN)) / (Math.log10(Y_MAX) - Math.log10(Y_MIN));
  return PLOT.top + (1 - progress) * PLOT.height;
}

function formatAxisValue(value: number): string {
  if (value === 0.1) return "0,1";
  if (value >= 1_000_000) return "1 M";
  if (value >= 1_000) return `${formatItalian(value / 1_000, 0)}k`;
  return formatItalian(value, 0);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function svgElement<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, name);
}
