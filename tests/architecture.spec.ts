import { test, expect } from "@playwright/test";
import { calculateArchitecture, estimateShape, validateCluster, type ClusterInput } from "../src/domain/architecture";
import { getProfile, HARDWARE_PROFILES } from "../src/data/profiles";

function input(overrides: Partial<ClusterInput> = {}): ClusterInput {
  return { phase: "decode", modelParamsBillion: 7, weightBits: 4, batch: 1, contextTokens: 512,
    computeCeilingTFLOPS: 1000, hostRamGB: 128, unitsMode: "auto", units: 1,
    networkGbps: 400, networkLatencyUs: 2, offload: false, efficiency: 0.7,
    targetTokensPerSecond: 20, ...estimateShape(7), kvRatio: 0.125, activeFraction: 1, ...overrides };
}
function calc(overrides: Partial<ClusterInput> = {}, id = "blackwell-b200") {
  return calculateArchitecture(input(overrides), getProfile(id)!);
}

test.describe("Physical resource model and sizing", () => {
  test("2T Q4 includes all resident weights, reserve and BF16 KV", () => {
    const r = calc({ modelParamsBillion: 2000, ...estimateShape(2000) });
    expect(r.weightsGB).toBe(1000);
    expect(r.workingSetGB).toBeCloseTo(1200 + r.kvGB, 10);
    expect(r.minimumUnits).toBe(7);
    expect(r.units).toBe(7);
    expect(r.blockedReason).toBeNull();
    expect(r.targetUnits).toBe(7);
    expect(r.tokensPerSecond).toBeGreaterThan(20);
  });
  test("2T BF16 requires more GPUs and model size has an enforced upper bound", () => {
    const r = calc({ modelParamsBillion: 2000, weightBits: 16, ...estimateShape(2000) });
    expect(r.weightsGB).toBe(4000);
    expect(r.minimumUnits).toBe(27);
    expect(() => calc({ modelParamsBillion: 2001 })).toThrow(/2T/);
  });
  test("capacity minimum rounds up at the exact boundary", () => {
    const base = calc();
    const p = { ...getProfile("blackwell-b200")!, capacityGB: base.workingSetGB / 2 };
    expect(calculateArchitecture(input(), p).minimumUnits).toBe(2);
    expect(calculateArchitecture(input(), { ...p, capacityGB: p.capacityGB - 0.001 }).minimumUnits).toBe(3);
  });
  test("manual out-of-memory configurations are blocked, never fast", () => {
    const r = calc({ modelParamsBillion: 2000, unitsMode: "manual", units: 1 });
    expect(r.bottleneck).toBe("capacity");
    expect(r.blockedReason).toContain("Memory capacity exceeded");
    expect(r.tokensPerSecond).toBeNull();
    expect(r.capacityFraction).toBeGreaterThan(1);
  });
  test("context affects decode KV size and memory time", () => {
    const a = calc({ contextTokens: 128 });
    const b = calc({ contextTokens: 8192 });
    expect(b.kvGB / a.kvGB).toBe(64);
    expect(b.stages[0]!.ms).toBeGreaterThan(a.stages[0]!.ms);
  });
  test("batch increases KV, work and aggregate rate, not resident weights", () => {
    const a = calc();
    const b = calc({ batch: 8 });
    expect(b.weightsGB).toBe(a.weightsGB);
    expect(b.kvGB).toBe(a.kvGB * 8);
    expect(b.stages.find(s => s.resource === "compute")!.ms).toBe(a.stages.find(s => s.resource === "compute")!.ms * 8);
    expect(b.aggregateTokensPerSecond).toBe(b.tokensPerSecond! * 8);
  });
  test("MoE active fraction changes work/traffic, not resident memory or units", () => {
    const a = calc({ modelParamsBillion: 2000 });
    const b = calc({ modelParamsBillion: 2000, activeFraction: 0.1 });
    expect(b.workingSetGB).toBe(a.workingSetGB);
    expect(b.minimumUnits).toBe(a.minimumUnits);
    expect(b.stages.find(s => s.resource === "compute")!.ms).toBeCloseTo(a.stages.find(s => s.resource === "compute")!.ms / 10);
    expect(b.stages[0]!.ms).toBeLessThan(a.stages[0]!.ms);
  });
  test("resident GPU weights do not cross PCIe on every token; first load remains visible", () => {
    const r = calc();
    expect(r.stages.find(s => s.resource === "bus")!.ms).toBe(0);
    expect(r.loadMs).toBeCloseTo(3.5 / (64 * 0.7) * 1000);
  });
  test("offload turns a capacity failure into a PCIe wall", () => {
    const r = calc({ modelParamsBillion: 405, unitsMode: "manual", units: 1, offload: true });
    expect(r.spillGB).toBeGreaterThan(0);
    expect(r.blockedReason).toBeNull();
    expect(r.bottleneck).toBe("bus");
    expect(r.stages.find(s => s.resource === "bus")!.ms).toBeGreaterThan(r.stages[0]!.ms);
    const expected = r.spillGB / (64 * 0.7) * 1000;
    expect(r.stages.find(s => s.resource === "bus")!.ms).toBeCloseTo(expected, 10);
  });
  test("host RAM capacity also bounds offload", () => {
    expect(calc({ modelParamsBillion: 405, unitsMode: "manual", units: 1, offload: true, hostRamGB: 16 }).blockedReason).toContain("Host RAM");
  });
  test("weight-only offload cannot hide an oversized local KV/workspace requirement", () => {
    const r = calc({ layers: 512, hiddenWidth: 65536, kvRatio: 1, contextTokens: 8192, batch: 32,
      unitsMode: "manual", units: 1, offload: true });
    expect(r.blockedReason).toContain("KV/workspace must remain in local memory");
    expect(r.tokensPerSecond).toBeNull();
  });
  test("UMA and TPU do not invent a host PCIe offload path", () => {
    for (const id of ["m4-max", "m4-npu", "tpu-v6e"]) {
      const r = calc({ modelParamsBillion: 2000, unitsMode: "manual", units: 1, offload: true }, id);
      expect(r.architecture.busGBs).toBeNull();
      expect(r.blockedReason).toContain("cannot use modeled host offload");
      expect(r.loadMs).toBeNull();
    }
  });
  test("one unit never pays network costs, even disconnected", () => {
    const r = calc({ networkGbps: 0 });
    expect(r.units).toBe(1);
    expect(r.stages.find(s => s.resource === "network")!.ms).toBe(0);
    expect(r.blockedReason).toBeNull();
  });
  test("multiple disconnected units cannot run a sharded model", () => {
    const r = calc({ unitsMode: "manual", units: 2, networkGbps: 0 });
    expect(r.bottleneck).toBe("network");
    expect(r.tokensPerSecond).toBeNull();
    expect(r.blockedReason).toContain("Network disconnected");
  });
  test("network converts Gbit/s to GB/s and includes two ring collectives per layer", () => {
    const r = calc({ unitsMode: "manual", units: 2, networkLatencyUs: 0, efficiency: 1 });
    const expected = 2 * 32 * (2 * 1 / 2 * 1 * 1 * input().hiddenWidth * 2 / 1e9) / (400 / 8) * 1000;
    expect(r.stages.find(s => s.resource === "network")!.ms).toBeCloseTo(expected, 12);
    const slow = calc({ unitsMode: "manual", units: 2, networkLatencyUs: 0, networkGbps: 100, efficiency: 1 });
    expect(slow.stages.find(s => s.resource === "network")!.ms).toBeCloseTo(expected * 4);
  });
  test("hop latency can dominate; more units can be slower", () => {
    const a = calc({ unitsMode: "manual", units: 2, networkLatencyUs: 100 });
    const b = calc({ unitsMode: "manual", units: 16, networkLatencyUs: 100 });
    expect(b.bottleneck).toBe("network");
    expect(b.tokensPerSecond).toBeLessThan(a.tokensPerSecond!);
    expect(b.stages.find(s => s.resource === "network")!.ms).toBeGreaterThan(190);
  });
  test("prefill shifts the default known paths from memory to compute", () => {
    for (const p of HARDWARE_PROFILES.filter(p => p.capacityMode !== "unknown")) {
      const a = calculateArchitecture(input(), p);
      const b = calculateArchitecture(input({ phase: "prefill" }), p);
      expect(a.bottleneck).toBe("memory");
      expect(b.bottleneck).toBe("compute");
      expect(b.tokensPerSecond).toBeCloseTo(512 * 1000 / b.stepMs!);
    }
  });
  test("unknown capacity never becomes a fabricated minimum or recommendation", () => {
    const r = calc({}, "groq-lpu");
    expect(r.minimumUnits).toBeNull();
    expect(r.targetUnits).toBeNull();
    expect(r.targetStatus).toBe("unknown");
    expect(r.tokensPerSecond).toBeNull();
    const custom = calculateArchitecture(input(), getProfile("groq-lpu")!, { capacityGB: 10, mathTFLOPS: 20 });
    expect(custom.minimumUnits).toBe(1);
    expect(custom.tokensPerSecond).not.toBeNull();
    expect(custom.architecture.mathEvidence).toContain("User-supplied");
  });
  test("unknown bandwidth preserves memory sizing but cannot claim a rate or target", () => {
    const r = calculateArchitecture(input(), { ...getProfile("blackwell-b200")!, bandwidthGBs: null });
    expect(r.minimumUnits).toBe(1);
    expect(r.tokensPerSecond).toBeNull();
    expect(r.targetStatus).toBe("unknown");
    expect(r.blockedReason).toContain("bandwidth is unknown");
  });
  test("target search reports bounded failure, not infinite linear scaling", () => {
    const r = calc({ modelParamsBillion: 2000, ...estimateShape(2000), targetTokensPerSecond: 10000 });
    expect(r.targetUnits).toBeNull();
    expect(r.targetStatus).toBe("not-reached");
    const disabled = calc({ modelParamsBillion: 2000, networkGbps: 0 });
    expect(disabled.targetStatus).toBe("not-reached");
  });
  test("impossibly small capacity exceeding 1024 remains blocked", () => {
    const r = calculateArchitecture(input(), getProfile("blackwell-b200")!, { capacityGB: 0.001 });
    expect(r.minimumUnits).toBeGreaterThan(1024);
    expect(r.units).toBe(1024);
    expect(r.tokensPerSecond).toBeNull();
    expect(r.targetStatus).toBe("not-reached");
  });
  test("host CPU sizing and NPU use independent memory domains, not additional cores", () => {
    expect(calc({ modelParamsBillion: 2000, hostRamGB: 16 }, "zen-5").minimumUnits).toBeGreaterThan(70);
    const npu = calc({}, "m4-npu");
    expect(npu.capacityGB).toBe(128);
    expect(npu.architecture.sharedMemory).toBe(true);
    expect(npu.architecture.mathEvidence).toContain("NOT");
  });
  test("rejects invalid/nonfinite resource inputs and invalid overrides", () => {
    const invalid: Partial<ClusterInput>[] = [ { units: 0 }, { units: 1025 }, { units: 1.2 },
      { layers: 0 }, { layers: NaN }, { hiddenWidth: 10 }, { kvRatio: 0 }, { activeFraction: 0 },
      { efficiency: 0 }, { efficiency: Infinity }, { networkGbps: -1 }, { networkLatencyUs: -1 },
      { targetTokensPerSecond: 0 }, { modelParamsBillion: 2001 } ];
    for (const override of invalid) {
      expect(validateCluster(input(override))).not.toBeNull();
      expect(() => calc(override)).toThrow(RangeError);
    }
    expect(() => calculateArchitecture(input(), getProfile("blackwell-b200")!, { mathTFLOPS: NaN })).toThrow(RangeError);
    expect(() => calculateArchitecture(input(), getProfile("blackwell-b200")!, { capacityGB: 0 })).toThrow(RangeError);
    expect(() => calculateArchitecture(input(), { ...getProfile("blackwell-b200")!, bandwidthGBs: 0 })).toThrow(RangeError);
  });
});
