import { calculateArchitecture, type ArchitectureResult, type ChipOverride, type ClusterInput } from "../domain/architecture";
import type { ArchitectureProfile } from "../data/profiles";
import { formatNumber as f } from "./roofline";

export function networkBudget(input: ClusterInput, result: ArchitectureResult): { gbps: number | null; maxHopUs: number | null } {
  if (result.units === 1) return { gbps: 0, maxHopUs: null };
  const tokens = input.phase === "decode" ? 1 : input.contextTokens;
  const budgetMs = tokens * 1000 / input.targetTokensPerSecond;
  const localMs = Math.max(...result.stages.filter(s => s.resource !== "network").map(s => s.ms));
  const hops = 4 * input.layers * (result.units - 1);
  const payloadGB = 4 * input.layers * (result.units - 1) / result.units * input.batch * tokens * input.hiddenWidth * 2 / 1e9;
  const availableMs = budgetMs - localMs - hops * input.networkLatencyUs / 1000;
  const payloadMs = input.networkGbps === 0 ? Infinity : payloadGB / (input.networkGbps / 8 * input.efficiency) * 1000;
  return { gbps: availableMs <= 0 ? null : payloadGB * 8000 / (input.efficiency * availableMs),
    maxHopUs: budgetMs - localMs - payloadMs <= 0 ? 0 : (budgetMs - localMs - payloadMs) * 1000 / hops };
}

export function renderPlanning(input: ClusterInput, profiles: readonly ArchitectureProfile[], results: ReadonlyMap<string, ArchitectureResult>, overrides: ReadonlyMap<string, ChipOverride>): void {
  const container = document.getElementById("planning-results")!;
  const summary = document.getElementById("planning-summary")!;
  const open = new Set(Array.from(container.querySelectorAll<HTMLDetailsElement>("details[open]")).map(row => row.dataset.planProfile));
  const candidates = profiles.map(profile => ({ profile, result: results.get(profile.id)! })).sort((a, b) =>
    (a.result.targetUnits ?? Infinity) - (b.result.targetUnits ?? Infinity) ||
    Number(a.result.architecture.kind === "npu" || a.result.architecture.kind === "lpu") - Number(b.result.architecture.kind === "npu" || b.result.architecture.kind === "lpu") ||
    (b.result.tokensPerSecond ?? 0) - (a.result.tokensPerSecond ?? 0));
  const reached = candidates.filter(c => c.result.targetUnits !== null).length;
  summary.textContent = !profiles.length ? "Include a chip path to compare target-rate plans." :
    `${reached} of ${profiles.length} included paths reach the modeled ${f(input.targetTokensPerSecond, 1)} ${input.phase === "prefill" ? "prompt" : "generated"} tokens/s per sequence (${f(input.targetTokensPerSecond * input.batch, 1)} aggregate). Sorted by smallest modeled target count, not cost or validated support.`;
  const fragment = document.createDocumentFragment();
  for (const { profile, result } of candidates) {
    const row = document.createElement("details");
    row.className = "planning-path";
    row.dataset.planProfile = profile.id;
    row.open = open.has(profile.id);
    const heading = document.createElement("summary");
    const title = document.createElement("strong"); title.textContent = profile.name;
    const count = document.createElement("span");
    count.textContent = result.targetUnits === null ? result.targetStatus === "unknown" ? "Target unknown" : "Target not reached" : `${f(result.targetUnits, 0)} ${result.targetUnits === 1 ? "unit" : "units"} for target`;
    heading.append(title, count); row.append(heading);
    const target = result.targetUnits === null ? result : result.units === result.targetUnits ? result :
      calculateArchitecture({ ...input, unitsMode: "manual", units: result.targetUnits }, profile, overrides.get(profile.id));
    const p = document.createElement("p");
    p.textContent = `Memory-fit floor: ${result.minimumUnits === null ? "unknown" : f(result.minimumUnits, 0)} units. ${f(target.workingSetGB / target.units, 2)} GB working set/unit; ${target.capacityGB === null ? "unknown capacity" : f(target.capacityGB, 2) + " GB available"}. ${profile.bandwidthLabel}. ${target.architecture.busLabel}.${target.spillGB > 0 && !target.blockedReason ? ` Host spill ${f(target.spillGB, 2)} GB/unit; active spilled weights pay DDR + PCIe cost each step.` : ""}`;
    row.append(p);
    if (profile.id === "tpu-v6e") {
      const shape = document.createElement("p");
      shape.textContent = "Published v6e slice counts: 1, 4, 8, 16, 32, 64, 128, 256. Round mathematical counts to a supported shape and reevaluate latency; larger slices are not necessarily faster.";
      row.append(shape);
    }
    const network = document.createElement("p");
    if (result.targetUnits !== null) {
      const budget = networkBudget(input, target);
      network.textContent = target.units === 1 ? "No inter-chip network required for this one-unit resource bound." :
        `At this count: at least ${budget.gbps === null ? "unbounded" : f(budget.gbps, budget.gbps < 1 ? 4 : 2)} usable Gbit/s per rank at ${f(input.networkLatencyUs, 2)} µs/hop. With your ${f(input.networkGbps, 0)} Gbit/s setting, hop latency must stay below ${f(budget.maxHopUs ?? 0, 2)} µs. Teaching ring only; tensor-parallel divisibility, MoE all-to-all and vendor topology are not validated.`;
      const button = document.createElement("button"); button.type = "button";
      button.textContent = `Explore ${f(result.targetUnits, 0)} ${result.targetUnits === 1 ? "unit" : "units"}`;
      button.dataset.planUnits = String(result.targetUnits); button.dataset.planChip = profile.id;
      row.append(network, button);
    } else {
      network.textContent = result.targetStatus === "unknown" ? "Capacity or memory bandwidth is unknown; no target-rate claim is possible. Supply a verified measurement or a clearly labeled assumption." : result.minimumUnits !== null && result.minimumUnits > 1024 ? "Memory floor exceeds the 1,024-unit search. Reduce storage/context or increase per-unit usable capacity." :
        input.networkGbps === 0 && (result.minimumUnits ?? 0) > 1 ? "Connect the network to enable sharding; more disconnected chips cannot run this model." :
          "No count from 1 to 1,024 meets this target with current memory, compute, bandwidth and hop latency. Try a lower target, fewer active weights, faster usable fabric/lower latency, or measured chip overrides; adding chips alone may worsen latency.";
      row.append(network);
    }
    if (["npu", "lpu"].includes(result.architecture.kind)) {
      const caveat = document.createElement("p"); caveat.textContent = result.architecture.kind === "npu" ? "NPU execution is illustrative: package memory bandwidth is not dedicated NPU bandwidth, and model/operator support is unverified." : "Published first-generation GroqChip 1 reference only; SRAM programs/workspace and compiler placement may require more chips. Not current GroqCloud capacity or performance.";
      row.append(caveat);
    }
    fragment.append(row);
  }
  container.replaceChildren(fragment);
}
