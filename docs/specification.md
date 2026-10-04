# Specifica di prodotto — AI Silicon / Roofline Lab

- **Versione:** 0.1 — baseline pre-implementazione
- **Data della verifica:** 4 ottobre 2026
- **Stato:** specifica e test plan da approvare prima del codice applicativo
- **Lingua del prodotto:** italiano

## 1. Problema e visione

Le prestazioni dell’inferenza AI non dipendono soltanto dal picco di calcolo. Il riuso dei dati, la gerarchia di memoria, la banda disponibile, la precisione numerica e la forma del workload possono spostare il collo di bottiglia tra memoria e compute. Un confronto tra CPU, SoC con memoria unificata, GPU, TPU e LPU è utile solo se separa dati pubblicati, stime e ipotesi.

**AI Silicon / Roofline Lab** è una demo frontend interattiva che rende visibili queste relazioni. L’utente modifica un workload LLM semplificato, osserva una curva Roofline e confronta il percorso dei dati nelle architetture. La demo è educativa: non esegue modelli e non predice benchmark reali.

## 2. Utenti e valore

- **Studente / divulgatore:** capisce perché un workload può essere memory-bound o compute-bound.
- **Sviluppatore ML:** esplora come precisione, batch e prefill/decode modificano intensità aritmetica e fit dei pesi.
- **Analista hardware:** confronta gerarchie di memoria e verifica la provenienza delle specifiche.
- **Stakeholder:** apre un URL pubblico senza account o backend.

## 3. Scope

### Incluso

- Pagina statica, client-side, TypeScript, senza autenticazione e senza API di runtime.
- Profili di riferimento per Apple M4 Max, M5 Pro, M5 Max, Intel Lion Cove (profilo Core Ultra 9 285K), AMD Zen 5 (profilo Ryzen 9 9950X), NVIDIA Blackwell B200, Google TPU v6e/Trillium e Groq LPU.
- Selettori locali per fase LLM (decode/prefill), dimensione dei pesi, precisione dei pesi, batch, token di contesto e tetto compute normalizzato.
- Calcolo interattivo di intensità aritmetica, limite di memoria, tetto compute, risultato Roofline e stato di fit dei pesi.
- Grafico Roofline SVG accessibile, tabella equivalente, fonti e avvertenze per i profili.
- Un’animazione secondaria del flusso dati, pause/riduzione movimento e layout responsive.
- Build statica pubblicabile gratuitamente su GitHub Pages da un nuovo repository pubblico.

### Escluso

- Esecuzione/inferenza di un LLM, chiamate cloud, login, backend, analytics o salvataggio remoto.
- Benchmark, latenza/token o token/s reali, consumo energetico, prezzo o classifica universale.
- Simulazione fedele di cache, kernel, compiler, interconnessioni, schedulazione, KV cache o runtime vendor.
- Aggiornamento automatico delle specifiche da Internet.
- Uso di numeri non verificati come fatti. Le affermazioni senza fonte comparabile sono omesse o etichettate come stime.

## 4. Storie utente — INVEST

| ID | Storia | Independent | Negotiable | Valuable | Estimable | Small | Testable |
|---|---|---|---|---|---|---|---|
| US-01 | Come utente, voglio impostare un workload, così da vedere l’effetto di batch, precisione e fase LLM. | Controlli e calcolo locali. | Preset e range sono configurabili. | Risponde alla domanda didattica principale. | Input e formula delimitati. | Una scheda di scenario. | Valori e grafico verificabili. |
| US-02 | Come analista, voglio selezionare profili hardware, così da confrontare banda, memoria e collo di bottiglia. | Ogni profilo è indipendente. | Catalogo e dettagli estendibili. | Rende confrontabili famiglie diverse. | Dataset statico tipizzato. | Otto profili iniziali. | Selezioni e metriche testabili. |
| US-03 | Come studente, voglio vedere il punto operativo sul Roofline, così da distinguere memory-bound e compute-bound. | Verificabile con uno scenario fixture senza dipendere dalla UI dei controlli. | Scala/assunzioni sono esplicite. | Spiega la relazione prestazione–intensità. | Formula standard e testabile. | Un chart SVG. | Assi, curve, punto e stato verificabili. |
| US-04 | Come revisore, voglio aprire fonti e limiti di ciascun numero, così da riconoscere fatti, derivazioni e claim vendor. | Fonti associate ai profili. | Dettagli espandibili. | Evita falsa precisione. | Ogni campo ha provenienza. | Un pannello fonti. | Label e link verificabili. |
| US-05 | Come visitatore, voglio esplorare il flusso dati animato, così da capire le differenze tra UMA, HBM, systolic array e SRAM streaming. | La scena segue il profilo selezionato. | Velocità e pausa configurabili. | Rende intuitiva la gerarchia. | Una scena, pochi elementi. | Un canvas decorativo. | Avvio, pausa e reduced motion testabili. |
| US-06 | Come utente senza account, voglio usare la demo da tastiera e su schermi piccoli, così da poterla provare ovunque. | Non richiede rete o login. | Dettagli visuali non essenziali. | Estende l’accesso. | Requisiti standard. | Un pass di accessibilità/responsive. | E2E desktop/mobile/tastiera. |

**Controllo INVEST:** ogni storia può essere sviluppata/testata con un confine esplicito (modello/fixture condiviso, non dipendenza dall’ordine UI); i dettagli di preset e rendering sono negoziabili senza alterare il valore; scope e stima sono limitati alla prima versione; ogni criterio è osservabile in browser.

## 5. Requisiti EARS

Il lessico EARS adottato è: **Ubiquitous** (sempre), **Event-driven** (quando accade un evento), **State-driven** (finché vale uno stato), **Optional** (quando una funzione opzionale è attiva) e **Unwanted behavior** (se si verifica una condizione non valida).

### R-01 — Esecuzione statica (Ubiquitous)
Il sistema deve funzionare come frontend statico client-side e non deve richiedere autenticazione, server applicativo o segreti.

- **Given** il sito statico caricato, **When** l’utente modifica uno scenario, **Then** il calcolo avviene nel browser senza chiamate API.
- **Given** una nuova visita, **When** si apre la pagina, **Then** tutte le funzioni principali sono disponibili senza account.

### R-02 — Catalogo architetture (Event-driven)
Quando la demo viene inizializzata, il sistema deve mostrare otto profili: M4 Max, M5 Pro, M5 Max, Lion Cove/Core Ultra 9 285K, Zen 5/Ryzen 9 9950X, B200, TPU v6e e Groq LPU.

- **Given** la pagina inizializzata, **When** l’utente consulta il confronto, **Then** ogni profilo mostra famiglia, memoria, banda disponibile e tipo di evidenza.
- **Given** un profilo è una famiglia o una configurazione derivata, **When** viene visualizzato, **Then** la UI lo identifica come profilo rappresentativo, non come proprietà universale dell’ISA.

### R-03 — Provenienza e unità (Ubiquitous)
Ogni specifica numerica hardware deve esporre unità, livello di memoria, configurazione, fonte e stato (**produttore**, **derivato**, **stima didattica** o **non disponibile**).

- **Given** un numero visibile, **When** l’utente apre i dettagli, **Then** può identificare la fonte e capire se è un dato del singolo chip, di un sistema multi-chip o un valore derivato.
- **Given** una fonte non specifica un dato, **When** l’interfaccia lo mostra, **Then** usa “non disponibile” e non inventa uno zero o un numero sostitutivo.

### R-04 — Input scenario (Event-driven)
Quando l’utente modifica fase, parametri, precisione, batch, token o tetto compute, il sistema deve aggiornare i risultati localmente.

- **Given** un input valido, **When** il suo valore cambia, **Then** intensità, punto del grafico, limite prestazionale, fit e classificazione si aggiornano.
- **Given** il mode decode, **When** l’utente cambia il batch, **Then** il modello applica l’ipotesi esplicita di riuso dei pesi.
- **Given** il mode prefill, **When** l’utente cambia il numero di token, **Then** l’intensità varia in modo coerente con la formula documentata.

### R-05 — Modello Roofline (Ubiquitous)
Il sistema deve applicare `P_attainable = min(P_peak, BW × I)` con conversione coerente delle unità e deve mostrare `I`, i due limiti e il punto operativo.

- **Given** banda, intensità e tetto validi, **When** il sistema calcola lo scenario, **Then** il risultato è il minore tra tetto compute e tetto di memoria.
- **Given** un profilo con banda sconosciuta, **When** viene selezionato, **Then** non produce una curva numerica fittizia.

### R-06 — Classificazione collo di bottiglia (Event-driven)
Quando viene aggiornato uno scenario, il sistema deve etichettare il punto come **memory-bound**, **compute-bound**, **bilanciato** o **dati insufficienti**.

- **Given** il limite di memoria è inferiore di oltre la tolleranza al tetto compute, **When** si calcola, **Then** lo stato è memory-bound.
- **Given** il tetto compute è inferiore di oltre la tolleranza al limite di memoria, **When** si calcola, **Then** lo stato è compute-bound.
- **Given** i limiti differiscono entro il 5%, **When** si calcola, **Then** lo stato è bilanciato e la soglia è visibile.

### R-07 — Fit memoria (Unwanted behavior / State-driven)
Se il working set stimato eccede una capacità nota, il sistema deve indicare “non entra nel profilo”; mentre la capacità è ignota o configurabile, deve mostrare “da verificare/configurare”.

- **Given** una capacità nota inferiore al working set, **When** il modello è modificato, **Then** il profilo non viene presentato come eseguibile su un singolo chip.
- **Given** una capacità non pubblicata, **When** viene valutato il fit, **Then** il risultato è unknown e non “fit”.

### R-08 — Grafico e alternativa testuale (Ubiquitous)
Il sistema deve fornire un grafico Roofline SVG con assi, unità, curve, ridge point e marker, insieme a una tabella equivalente leggibile da screen reader.

- **Given** una viewport desktop o mobile, **When** il grafico è aggiornato, **Then** il punto resta entro il plot o gli assi sono adattati.
- **Given** un’informazione codificata con colore, **When** l’utente la consulta, **Then** è disponibile anche un nome, marker o testo.

### R-09 — Visualizzazione flusso dati (State-driven)
Mentre la scena è in riproduzione, il canvas interseca la viewport e la pagina è visibile, il sistema deve animare un numero limitato di particelle usando `requestAnimationFrame`, senza aggiornamenti DOM per frame.

- **Given** l’animazione attiva, **When** passa un frame, **Then** il canvas avanza con delta-time e non ricalcola il layout dell’intera pagina.
- **Given** l’utente mette in pausa, la pagina diventa hidden o il canvas esce dalla viewport, **When** il prossimo frame è richiesto, **Then** il ciclo si arresta o sospende e riprende quando le condizioni tornano valide.

### R-10 — Movimento ridotto (Optional)
Quando `prefers-reduced-motion` è attivo o l’utente preme pausa, il sistema deve mostrare una scena statica e mantenere intatti dati e controlli.

### R-11 — Accessibilità e responsive (Ubiquitous)
Il sistema deve essere utilizzabile da tastiera, avere focus visibile e label semantiche, rispettare almeno WCAG 2.2 AA (testo normale 4,5:1; testo grande e componenti grafici 3:1) e funzionare da 360 px a desktop.

- **Given** navigazione solo tastiera, **When** l’utente raggiunge slider, selettori e disclosure, **Then** ogni controllo è operabile e annunciato.
- **Given** viewport 360×800 o zoom 200%, **When** la pagina viene usata, **Then** contenuto e controlli restano disponibili senza overflow orizzontale della pagina.

### R-12 — Performance (State-driven)
Mentre la scena è attiva, su un desktop di riferimento il target è 60 fps (budget 16,7 ms/frame); su browser o dispositivi meno rapidi il sistema deve restare interattivo e poter ridurre movimento/dettagli.

- **Given** il dataset massimo iniziale, **When** l’utente cambia un controllo, **Then** calcolo e aggiornamento sono sincroni e limitati al grafico/metriche, non a un loop DOM.
- **Given** una limitazione hardware, **When** il target non è sostenibile, **Then** i controlli funzionano anche con animazione ridotta o sospesa.

### R-13 — Nessuna dipendenza di runtime remota (Ubiquitous)
La demo non deve caricare font, immagini, librerie, analytics o dati da CDN/API; i link alle fonti sono navigazione facoltativa.

## 6. Regole di contenuto

1. Le bande di UMA, DDR, HBM e SRAM sono descritte con il rispettivo livello e non sono presentate come risorse perfettamente equivalenti.
2. Le curve del grafico sono una **normalizzazione didattica**: il tetto compute è unico e modificabile dall’utente per isolare l’effetto della banda. Non rappresenta il picco compute di ogni prodotto.
3. I picchi vendor in formati diversi sono esposti, quando verificati, solo nelle schede con formato/sparsitá/sistema espliciti; non vengono ordinati come benchmark comune.
4. Il fit usa pesi più una riserva didattica del 20%; non calcola KV cache, workspace o frammentazione per architettura.
5. La classificazione assume banda teorica e riuso ideale; non include latenza kernel, utilization, PCIe, interconnessioni, potenza o thermal throttling.
6. Fonti e ipotesi consultate il 4 ottobre 2026; i dati non si aggiornano automaticamente.

## 7. Definition of Done — specifica

- Tutti gli EARS R-01…R-13 hanno almeno un test o una verifica manuale mappata in `test-plan.md`.
- La formula e ciascuna conversione di unità sono documentate e coperte da test numerici.
- Ogni profilo ha una provenienza oppure un avviso di dato derivato/non disponibile.
- La UI non presenta il risultato come benchmark, classifica o token/s reali.
- Build statica, test E2E senza autenticazione e workflow Pages sono descritti prima dell’implementazione.
