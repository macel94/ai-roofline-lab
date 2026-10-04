# AI Silicon / Roofline Lab

An interactive, static TypeScript Roofline lab for exploring AI inference bottlenecks across Apple silicon, Intel/AMD x86, NVIDIA Blackwell, Google TPU, and Groq LPU.

**Live demo:** [macel94.github.io/ai-roofline-lab](https://macel94.github.io/ai-roofline-lab/)

**Source:** [github.com/macel94/ai-roofline-lab](https://github.com/macel94/ai-roofline-lab)

All eight architecture profiles are selected together by default. The shared Roofline compute ceiling is explicitly normalized and user-adjustable; this is an educational model, not a benchmark or a prediction of real tokens/s.

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

The English refresh was specified and reviewed by parallel read-only subagents before the UI implementation changed.
