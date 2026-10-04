import { expect, test } from "@playwright/test";
import {
  calculateIntensity,
  calculateScenario,
  type ScenarioInput,
} from "../src/domain/model";
import { getProfile } from "../src/data/profiles";

function input(overrides: Partial<ScenarioInput> = {}): ScenarioInput {
  return {
    phase: "decode",
    modelParamsBillion: 7,
    weightBits: 4,
    batch: 1,
    contextTokens: 512,
    computeCeilingTFLOPS: 1_000,
    hostRamGB: 128,
    ...overrides,
  };
}

test.describe("modello didattico Roofline", () => {
  test("calcola pesi, riserva, intensità e limite di memoria in decode", () => {
    const profile = getProfile("m5-max");
    expect(profile).toBeDefined();
    if (!profile) return;

    const result = calculateScenario(input(), profile);
    expect(result.weightFootprintGB).toBe(3.5);
    expect(result.estimatedWorkingSetGB).toBe(4.2);
    expect(result.intensityFLOPPerByte).toBe(4);
    expect(result.memoryCeilingTFLOPS).toBeCloseTo(2.456, 10);
    expect(result.attainableTFLOPS).toBeCloseTo(2.456, 10);
    expect(result.fit).toBe("fits");
    expect(result.bottleneck).toBe("memory");
  });

  test("il riuso ideale dei pesi aumenta l'intensità con il batch", () => {
    const profile = getProfile("m5-max");
    expect(profile).toBeDefined();
    if (!profile) return;

    const result = calculateScenario(input({ batch: 8 }), profile);
    expect(result.operationsGFLOP).toBe(112);
    expect(result.intensityFLOPPerByte).toBe(32);
    expect(calculateIntensity("decode", 8, 512, 4)).toBe(32);
  });

  test("il prefill usa il numero di token del prompt nel riuso ideale", () => {
    const profile = getProfile("tpu-v6e");
    expect(profile).toBeDefined();
    if (!profile) return;

    const result = calculateScenario(input({ phase: "prefill", contextTokens: 512 }), profile);
    expect(result.tokensPerStep).toBe(512);
    expect(result.operationsGFLOP).toBe(7_168);
    expect(result.intensityFLOPPerByte).toBe(2_048);
    expect(result.memoryCeilingTFLOPS).toBeCloseTo(3_354.624, 8);
    expect(result.bottleneck).toBe("compute");
  });

  test("la ridge point è P_peak × 1000 / banda", () => {
    const result = calculateScenario(input(), {
      id: "test-ridge",
      bandwidthGBs: 250_000,
      capacityGB: null,
      capacityMode: "unknown",
    });

    expect(result.ridgeIntensityFLOPPerByte).toBe(4);
    expect(result.memoryCeilingTFLOPS).toBe(1_000);
    expect(result.bottleneck).toBe("balanced");
  });

  test("classifica i due lati della soglia bilanciata ±5%", () => {
    const memoryBound = calculateScenario(input(), {
      id: "below-ridge",
      bandwidthGBs: 237_250,
      capacityGB: null,
      capacityMode: "unknown",
    });
    const balanced = calculateScenario(input(), {
      id: "at-lower-edge",
      bandwidthGBs: 237_500,
      capacityGB: null,
      capacityMode: "unknown",
    });
    const computeBound = calculateScenario(input({ phase: "prefill", contextTokens: 512 }), {
      id: "above-ridge",
      bandwidthGBs: 1_000,
      capacityGB: null,
      capacityMode: "unknown",
    });

    expect(memoryBound.memoryCeilingTFLOPS).toBe(949);
    expect(memoryBound.bottleneck).toBe("memory");
    expect(balanced.memoryCeilingTFLOPS).toBe(950);
    expect(balanced.bottleneck).toBe("balanced");
    expect(computeBound.bottleneck).toBe("compute");
    expect(computeBound.attainableTFLOPS).toBe(1_000);
  });

  test("la capacità host segue la RAM di scenario, non la famiglia CPU", () => {
    const zen5 = getProfile("zen-5");
    expect(zen5).toBeDefined();
    if (!zen5) return;

    const tooSmall = calculateScenario(input({ modelParamsBillion: 70, hostRamGB: 32 }), zen5);
    const enough = calculateScenario(input({ modelParamsBillion: 70, hostRamGB: 64 }), zen5);
    expect(tooSmall.estimatedWorkingSetGB).toBe(42);
    expect(tooSmall.fit).toBe("does-not-fit");
    expect(enough.availableCapacityGB).toBe(64);
    expect(enough.fit).toBe("fits");
  });

  test("un TPU singolo non contiene il working set da 70B INT4 stimato", () => {
    const tpu = getProfile("tpu-v6e");
    expect(tpu).toBeDefined();
    if (!tpu) return;

    const result = calculateScenario(input({ modelParamsBillion: 70 }), tpu);
    expect(result.estimatedWorkingSetGB).toBe(42);
    expect(result.availableCapacityGB).toBe(32);
    expect(result.fit).toBe("does-not-fit");
  });

  test("la capacità Groq non pubblicata resta unknown", () => {
    const groq = getProfile("groq-lpu");
    expect(groq).toBeDefined();
    if (!groq) return;

    const result = calculateScenario(input({ modelParamsBillion: 70 }), groq);
    expect(result.memoryCeilingTFLOPS).toBe(320);
    expect(result.fit).toBe("unknown");
  });

  test("non inventa un Roofline se la banda non è disponibile", () => {
    const result = calculateScenario(input(), {
      id: "unknown-bandwidth",
      bandwidthGBs: null,
      capacityGB: null,
      capacityMode: "unknown",
    });

    expect(result.memoryCeilingTFLOPS).toBeNull();
    expect(result.attainableTFLOPS).toBeNull();
    expect(result.ridgeIntensityFLOPPerByte).toBeNull();
    expect(result.bottleneck).toBe("unknown");
  });

  test("rifiuta input negativi, precisioni non supportate e valori non finiti", () => {
    const profile = getProfile("m5-max");
    expect(profile).toBeDefined();
    if (!profile) return;

    const invalidInputs = [
      { ...input(), modelParamsBillion: -1 },
      { ...input(), modelParamsBillion: Number.NaN },
      { ...input(), weightBits: 0 },
      { ...input(), batch: 0 },
      { ...input(), batch: 1.5 },
      { ...input(), contextTokens: 64 },
      { ...input(), computeCeilingTFLOPS: Number.POSITIVE_INFINITY },
      { ...input(), hostRamGB: 8 },
    ];

    for (const invalid of invalidInputs) {
      expect(() => calculateScenario(invalid as unknown as ScenarioInput, profile)).toThrow(RangeError);
    }
  });
});
