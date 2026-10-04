# AI Silicon / Roofline Lab

Laboratorio interattivo, statico e in italiano per esplorare il Roofline e i colli di bottiglia nell’inferenza AI: Apple Silicon, Intel/AMD x86, NVIDIA Blackwell, Google TPU e Groq LPU.

La demo è progettata per funzionare senza account, backend o API. Il grafico è una simulazione didattica normalizzata, non un benchmark né una previsione di token/s reali.

## Documentazione pre-implementazione

- [Specifica prodotto — INVEST/EARS](docs/specification.md)
- [Progetto tecnico e modello matematico](docs/technical-design.md)
- [Fonti e verifica dei claim](docs/research.md)
- [Piano test, E2E e Pages](docs/test-plan.md)

> Baseline documentale redatta prima del codice applicativo e revisionata in parallelo da tre subagenti read-only.

## Esecuzione locale

```sh
npm ci
npx playwright install chromium  # una sola volta per i test E2E locali
npm run dev
```

Altri controlli disponibili:

```sh
npm run typecheck
npm run test:e2e
npm run build
npm run preview
```

`npm run test:e2e` ricostruisce `dist/` e avvia Playwright contro la build statica tramite `vite preview`. Non servono `.env`, chiavi, login o API. Tutti i pacchetti applicativi sono strumenti di sviluppo; la pagina pubblicata è statica.

## Pubblicazione

Repository previsto: [github.com/macel94/ai-roofline-lab](https://github.com/macel94/ai-roofline-lab). URL Pages previsto: <https://macel94.github.io/ai-roofline-lab/>; verrà verificato dopo il deploy.
