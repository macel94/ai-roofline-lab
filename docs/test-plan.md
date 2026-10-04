# Piano di test e pubblicazione — AI Silicon / Roofline Lab

**Baseline pre-implementazione:** 4 ottobre 2026.

I test sono progettati contro la build statica di produzione per verificare la demo senza login/API.

## 1. Strategia

| Livello | Scopo | Tool/percorso |
|---|---|---|
| Type check | Tipi app/test e DOM APIs | `tsc --noEmit` con TS strict |
| Unit/model | Formule, unità, fit, classificazione | Test Playwright importano funzioni pure del dominio; nessun runner aggiuntivo |
| E2E | Interazione, grafico, profili, no-auth | Playwright Chromium contro `vite preview` su `dist/` |
| Accessibility | Semantica, tastiera, reduced motion, viewport | Playwright locator/assertioni e verifica manuale WCAG 2.2 AA; nessuna dipendenza axe in v1 |
| Build/static | Asset locali, base path, dimensione output | `vite build`, ispezione `dist`, server preview e `curl` |
| Performance | Loop RAF e reattività | E2E smoke + misura locale ripetibile; niente soglia fps fragile come unico gate CI |
| Live Pages | Deploy e sito realmente servito | Workflow status, URL Pages, HTTP 200 e browser smoke |

I test non devono dipendere da API key, login, browser storage remoto o servizi esterni. Il dataset è fixture versionato nel repository.

## 2. Test delle formule

1. **Conversioni:** GB decimali, GB/s e FLOP/byte; 1 TB/s = 1.000 GB/s.
2. **Pesi:** 7B INT4 = 3,5 GB raw; 7B INT8 = 7 GB; 7B FP16 = 14 GB.
3. **Riserva fit:** 7B INT4 × 1,20 = 4,2 GB; 70B INT4 × 1,20 = 42 GB.
4. **Decode:** 7B INT4, batch 1, K=1 ⇒ intensità 4 FLOP/byte; batch 8 ⇒ 32.
5. **Prefill:** 7B INT4, batch 1, K=512 ⇒ 2.048 FLOP/byte.
6. **Tetto memoria:** BW=1.000 GB/s, I=4 ⇒ 4 TFLOP/s teorici.
7. **Min Roofline:** con `P_ref=1000 TFLOP/s`, la prestazione è il min dei tetti; verificare entrambi i lati della ridge.
8. **Ridge point:** `P_ref=1000`, BW=1.000 ⇒ 1.000 FLOP/byte.
9. **Stati:** memory-bound sotto il 95% del compute roof, compute-bound sopra il 105%, bilanciato entro ±5%.
10. **Input invalidi:** q=0, batch=0, N<0, `NaN`, valori vuoti o overflow non devono generare curve o “fit” falsi.
11. **Dati unknown:** banda/capacità ignote ⇒ “dati insufficienti/fit unknown”, mai 0 o capacità implicita.
12. **Profiler:** unit test dei dati Apple, derivazioni DDR, per-GPU DGX B200, TPU per-chip e lower bound Groq contro `research.md`.

## 3. Test end-to-end Playwright (build statico)

### Avvio e integrità

- `npm run test:e2e` crea prima `dist/`; `webServer` avvia `vite preview` con porta deterministica.
- La home risponde HTTP 200 e mostra titolo, lingua italiana, istruzioni e disclaimer “simulazione teorica, non benchmark”.
- Caricamento senza credenziali, senza richieste API e senza errori JS non gestiti.
- Asset CSS/JS si caricano con il base path relativo; nessun asset CDN/font remoto.

### Funzionalità

- Sono presenti gli otto profili e ognuno espone fonte/qualifica del dato.
- Cambiare M4/M5, Intel/AMD, B200, TPU o Groq aggiorna scheda, curva e data path.
- Cambiare decode/prefill, N, q, batch, K o tetto compute aggiorna intensità e marker.
- Verificare i risultati numerici dei casi 7B INT4, batch 1, batch 8 e prefill 512.
- Selezionare/deselezionare curve aggiorna legenda e tabella senza perdere lo stato del calcolo.
- Test dei casi memory-bound, compute-bound, bilanciato e unknown.
- Fit: esempio 70B INT4 richiede 42 GB stimati; un profilo TPU v6e singolo chip da 32 GB mostra “non entra”; Groq resta “da verificare”.
- Fonti apribili in nuova scheda e non necessarie per eseguire il calcolo.
- Controllo play/pause: l’animazione avanza quando la vista flusso è on-screen, la pausa la ferma, resume la riavvia; scroll fuori viewport la sospende.

### Accessibilità e responsive

- Ordine di tab deterministico, focus ring visibile, label per ogni slider/select e annunci non invadenti.
- Contrasto minimo WCAG 2.2 AA: 4,5:1 per testo normale e 3:1 per testo grande/componenti grafici; verifica su tutte le coppie colore/stato.
- Slider modificabili da tastiera; valori correnti presentati in testo leggibile.
- Grafico con nome/descrizione e tabella equivalente; le serie sono riconoscibili senza affidarsi soltanto al colore.
- Emulazione `prefers-reduced-motion: reduce`: nessun ciclo animato, controlli e valori ancora operativi.
- Viewport desktop (1440×900), tablet (768×1024), mobile (360×800) e zoom 200%: nessuna sovrapposizione critica o overflow orizzontale della pagina.
- Ridimensionamento e cambi rapidi del selettore non lasciano observer/RAF duplicati.

### Rete

- Intercettare richieste e fallire il test se l’app richiede risorse runtime da host esterni.
- Consentire solo l’apertura volontaria del link fonte; nessun fetch/analytics automatico.
- Dopo che l’app è caricata, bloccare le richieste non locali e ripetere interazioni essenziali: scenario e grafici usano il dataset incluso.

## 4. Verifica 60 fps e budget

- L’animazione deve avere un solo `requestAnimationFrame`, delta-time, massimo 24 elementi e nessuna mutazione DOM/layout per frame.
- E2E controlla che il contatore frame avanzi quando il canvas è visibile, si fermi in reduced-motion/tab-hidden/pausa/fuori viewport e riprenda quando torna visibile.
- Misura locale su Chromium desktop per almeno 5 secondi: registrare FPS mediano e distribuzione intervalli; target 60 fps (16,7 ms). Ripetere con profili tutti selezionati e ridimensionamento.
- Non bloccare CI con un “60 esatto” su runner virtualizzato: il gate automatizzato verifica assenza di loop duplicati, long task evitabili e blocchi input; il test prestazionale registra invece la misura.
- Budget pianificato: JavaScript iniziale ≤150 KB gzip, CSS ≤30 KB gzip, asset totali locali ≤300 KB; nessun font o immagine remoto.
- Controllare che slider e aggiornamento SVG restino indipendenti dal tick dell’animazione.

## 5. Workflow locale

```text
npm ci
npm run typecheck
npm run test:e2e
npm run build
npm run preview
```

`test:e2e` è contro `dist/`; `vite preview` è usato soltanto per test e anteprima locale, non come server di produzione.

## 6. GitHub Actions / Pages

- Trigger: push su `main` e `workflow_dispatch`.
- Node 22.12+ (oppure Node 24) con cache npm e `npm ci`.
- Installare Chromium Playwright per E2E; eseguire type-check, test e build prima del deploy.
- Pubblicare l’artefatto `dist/` con `actions/upload-pages-artifact@v5` e `actions/deploy-pages@v5`; `actions/configure-pages@v6` (checkout/setup-node v7, runtime Node 24).
- Permessi minimi: `contents: read`, `pages: write`, `id-token: write`; concurrency del gruppo `pages`.
- Repository pubblico GitHub Free `macel94/ai-roofline-lab`; non cambiare impostazioni o codice di altri repository.

## 7. Esito locale pre-pubblicazione (4 ottobre 2026)

- `npm run test:e2e`: **18/18 pass** (10 casi di dominio e 8 E2E Chromium; build e type-check inclusi).
- `npm audit --audit-level=moderate`: nessuna vulnerabilità riportata.
- Build: JS 25,24 KB (8,48 KB gzip), CSS 28,40 KB (7,18 KB gzip), HTML 25,16 KB (7,32 KB gzip), favicon SVG 490 B; asset JS/CSS entro i budget.
- Nessun errore JS/console nella prova browser; nessuna richiesta runtime a host esterni.
- Chromium headless desktop 1440×1000, canvas in viewport e profili tutti attivi: default 297 frame / 5.010 ms, 59,3 fps, mediana 16,7 ms, p95 16,8 ms, 3 intervalli >20 ms (max 50 ms).
- Workload massimo (120B, 16 bit, batch 32, prefill 8.192 token): 301 frame / 5.009 ms, 60,1 fps, mediana 16,7 ms, p95 16,7 ms, 0 intervalli >20 ms (max 16,8 ms).
- Mobile 390×844: `scrollWidth == clientWidth == 390`, nessun errore JS.
- Spot check palette WCAG: testo secondario minimo 4,84:1 sui fondi chiari verificati; accento small text 5,18:1 sul fondo più scuro; display accent 3,03:1 per testo grande; label chart scure ≥5,33:1.
- GitHub Pages workflow parsato con PyYAML; asset del build usano path relativi `./`.

Le misure fps sono una prova locale singola, non una garanzia su ogni dispositivo. Ripetere la misura dopo modifiche al loop canvas o alla complessità del grafico.

## 8. Checklist post-deploy

1. Verificare che l’Action CI/test/deploy termini con successo.
2. Leggere URL Pages dall’environment GitHub Pages; atteso `https://macel94.github.io/ai-roofline-lab/`.
3. Richiedere home e asset principali con `curl`; controllare status 200, MIME e URL relativi.
4. Aprire l’URL pubblico e ripetere un caso decode e uno prefill, selezionare tutti i profili e ridurre movimento.
5. Controllare console/network: nessuna API/auth e nessun 404 su asset.
6. Verificare che il repository creato sia solo `ai-roofline-lab`; nessun altro repo viene modificato.
