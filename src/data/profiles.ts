import type { CalculationProfile, CapacityMode } from "../domain/model";

export type EvidenceKind = "vendor" | "derived" | "vendor-claim" | "unknown";
export type ArchitectureFamily = "apple" | "intel" | "amd" | "nvidia" | "google" | "groq";

export interface ArchitectureProfile extends CalculationProfile {
  readonly vendor: string;
  readonly name: string;
  readonly architecture: string;
  readonly family: ArchitectureFamily;
  readonly badge: string;
  readonly memoryType: string;
  readonly capacityLabel: string;
  readonly bandwidthEvidence: EvidenceKind;
  readonly bandwidthLabel: string;
  readonly performanceFact: string;
  readonly performanceEvidence: EvidenceKind;
  readonly summary: string;
  readonly memoryNode: string;
  readonly computeNode: string;
  readonly flowNote: string;
  readonly sourceUrl: string;
  readonly sourceLabel: string;
  readonly color: string;
  readonly lineDash: string;
  readonly capacityMode: CapacityMode;
}

export const HARDWARE_PROFILES: readonly ArchitectureProfile[] = [
  {
    id: "m4-max",
    vendor: "APPLE SILICON",
    name: "M4 Max",
    architecture: "SoC · memoria unificata",
    family: "apple",
    badge: "UMA",
    bandwidthGBs: 546,
    bandwidthLabel: "fino a 546 GB/s",
    bandwidthEvidence: "vendor",
    memoryType: "Memoria unificata",
    capacityGB: 128,
    capacityLabel: "fino a 128 GB",
    capacityMode: "fixed",
    performanceFact: "AI compute: confronto generazionale, non un picco FP16/BF16 omogeneo.",
    performanceEvidence: "vendor",
    summary:
      "CPU, GPU e Neural Engine condividono lo stesso pool di memoria; il dato dipende dalla configurazione del Mac.",
    memoryNode: "Memoria unificata",
    computeNode: "CPU · GPU · Neural Engine",
    flowNote: "Un pool fisico condiviso riduce le copie esplicite, ma banda e capacità restano contese.",
    sourceUrl: "https://www.apple.com/newsroom/2024/10/apple-introduces-m4-pro-and-m4-max/",
    sourceLabel: "Apple · M4 Pro e M4 Max",
    color: "#ff9b70",
    lineDash: "",
  },
  {
    id: "m5-pro",
    vendor: "APPLE SILICON",
    name: "M5 Pro",
    architecture: "SoC · GPU con Neural Accelerators",
    family: "apple",
    badge: "UMA",
    bandwidthGBs: 307,
    bandwidthLabel: "fino a 307 GB/s",
    bandwidthEvidence: "vendor",
    memoryType: "Memoria unificata",
    capacityGB: 64,
    capacityLabel: "fino a 64 GB",
    capacityMode: "fixed",
    performanceFact: "GPU con Neural Accelerator in ogni core; claim AI relativi alla generazione precedente.",
    performanceEvidence: "vendor",
    summary:
      "Profilo Pro con memoria unificata; capacità e banda massime sono inferiori al profilo M5 Max.",
    memoryNode: "Memoria unificata",
    computeNode: "GPU · Neural Accelerators",
    flowNote: "I blocchi condividono lo spazio di memoria; il grafico non presume un picco compute Apple.",
    sourceUrl:
      "https://www.apple.com/newsroom/2026/03/apple-debuts-m5-pro-and-m5-max-to-supercharge-the-most-demanding-pro-workflows/",
    sourceLabel: "Apple · M5 Pro e M5 Max",
    color: "#ffbd7a",
    lineDash: "7 4",
  },
  {
    id: "m5-max",
    vendor: "APPLE SILICON",
    name: "M5 Max",
    architecture: "SoC · GPU con Neural Accelerators",
    family: "apple",
    badge: "UMA",
    bandwidthGBs: 614,
    bandwidthLabel: "fino a 614 GB/s",
    bandwidthEvidence: "vendor",
    memoryType: "Memoria unificata",
    capacityGB: 128,
    capacityLabel: "fino a 128 GB",
    capacityMode: "fixed",
    performanceFact: "GPU fino a 40 core; il produttore pubblica confronti relativi, non un picco AI unico.",
    performanceEvidence: "vendor",
    summary:
      "Profilo Max con banda unificata elevata; il valore è un massimo pubblicato, non la banda sostenuta di ogni Mac.",
    memoryNode: "Memoria unificata",
    computeNode: "GPU · Neural Accelerators",
    flowNote: "Il percorso condiviso evita una copia esplicita CPU↔GPU; la contesa tra unità non è modellata.",
    sourceUrl:
      "https://www.apple.com/newsroom/2026/03/apple-debuts-m5-pro-and-m5-max-to-supercharge-the-most-demanding-pro-workflows/",
    sourceLabel: "Apple · M5 Pro e M5 Max",
    color: "#ff756b",
    lineDash: "",
  },
  {
    id: "lion-cove",
    vendor: "INTEL · X86",
    name: "Lion Cove",
    architecture: "Core Ultra 9 285K · profilo P/E",
    family: "intel",
    badge: "DDR5",
    bandwidthGBs: 102.4,
    bandwidthLabel: "102,4 GB/s teorici",
    bandwidthEvidence: "derived",
    memoryType: "DDR5 · memoria host",
    capacityGB: null,
    capacityLabel: "RAM host configurabile",
    capacityMode: "host",
    performanceFact: "Il tetto vettoriale dipende dal modello di CPU e non è omogeneo con gli acceleratori.",
    performanceEvidence: "unknown",
    summary:
      "Profilo indicativo di Core Ultra 9 285K; la banda è derivata da due canali DDR5-6400, non misurata.",
    memoryNode: "DDR5 · memoria host",
    computeNode: "P-core · E-core",
    flowNote: "Un profilo CPU general-purpose usa cache e memoria DDR; il numero di banda è un limite teorico di configurazione.",
    sourceUrl:
      "https://www.intel.com/content/www/us/en/products/sku/241061/intel-core-ultra-9-processor-285k-36m-cache-up-to-5-70-ghz/specifications.html",
    sourceLabel: "Intel ARK · Core Ultra 9 285K",
    color: "#63b9e8",
    lineDash: "9 4",
  },
  {
    id: "zen-5",
    vendor: "AMD · X86",
    name: "Zen 5",
    architecture: "Ryzen 9 9950X · 16 core",
    family: "amd",
    badge: "AVX-512",
    bandwidthGBs: 89.6,
    bandwidthLabel: "89,6 GB/s teorici",
    bandwidthEvidence: "derived",
    memoryType: "DDR5 · memoria host",
    capacityGB: null,
    capacityLabel: "RAM host configurabile",
    capacityMode: "host",
    performanceFact: "Supporto AVX-512 dichiarato; il picco dipende da SKU, clock e istruzione.",
    performanceEvidence: "vendor",
    summary:
      "Profilo Ryzen 9 9950X; la banda è derivata da due canali DDR5-5600, non una misura sostenuta.",
    memoryNode: "DDR5 · memoria host",
    computeNode: "Core Zen 5 · AVX-512",
    flowNote: "Il datapath vettoriale allarga il lavoro per ciclo; l’accesso ai pesi continua a dipendere dalla DDR.",
    sourceUrl: "https://www.amd.com/en/products/processors/desktops/ryzen/9000-series/amd-ryzen-9-9950x.html",
    sourceLabel: "AMD · Ryzen 9 9950X",
    color: "#f07878",
    lineDash: "3 4",
  },
  {
    id: "blackwell-b200",
    vendor: "NVIDIA · GPU",
    name: "Blackwell B200",
    architecture: "1 GPU · profilo DGX B200",
    family: "nvidia",
    badge: "HBM3e",
    bandwidthGBs: 8_000,
    bandwidthLabel: "8 TB/s per GPU · derivato",
    bandwidthEvidence: "derived",
    memoryType: "HBM3e",
    capacityGB: 180,
    capacityLabel: "180 GB per GPU · derivato",
    capacityMode: "fixed",
    performanceFact: "FP4 dense: 9 PFLOP/s per GPU, derivato dal totale DGX; non usato nella curva.",
    performanceEvidence: "derived",
    summary:
      "Valori per GPU ottenuti dividendo per otto i totali del sistema NVIDIA DGX B200; banda di picco dichiarata.",
    memoryNode: "HBM3e",
    computeNode: "Tensor Core",
    flowNote: "Tensor Core paralleli e HBM ad alta banda; precisione e sparsità cambiano il picco riportato.",
    sourceUrl: "https://www.nvidia.com/en-us/data-center/dgx-b200/",
    sourceLabel: "NVIDIA · DGX B200",
    color: "#b4dc62",
    lineDash: "",
  },
  {
    id: "tpu-v6e",
    vendor: "GOOGLE · TPU",
    name: "TPU v6e",
    architecture: "Trillium · 1 chip",
    family: "google",
    badge: "SYSTOLIC",
    bandwidthGBs: 1_638,
    bandwidthLabel: "1.638 GB/s HBM",
    bandwidthEvidence: "vendor",
    memoryType: "HBM",
    capacityGB: 32,
    capacityLabel: "32 GB HBM per chip",
    capacityMode: "fixed",
    performanceFact: "918 TFLOP/s BF16 · 1.836 TOPS INT8 per chip; precisioni non intercambiabili.",
    performanceEvidence: "vendor",
    summary:
      "Un TensorCore con MXU 256×256; la banda e il picco riportati sono per chip, non per Pod.",
    memoryNode: "HBM · 32 GB",
    computeNode: "MXU · array sistolico",
    flowNote: "Blocchi di matrice scorrono nell’array; l’ICI e il pod multi-chip sono fuori dal grafico.",
    sourceUrl: "https://docs.cloud.google.com/tpu/docs/v6e",
    sourceLabel: "Google Cloud · TPU v6e",
    color: "#a18bff",
    lineDash: "10 3 2 3",
  },
  {
    id: "groq-lpu",
    vendor: "GROQ · LPU",
    name: "Language Processing Unit",
    architecture: "SRAM · streaming deterministico",
    family: "groq",
    badge: "ON-CHIP SRAM",
    bandwidthGBs: 80_000,
    bandwidthLabel: "≥80 TB/s · claim vendor",
    bandwidthEvidence: "vendor-claim",
    memoryType: "SRAM on-chip",
    capacityGB: null,
    capacityLabel: "capacità non dichiarata nella fonte",
    capacityMode: "unknown",
    performanceFact: "Banda SRAM dichiarata dal produttore; picco di calcolo omogeneo non disponibile.",
    performanceEvidence: "vendor-claim",
    summary:
      "Flusso software-schedulato e SRAM on-chip; la capacità per chip non è disponibile nella fonte consultata.",
    memoryNode: "SRAM on-chip",
    computeNode: "TSP · dataflow",
    flowNote: "Il compilatore pianifica il percorso dei dati; il claim SRAM non equivale a HBM o memoria host.",
    sourceUrl: "https://groq.com/lpu/",
    sourceLabel: "Groq · What is a Language Processing Unit?",
    color: "#7cdec1",
    lineDash: "2 5",
  },
] as const satisfies readonly ArchitectureProfile[];

export function getProfile(id: string): ArchitectureProfile | undefined {
  return HARDWARE_PROFILES.find((profile) => profile.id === id);
}
