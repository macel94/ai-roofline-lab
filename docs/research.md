# Ricerca, fonti e verifiche

**Data consultazione:** 4 ottobre 2026.

Le specifiche vendor sono claim del produttore; la loro citazione non le trasforma in misure indipendenti. Le pagine possono cambiare nel tempo. I valori usati dal simulatore sono qualificati in `technical-design.md`.

## 1. Roofline

- **Samuel Williams, Andrew Waterman, David Patterson — “Roofline: An Insightful Visual Performance Model for Multicore Architectures”** (UC Berkeley EECS-2008-134; CACM 2009). [PDF Berkeley](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2008/Archive/EECS-2008-134.pdf) · [ACM](https://dl.acm.org/doi/10.1145/1498765.1498785)
- Il paper definisce operational intensity come operazioni/byte trasferiti alla memoria principale dopo il filtraggio della cache e il limite come `min(peak compute, peak bandwidth × operational intensity)`. La demo semplifica la gerarchia e assume il livello indicato nella scheda profilo.

## 2. Fonti hardware primarie

### Apple Silicon

- [Apple — M4 Pro e M4 Max](https://www.apple.com/newsroom/2024/10/apple-introduces-m4-pro-and-m4-max/): M4 Max fino a 128 GB di memoria unificata e 546 GB/s; M4 Pro 64 GB/273 GB/s. Include il ruolo di unified memory e Neural Engine/ML accelerator.
- [Apple — M5 Pro e M5 Max](https://www.apple.com/newsroom/2026/03/apple-debuts-m5-pro-and-m5-max-to-supercharge-the-most-demanding-pro-workflows/): M5 Pro fino a 64 GB e 307 GB/s; M5 Max fino a 128 GB e 614 GB/s; Neural Accelerator in ogni GPU core. I claim AI sono confronti generazionali, non un picco assoluto FP16/BF16.
- [Apple — Mac Studio M5 Max e M5 Ultra](https://www.apple.com/newsroom/2026/08/apple-introduces-new-mac-studio-with-m5-max-and-m5-ultra/): conferma 614 GB/s per M5 Max; M5 Ultra è una configurazione diversa e non viene confusa con il Max.

**Decisione:** mostrare M4 Max, M5 Pro e M5 Max separatamente, indicando “fino a” per capacità. Non usare una generica banda Apple Silicon per tutti i SoC.

### Intel x86

- [Intel ARK — Core Ultra 9 285K, specifiche](https://www.intel.com/content/www/us/en/products/sku/241061/intel-core-ultra-9-processor-285k-36m-cache-up-to-5-70-ghz/specifications.html)
- [Intel — Core Ultra desktop Series 2 press kit](https://www.intel.com/content/www/us/en/newsroom/resources/press-kit-core-ultra-desktop-processors-series-2.html)

La pagina Intel ha rifiutato richieste automatizzate nella sessione di ricerca. Il profilo resta quindi rappresentativo e marcato **derivato**: 2 canali × 6.400 MT/s × 8 byte = 102,4 GB/s teorici. Non è un dato misurato e non si attribuisce a tutta la famiglia Lion Cove. Non si includono ROB, latenza cache o conteggi di porte citati nel testo iniziale senza una fonte primaria specifica.

### AMD x86

- [AMD — Ryzen 9 9950X](https://www.amd.com/en/products/processors/desktops/ryzen/9000-series/amd-ryzen-9-9950x.html): Zen 5, 16 core, supporto DDR5 e AVX-512, velocità di memoria massima 5.600 MT/s in configurazione a due DIMM/canali indicata dalla pagina; capacità dipendente dalla piattaforma.
- [AMD — lancio Zen 5 Ryzen 9000](https://www.amd.com/en/newsroom/press-releases/2024-6-2-amd-unveils-next-gen-zen-5-ryzen-processors-to-p.html): posizionamento e claim generazionali Zen 5.

**Derivazione banda:** 2 canali × 5.600 MT/s × 8 byte = 89,6 GB/s teorici. La banda sostenuta dipende da piattaforma, memoria e workload; il profilo non è una misura.

### NVIDIA Blackwell B200

- [NVIDIA — DGX B200](https://www.nvidia.com/en-us/data-center/dgx-b200/): il sistema contiene 8 GPU; la pagina pubblica 1.440 GB complessivi, 64 TB/s HBM3e, 144 PFLOP/s FP4 e specifiche sparse/dense.
- **Derivazione per GPU:** 1.440/8 = 180 GB; 64/8 = 8 TB/s; la pagina riporta 72 PFLOP/s FP4 dense complessivi (dopo il richiamo sparse/dense), quindi 9 PFLOP/s per GPU per quel formato/configurazione. Il simulatore etichetta la derivazione e non usa questo picco FP4 per la curva normalizzata.
- Il testo fornito riportava 192 GB per B200. La fonte DGX consultata implica 180 GB per GPU nella configurazione pubblicata; la demo usa il contesto DGX e non generalizza il valore a tutte le SKU Blackwell.

### Google TPU

- [Google Cloud — TPU v6e / Trillium](https://docs.cloud.google.com/tpu/docs/v6e): per chip: 918 TFLOP/s BF16, 1.836 TOPS INT8, 32 GB HBM, 1.638 GB/s HBM e 800 GB/s di ICI bidirezionale; pod da 256 chip. I valori BF16 e INT8 non sono tra loro intercambiabili.
- [Google Cloud — architettura TPU](https://docs.cloud.google.com/tpu/docs/system-architecture-tpu-vm): descrive MXU e systolic array; v6e usa array 256×256, con moltiplicazioni BF16 e accumulo FP32. Le topologie/slice vanno distinte dal singolo chip.

### Groq LPU

- [Groq — What is a Language Processing Unit?](https://groq.com/lpu/), pagina del produttore: descrive architettura programmabile a “assembly line”, scheduling deterministico controllato dal software, pipeline tra chip e SRAM on-chip. Groq dichiara banda SRAM “upwards of 80 terabytes/second” e confronta il dato con HBM GPU.
- Il testo fornito riportava 150 TB/s e descriveva capacità SRAM non contestualizzate. La fonte primaria consultata non conferma 150 TB/s né pubblica nella pagina un valore di capacità per il profilo; la demo usa il lower bound vendor di 80 TB/s solo come claim e lascia il fit **non determinato**.
- Le velocità “fino a 10×” sono claim del produttore, non vengono usate come risultato o classifica.
- Il riferimento del testo a una presunta acquisizione Groq/NVIDIA non serve al modello hardware e non viene ripetuto senza una fonte societaria primaria aggiornata.

## 3. Fonti strumenti/build/test/deploy

- [Vite — Deploying a Static Site](https://vite.dev/guide/static-deploy): output `dist`, `vite preview` per controllare il build e configurazione `base` per GitHub Pages su sottopercorso; workflow Actions richiesto quando c’è una build.
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html): TypeScript come type checker statico; il progetto userà `tsc --noEmit` separato dal bundling.
- [Playwright — TypeScript](https://playwright.dev/docs/test-typescript): Playwright trasforma i test TS ma non fa type-check; eseguire separatamente il compilatore.
- [Playwright — Web server](https://playwright.dev/docs/test-webserver): supporto a `webServer`, URL e `baseURL` per test locali. La demo userà `vite preview` sul build prodotto.
- [GitHub Docs — Custom workflows with Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages): Pages è disponibile gratuitamente per repository pubblici su GitHub Free; workflow con `pages: write`, `id-token: write`, `configure-pages@v5`, `upload-pages-artifact@v4`, `deploy-pages@v4`.
- Metadati npm verificati con `npm view` il 4 ottobre 2026: Vite 8.3.2 (Node `^20.19.0 || >=22.12.0`), TypeScript 7.0.2 (Node `>=16.20.0`), `@playwright/test` 1.63.0 (Node `>=20`). Node locale 24.19.0 soddisfa i vincoli.

## 4. Claims esclusi o qualificati

| Claim o area del testo di partenza | Trattamento |
|---|---|
| 150 TB/s Groq SRAM | Non adottato come fatto; fonte Groq consultata dichiara “upwards of 80 TB/s”. |
| 192 GB B200 per GPU | Non generalizzato; la pagina DGX consultata implica 180 GB/GPU nella configurazione a 8 GPU. |
| Picchi FP4/FP8/BF16 come classifica unica | Non confrontati; precisione, densità, chip/sistema e unità restano nel dato. |
| M5 Max e M5 Pro | Aggiornati da pagine Apple correnti: rispettivamente 614 GB/s/128 GB e 307 GB/s/64 GB. |
| Dettagli Lion Cove/Skymont su ROB, cache, porte, decoder | Non mostrati come fatti finché non associati a documentazione primaria specifica e SKU. |
| Dettagli interni AMX/registri e prestazioni Apple | Non usati nel Roofline; documentazione pubblica non omogenea e non confrontabile per questa demo. |
| “6×”/“10×”, acquisizione o affermazioni comparative di vendor | Non usati per calcolare prestazioni; claim commerciali richiedono test, condizioni e fonte aggiornati. |

## 5. Regola di aggiornamento

Quando un valore cambia: verificare il documento primario, registrare data e configurazione, aggiornare fonte e test dati, controllare le conversioni e poi modificare il profilo. Se manca una fonte affidabile o una condizione comparabile, mantenere `unknown` invece di stimare in silenzio.
