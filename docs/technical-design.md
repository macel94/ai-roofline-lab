# Progetto tecnico — AI Silicon / Roofline Lab

**Baseline pre-implementazione:** 4 ottobre 2026.

Questo documento precede ogni sorgente applicativa; decisioni aggiornabili solo con modifica esplicita della specifica.

## 1. Revisione parallela

Prima della scrittura del codice sono stati consultati tre reviewer indipendenti in sessioni Pi isolate/read-only (tmux):

1. **Product/spec:** INVEST, EARS, scope, acceptance ed edge case.
2. **Roofline/model audit:** formule, precisione, memoria, fit e comparabilità dei claim.
3. **Frontend/delivery:** accessibilità, responsive, rendering 60 fps, Playwright e GitHub Pages.

Le raccomandazioni recepite sono: distinguere hardware facts/derivazioni/ipotesi; non confrontare picchi di precisione diversa; trattare SRAM, HBM, UMA e DDR come livelli differenti; offrire una tabella equivalente al grafico; ridurre o sospendere l’animazione per reduced motion/tab hidden; testare l’artefatto statico di produzione.

## 2. Decisioni architetturali

### ADR-01 — Static TypeScript, senza framework

- **Scelta:** TypeScript strict + Vite come bundler statico; DOM/SVG/canvas nativi.
- **Motivo:** demo mono-pagina con dataset piccolo, nessuno stato distribuito o backend; costo runtime e bundle ridotti.
- **Conseguenze:** rendering e stato sono moduli espliciti; non esiste un server applicativo in produzione.
- **Vincoli verificati:** Vite 8.3.2 richiede Node `^20.19.0 || >=22.12.0`; TypeScript 7.0.2 richiede Node `>=16.20.0`; `@playwright/test` 1.63.0 richiede Node `>=20`. Ambiente corrente: Node 24.19.0, compatibile.

### ADR-02 — Roofline normalizzato, non classifica hardware

Il dato teorico `P_peak` non è pubblicato con la stessa precisione e convenzione per tutti gli otto profili. Il grafico usa perciò un **tetto di calcolo comune, scelto dall’utente**. Ogni curva usa la banda attribuita al livello di memoria dichiarato del profilo. Ciò isola il passaggio memory/compute-bound senza fingere un confronto FP4-vs-BF16-vs-CPU omogeneo.

Le schede profilo possono mostrare metriche compute vendor-source disponibili (sempre con formato, dense/sparse, chip/sistema e fonte), ma queste non alimentano il grafico normalizzato.

### ADR-03 — SVG per Roofline, Canvas per flusso animato

- Il grafico, con otto curve al massimo, è SVG: marker, assi e testo restano ispezionabili/accessibili. Si aggiorna solo a seguito di input/resize.
- Una scena canvas secondaria mostra il flusso di particelle; il DOM contiene già titolo, descrizione, label e dati testuali equivalenti.
- `requestAnimationFrame` unico, delta-time, massimo 24 particelle, backing store limitato a DPR 1.5; niente layout/style read nel loop.
- Pausa su `visibilitychange`, canvas fuori viewport, controllo pausa e `prefers-reduced-motion`; la scena non è necessaria per usare il simulatore.

### ADR-04 — Dati statici, provenienza tipizzata

Ogni valore hardware ha `value`, `unit`, `memoryLevel`, `scope`, `evidence` (`vendor`, `derived`, `illustrative`, `unknown`), `sourceUrl` e `note`. Un valore ignoto è `null`, mai zero. GB e GB/s sono decimali nella demo (1 GB = 10^9 byte).

## 3. Profili iniziali e comparabilità

| Profilo | Banda per il grafico | Memoria/fit | Provenienza e limiti |
|---|---:|---|---|
| Apple M4 Max | 546 GB/s | fino a 128 GB UMA | Dato Apple; SKU/configurazione può avere meno memoria. |
| Apple M5 Pro | 307 GB/s | fino a 64 GB UMA | Dato Apple; non equivale a M5 Max. |
| Apple M5 Max | 614 GB/s | fino a 128 GB UMA | Dato Apple; architettura SoC con memoria unificata. |
| Intel Lion Cove + Skymont / Core Ultra 9 285K | 102,4 GB/s teorici | RAM host regolabile dall’utente; piattaforma dipendente | Derivazione 2 canali × DDR5-6400 × 8 B; non banda misurata. La pagina ARK è fonte di controllo ma ha bloccato l’accesso automatizzato durante la verifica. Profilo rappresentativo, non universale. |
| AMD Zen 5 / Ryzen 9 9950X | 89,6 GB/s teorici | RAM host regolabile dall’utente; max SKU/piattaforma da fonte | Derivazione 2 canali × DDR5-5600 × 8 B. La scheda AMD riporta canali, velocità e AVX-512; la banda è un limite teorico DDR. |
| NVIDIA Blackwell B200 (1 GPU nel DGX B200) | 8.000 GB/s HBM3e | 180 GB HBM, derivati dal sistema DGX B200 a 8 GPU | NVIDIA pubblica 1.440 GB e 64 TB/s totali: divisione per 8. I numeri non sono totali DGX né garanzia di banda sostenuta. |
| Google Cloud TPU v6e / Trillium (1 chip) | 1.638 GB/s HBM | 32 GB HBM | Google pubblica per chip 918 TFLOP/s BF16, 1.836 TOPS INT8, 1.638 GB/s e ICI bidirezionale 800 GB/s. Formati e livello restano espliciti. |
| Groq LPU (chip/streaming) | 80.000 GB/s come lower bound dichiarato | capacità on-chip non dichiarata nella fonte consultata | Groq dichiara “upwards of 80 TB/s” di banda SRAM on-chip. È un claim del produttore, non misura indipendente; il fit singolo-chip è `unknown`. SRAM non equivale a HBM/UMA. |

Per Intel/AMD l’input `RAM host` è una configurazione scenario, non un massimo universale. Per profili Apple il valore disponibile è dichiarato come “fino a”. Il fit del LPU rimane unknown se non è disponibile una capacità verificabile.

## 4. Modello di workload didattico

### Input

- `N`: parametri del modello, in miliardi (1…120 B).
- `q`: bit per peso (4, 8 o 16); è precisione di **memorizzazione dei pesi**, non una dichiarazione della precisione delle operazioni.
- `B`: batch (1…32).
- `K`: token processati per step: 1 per decode; lunghezza del prompt selezionata per prefill.
- `BW`: banda profilo in GB/s.
- `P_ref`: tetto compute condiviso, regolabile (10…10.000 TFLOP/s), per normalizzazione.

### Formule

Pesi residenti minimi (GB decimali):

`W_GB = N_B × q / 8`

Working set didattico per fit:

`M_est_GB = W_GB × 1,20`

Il 20% è una riserva generica per metadata/runtime/altro, non un calcolo preciso di KV cache o workspace.

Per un MAC si contano 2 operazioni. Assumendo pesi densi letti una volta e riutilizzati per tutti gli elementi del batch/prompt:

`F_GFLOP_per_step = 2 × N_B × B × K`

`I_FLOP_per_byte = F_GFLOP_per_step / W_GB = 16 × B × K / q`

La formula è un modello ideale di riuso. Esclude attention e KV traffic, scale/zero-point, dequantizzazione, attivazioni, padding, kernel e trasferimenti. Per prefill presume riuso dei pesi su tutti i token di input; per decode usa un token per sequenza.

Convertendo la banda decimale in TFLOP/s:

`P_memory_TFLOP/s = BW_GB/s × I_FLOP/byte / 1000`

`P_attainable_TFLOP/s = min(P_ref_TFLOP/s, P_memory_TFLOP/s)`

`ridge_I_FLOP/byte = P_ref_TFLOP/s × 1000 / BW_GB/s`

- Memory-bound se `P_memory < 0,95 × P_ref`.
- Compute-bound se `P_memory > 1,05 × P_ref`.
- Bilanciato entro ±5%; se banda o dato richiesto è unknown, “dati insufficienti”.

La curva rappresenta un **limite superiore teorico normalizzato**, non prestazione misurata. Per un workload quantizzato, il conto in FLOP è un’astrazione; il grafico non confronta i picchi vendor INT4/FP8/BF16.

### Esempio verificabile

Per 7B, INT4, batch 1, decode:

- `W = 7 × 4 / 8 = 3,5 GB`;
- `M_est = 4,2 GB`;
- `I = 16 × 1 × 1 / 4 = 4 FLOP/byte`.

A batch 8, l’ipotesi di riuso porta `I=32 FLOP/byte`. Per prefill di 512 token e batch 1 INT4, il modello ideale dà `I=2.048 FLOP/byte`. Questi valori sono unit test del modello semplificato, non risultati hardware.

## 5. UX e struttura sorgente prevista

```text
index.html
src/
  main.ts
  styles.css
  domain/model.ts         # formule pure, unità, classificazione, fit
  data/profiles.ts        # valori e provenienza tipizzati
  ui/state.ts             # stato e controlli
  ui/render.ts            # aggiornamento DOM accessibile
  visuals/roofline.ts     # SVG, assi, curve e tabella
  visuals/data-flow.ts    # canvas + requestAnimationFrame
  visuals/profiles.ts     # schemi statici dei data path
 tests/
  model.spec.ts
  demo.spec.ts
  accessibility.spec.ts
 docs/
```

**Layout:** hero editoriale; pannello “scenario”; confronto profili; grafico + tabella; vista architettura selezionata; note fonti/assunzioni. Colori differenziati per architettura con label/pattern oltre al colore, tipografia di sistema, nessun font/asset remoto. Contrasto target WCAG 2.2 AA: almeno 4,5:1 per testo normale e 3:1 per testo grande/componenti grafici.

**Tecnologie:** Vite 8.3.2, TypeScript 7.0.2, `@playwright/test` 1.63.0 per E2E. Nessuna libreria UI o chart a runtime. Il lockfile renderà installazioni CI riproducibili. Il TS compiler viene eseguito separatamente dai test Playwright, che transpila TypeScript ma non ne verifica i tipi.

## 6. Sicurezza e privacy

- Nessun segreto, chiave API o `.env` richiesto; non creare placeholder `.env`.
- Nessun login, cookie applicativo, analytics o invio di input.
- I dati inseriti restano nella memoria della pagina; nessuna persistenza richiesta.
- Link esterni alle fonti sono navigazione facoltativa con `rel="noreferrer"`.
- Tutti gli asset runtime sono locali.

## 7. Release target

- Nome nuovo repository: `macel94/ai-roofline-lab` (collision check eseguito: non trovato tra i repo dell’account).
- URL atteso: `https://macel94.github.io/ai-roofline-lab/`.
- `base: './'` per asset relativi della single-page, verificato anche sul sottopercorso Pages.
- Build `dist/`; workflow GitHub Actions con `configure-pages@v5`, `upload-pages-artifact@v4`, `deploy-pages@v4`, permessi minimi `contents:read`, `pages:write`, `id-token:write`.
- Pages è gratuito per repo pubblici con GitHub Free; nessun token utente sarà incluso nel workflow o nel sito.

## 8. Review di design

Le tre sessioni parallele hanno raccomandato: modello più semplice del benchmark reale e caveat sempre visibile; profili con precisione/ambito/dato mancanti espliciti; capacità separata da banda; grafico accompagnato da tabella; Playwright contro build statico; animazione leggera e disattivabile. Le decisioni sopra incorporano tali vincoli.
