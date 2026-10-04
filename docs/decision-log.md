# Registro decisioni — AI Silicon / Roofline Lab

**Stato:** decisioni pre-implementazione, 4 ottobre 2026.

| ID | Decisione | Motivo | Esito da verificare |
|---|---|---|---|
| D-01 | Usare TypeScript strict + Vite, senza framework UI. | Sito mono-pagina statico; evitare runtime e bundle superflui. | Typecheck e build riproducibili. |
| D-02 | Nessun backend, autenticazione, API, secret o `.env`. | Demo self-contained e pubblicabile su Pages. | Blocco rete esterna nei test. |
| D-03 | Grafico SVG e tabella accessibile; animazione canvas isolata e sospesa fuori viewport. | SVG semplice per poche curve; canvas limitato per flusso decorativo a 60 fps, senza lavoro inutile off-screen. | Tastiera/screen reader, reduced motion, visibility e frame smoke. |
| D-04 | Curva normalizzata con tetto compute unico/modificabile. | Non esistono picchi pubblici omogenei per tutte le architetture/precisioni. | Avvertenza visibile e metriche vendor fuori dal ranking. |
| D-05 | Fonti, unità e status per ogni valore hardware. | Evitare di confondere chip/sistema, densità, FP4/BF16 e livelli di memoria. | Test dataset e disclosure UI. |
| D-06 | Usare M4 Max, M5 Pro, M5 Max, Core Ultra 9 285K (profilo), Ryzen 9 9950X (profilo), B200, TPU v6e e Groq LPU. | Copre le famiglie e sottocategorie presenti nel brief. | Link/fatti in `research.md`; Intel marcato derivato. |
| D-07 | Test E2E contro `dist/` con Playwright e deploy da GitHub Actions. | Verifica path statici reali e assenza di backend. | Workflow Pages verde e smoke sul sito live. |
| D-08 | Nuovo repo pubblico `macel94/ai-roofline-lab`. | Isola il progetto e rende Pages gratuito su GitHub Free. | Creare solo dopo che codice e test sono pronti. |

## Review parallele pre-codice

Tre sessioni Pi indipendenti, read-only, avviate in parallelo tramite tmux:

- product/spec: INVEST, EARS, criteri di accettazione, scope ed edge case;
- Roofline: precisione, intensità, prefill/decode, KV/memoria e limiti di comparabilità;
- frontend/delivery: SVG/canvas, accessibilità, Playwright, budget e GitHub Pages.

I risultati hanno guidato D-03…D-07; nessun subagente ha scritto sorgente applicativa.
