# AI Silicon / Roofline Lab

An interactive, static TypeScript lab for seeing why AI workloads wait for memory or matrix computation across Apple silicon, Intel/AMD x86, NVIDIA Blackwell, Google TPU, and Groq LPU.

**Live demo:** [macel94.github.io/ai-roofline-lab](https://macel94.github.io/ai-roofline-lab/)

**Source:** [github.com/macel94/ai-roofline-lab](https://github.com/macel94/ai-roofline-lab)

The primary view is a shared 2D silicon map: eight chip lanes trace model weights from their memory pool, across the data path, into each chip’s matrix engine. It shows the workload’s weight bytes and matrix operations, idealized data-feed time, a clearly labeled shared reference math time, and the stage each lane waits on. All eight chips are included by default; switch between Decode and Prefill to see weight reuse move the bottleneck.

Per-chip compute facts are shown with their precision, scope, and evidence. They are not ranked together: vendor peaks use incompatible formats and system scopes. The shared reference rate is a teaching aid, not a chip specification. This is not a benchmark or a prediction of real tokens/s.

The site requires no account, backend, API key, or runtime network service. Source links are optional and open only when clicked.

## Run locally

```sh
npm ci
npm run dev
```

Open the local Vite URL shown in the terminal. One-time local E2E setup:

```sh
npx playwright install chromium
npm run typecheck
npm run test:e2e
```

`npm run test:e2e` builds `dist/` and runs Playwright against the static output served with `vite preview`.

## Project documentation

- [Product specification — INVEST and EARS](docs/specification.md)
- [Technical design and model](docs/technical-design.md)
- [Research, sources, and data qualifications](docs/research.md)
- [Test and deployment plan](docs/test-plan.md)
- [Decision log and parallel reviews](docs/decision-log.md)

The original English refresh was specified and reviewed by parallel read-only subagents; the physical-map revision addresses visitor feedback about the clarity of the original graph.
