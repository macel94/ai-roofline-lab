import type { ArchitectureProfile } from "../data/profiles";
import type { ArchitectureResult, Resource } from "../domain/architecture";

export const RESOURCE_LABELS: Record<Resource | "unknown", string> = {
  capacity: "RAM space", memory: "Memory controller / bandwidth", host: "Host DDR bandwidth",
  bus: "Host ↔ device bus", compute: "Processing tiles", network: "Network / collectives", unknown: "Required resource unknown",
};

export function physicalMap(profile: ArchitectureProfile, result: ArchitectureResult, hostRamGB: number): string {
  const { kind, sharedMemory } = result.architecture;
  const resourceClass = (resource: Resource) => result.bottleneck === resource ? "hot" : result.blockedReason ? "idle" : "fast";
  const component = (x: number, y: number, w: number, h: number, label: string, sub: string, resource: Resource, body = "", modeled = true) =>
    `<g class="physical-component ${modeled ? resourceClass(resource) : "unmodeled"}" data-resource="${resource}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/><text x="${x + 10}" y="${y + 22}">${label}</text><text class="physical-sub" x="${x + 10}" y="${y + 40}">${sub}</text>${body}${modeled && result.bottleneck === resource && h > 70 ? `<text class="physical-limit" x="${x + 10}" y="${y + h - 10}">▲ ${result.blockedReason ? "BLOCKED" : "LIMIT"}</text>` : ""}</g>`;
  const occupancy = result.capacityFraction;
  const occupied = occupancy === null ? 0 : Math.min(20, Math.ceil(occupancy * 20));
  const bankCells = (x: number, y: number, columns = 4, used = occupied, overflow = occupancy !== null && occupancy > 1) => Array.from({ length: 20 }, (_, i) =>
    `<rect class="memory-cell ${i < used ? "occupied" : "empty"}${overflow ? " overflow" : ""}" x="${x + (i % columns) * 24}" y="${y + Math.floor(i / columns) * 15}" width="19" height="10" rx="2"/>`).join("");
  const memoryCaption = occupancy === null ? "usable capacity unknown" : `${Math.round(occupancy * 100)}% of local capacity`;
  const tiles = (x: number, y: number, cols: number, rows: number, label: string, width: number, height: number, systolic = false) =>
    Array.from({ length: cols * rows }, (_, i) => {
      const xx = x + i % cols * (width + 6), yy = y + Math.floor(i / cols) * (height + 6);
      const inner = systolic ? Array.from({ length: 25 }, (_, j) =>
        `<rect class="systolic-cell" x="${xx + 8 + j % 5 * 16}" y="${yy + 25 + Math.floor(j / 5) * 12}" width="10" height="8" style="animation-delay:-${(j % 5 + Math.floor(j / 5)) * 0.13}s"/>`).join("") :
        `<rect class="tile-cache" x="${xx + 6}" y="${yy + height - 15}" width="${width - 12}" height="8" rx="2"/>`;
      return `<g class="processor-cell" style="animation-delay:-${i * 0.17}s"><rect x="${xx}" y="${yy}" width="${width}" height="${height}" rx="4"/><text x="${xx + 6}" y="${yy + 17}">${label} ${i + 1}</text>${inner}</g>`;
    }).join("");
  const wire = (path: string, resource: Resource, packets = true) => {
    const time = result.stages.find(stage => stage.resource === resource)?.ms ?? 0;
    const duration = 1.1 + Math.log10(1 + time) * 1.7;
    const start = /M([\d.]+) ([\d.]+)/.exec(path);
    const queue = result.bottleneck === resource && start ? Array.from({ length: 4 }, (_, i) =>
      `<circle class="queue-dot" cx="${Number(start[1]) + i * 7}" cy="${Number(start[2]) - 7}" r="2.5"/>`).join("") : "";
    return `<path class="physical-wire ${resourceClass(resource)}" d="${path}" data-resource="${resource}"/>${queue}` +
      (packets && !result.blockedReason && time > 0 ? Array.from({ length: 3 }, (_, i) =>
        `<circle class="packet ${resourceClass(resource)}" r="4" style="offset-path:path('${path}');animation-duration:${duration.toFixed(3)}s;animation-delay:-${(i * duration / 3).toFixed(3)}s"/>`).join("") : "");
  };
  const chip = (x: number, label: string) => `<rect class="chip-outline" x="${x}" y="70" width="${980 - x}" height="207" rx="16"/><text class="chip-caption" x="${x + 14}" y="90">${label}</text>`;
  let shapes = "", wires = "";
  if (kind === "cpu") {
    shapes = component(12, 90, 180, 170, "DDR5 DIMMs", memoryCaption, "capacity", bankCells(33, 145)) + chip(245, "CPU PACKAGE · representative tiles, not exact core counts") +
      component(265, 107, 145, 143, profile.family === "amd" ? "I/O die / DDR" : "DDR controller", "channels → fabric", "memory") +
      component(441, 107, 130, 143, "Shared L3", "timing unmodeled", "memory", "", false) +
      component(602, 107, 350, 143, "Vector / general cores", "private L1/L2 + SIMD", "compute", tiles(617, 156, 3, 2, "Core", 102, 33));
    wires = wire("M192 173 L265 173", "memory") + wire("M410 173 L441 173", "memory") + wire("M571 173 L602 173", "memory");
  } else if (kind === "gpu" && !sharedMemory) {
    shapes = component(12, 105, 113, 151, "Host RAM", `${Math.round(result.spillGB / hostRamGB * 100)}% spill use`, "host", bankCells(23, 155, 3, Math.min(20, Math.ceil(result.spillGB / hostRamGB * 20)), result.spillGB > hostRamGB)) +
      component(148, 120, 92, 108, "PCIe ×16", "host bus", "bus") +
      component(263, 94, 139, 166, "HBM3e stacks", memoryCaption, "capacity", bankCells(280, 149)) + chip(424, "DISCRETE GPU DIE · HBM is local; host RAM is across PCIe") +
      component(440, 106, 119, 148, "HBM ctrl", "8 TB/s peak", "memory") +
      component(581, 106, 86, 148, "L2", "unmodeled", "memory", "", false) +
      component(689, 106, 272, 148, "SM / Tensor Core tiles", "parallel matrix work", "compute", tiles(701, 156, 3, 2, "SM", 77, 34));
    wires = wire("M125 179 L148 179", "host", result.spillGB > 0) + wire("M240 179 L263 179", "bus", result.spillGB > 0) +
      wire("M402 179 L440 179", "memory") + wire("M559 179 L581 179", "memory") + wire("M667 179 L689 179", "memory");
  } else if (kind === "tpu") {
    shapes = component(12, 91, 181, 169, "HBM banks", memoryCaption, "capacity", bankCells(38, 146)) + chip(250, "TPU TensorCore · two MXUs + vector/scalar units") +
      component(269, 106, 145, 148, "HBM ctrl", "1,638 GB/s peak", "memory") +
      component(446, 106, 131, 148, "On-chip buffers", "timing unmodeled", "memory", "", false) +
      component(609, 106, 351, 148, "Systolic MXUs", "256 × 256 arrays · schematic wave", "compute", tiles(624, 154, 2, 1, "MXU", 153, 90, true));
    wires = wire("M193 181 L269 181", "memory") + wire("M414 181 L446 181", "memory") + wire("M577 181 L609 181", "memory");
  } else if (kind === "lpu") {
    shapes = chip(12, "LPU · SRAM and software-scheduled compute are on-chip") +
      component(30, 106, 181, 148, "Distributed SRAM", memoryCaption, "capacity", bankCells(56, 155)) +
      component(245, 106, 170, 148, "SRAM streams", "compiler schedule", "memory") +
      component(449, 106, 126, 148, "Dataflow lanes", "timing unmodeled", "memory", "", false) +
      component(609, 106, 351, 148, "Streaming processing tiles", "weights flow through a pipeline", "compute", tiles(624, 155, 4, 1, "TSP", 75, 79));
    wires = wire("M211 180 L245 180", "memory") + wire("M415 180 L449 180", "memory") + wire("M575 180 L609 180", "memory");
  } else {
    shapes = component(12, 90, 181, 170, "Unified RAM", memoryCaption, "capacity", bankCells(39, 145)) + chip(250, "SHARED SoC · one RAM pool · no CPU ↔ accelerator PCIe copy") +
      component(269, 107, 145, 146, "SoC fabric", "shared controller", "memory") +
      component(447, 107, 131, 146, kind === "npu" ? "Local SRAM" : "GPU cache", "timing unmodeled", "memory", "", false) +
      component(610, 107, 351, 146, kind === "npu" ? "Neural Engine / MAC tiles" : "GPU / Neural Accelerator tiles", kind === "npu" ? "runtime support not guaranteed" : "CPU + NPU share this package", "compute", tiles(624, 155, 4, 2, kind === "npu" ? "MAC" : "GPU", 75, 33));
    shapes += `<g class="inactive-engines"><rect x="610" y="258" width="145" height="15" rx="3"/><text x="618" y="269">CPU · shared pool</text><rect x="765" y="258" width="195" height="15" rx="3"/><text x="773" y="269">${kind === "npu" ? "GPU" : "Neural Engine"} · shared pool</text></g>`;
    wires = wire("M193 181 L269 181", "memory") + wire("M414 181 L447 181", "memory") + wire("M578 181 L610 181", "memory");
  }
  const peers = Array.from({ length: 3 }, (_, i) => `<rect x="${866 + i * 31}" y="32" width="24" height="18" rx="3"/><path class="physical-wire" d="M${890 + i * 31} 41 h7"/>`).join("");
  const network = component(547, 7, 421, 49, result.units > 1 ? `${result.units} UNITS · NETWORK COLLECTIVES` : "NETWORK · no collective for one unit", result.units > 1 ? "ring · payload + hop latency → peers" : "independent memory domains → peers", "network", peers);
  wires += wire("M832 107 L832 56", "network");
  const stall = result.blockedReason ? `<text class="physical-blocked" x="20" y="30">■ ${result.bottleneck === "network" ? "NETWORK DISCONNECTED" : result.bottleneck === "capacity" ? "OUT OF MEMORY" : result.capacityGB === null ? "CAPACITY UNKNOWN" : "BANDWIDTH UNKNOWN"}</text>` :
    `<text class="physical-status" x="20" y="30">${result.bottleneck === "compute" ? "TILES BUSY" : "TILES WAITING"} · ${RESOURCE_LABELS[result.bottleneck].toUpperCase()}</text>`;
  const computeMs = result.stages.find(stage => stage.resource === "compute")!.ms;
  const duty = result.stepMs === null ? 0 : computeMs / result.stepMs * 100;
  const boundary = Math.min(99.99, Math.max(0.01, duty));
  const activity = `<style>@keyframes compute-${profile.id}{0%,${boundary.toFixed(4)}%{opacity:1}${(boundary + 0.001).toFixed(4)}%,100%{opacity:.22}}.physical-map[data-chip="${profile.id}"] .processor-cell{animation-name:compute-${profile.id}}</style>`;
  return `<svg class="physical-map${result.blockedReason ? " is-blocked" : ""}" data-chip="${profile.id}" data-compute-duty="${duty}" viewBox="0 0 1000 290" role="img" aria-labelledby="map-title-${profile.id} map-desc-${profile.id}" data-kind="${kind}">
    <title id="map-title-${profile.id}">${profile.name} physical architecture</title>
    <desc id="map-desc-${profile.id}">Symbolic ${kind.toUpperCase()} architecture. ${RESOURCE_LABELS[result.bottleneck]} is the limiting resource. Memory occupancy ${memoryCaption}. Cache and internal fabric stages aggregate memory bandwidth, not independently measured limits.</desc>
    ${activity}${shapes}${network}${wires}${stall}
  </svg>`;
}
