# Neural Network Playground

[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript)](#) [![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](#)

> Architect, train, and visualize neural networks live in your browser — no backend required.

An interactive, in-browser neural network playground where you build custom networks (dense + CNN layers), train them on real visual datasets, and watch weights, activations, loss curves, and confusion matrices update in real time. All training runs client-side via TensorFlow.js — zero backend, zero setup.

**Live demo:** https://neural-network-playground.vercel.app

## Features

- **Layer-by-layer network builder** — add dense and convolutional layers with configurable parameters
- **Three real datasets** — MNIST, Fashion-MNIST, and CIFAR-10 (cached in IndexedDB after first load)
- **Real-time weight heatmaps** — Canvas 2D renders weight distributions during training without blocking the UI
- **Loss/accuracy curves** — D3.js charts plus confusion matrix and per-layer activation viewer
- **Overfitting demo mode** — watch train loss diverge from validation loss live
- **URL sharing** — encode full network config + dataset into a compressed hash link
- **Guided tutorials** — "What is a Neuron?", "Why Overfitting Happens", "How CNNs See Images"

## Quick Start

### Prerequisites
- Node.js 22.13+ on the 22.x line, 24.x, or 26+; the current Vitest, Vite, and jsdom dependencies exclude Node 18 and 20.
- pnpm 11.5.2, matching `packageManager` in `package.json`.
- Run the commands below from the repository root.

### Installation
```bash
pnpm install --frozen-lockfile
```

### Usage
```bash
pnpm dev
# Open http://localhost:3000
```

## Verification

Use pnpm and the checked-in `pnpm-lock.yaml` / `pnpm-workspace.yaml`. Install with the frozen lockfile before running checks; dependency installation may access the package registry and run the explicitly allowed dependency build scripts. Do not refresh a lockfile just to make verification pass.

For a focused local check of dataset parsing and shared URL validation:

```bash
pnpm test src/lib/dataset-loader.test.ts src/lib/url-state.test.ts
```

These tests use synthetic in-memory buffers and URL payloads. They do not download datasets, train a model, connect to a provider, or deploy anything. The broader suite also includes CPU model compilation, store behavior, and React hydration:

```bash
pnpm test
pnpm lint
pnpm build
```

`pnpm build` includes TypeScript checking and writes `.next/` and the static export in `out/`; Next.js may also regenerate `next-env.d.ts`, so review working-tree changes afterward. There is no separate typecheck or formatter script. Lint currently reports two existing hook dependency warnings in `ConfusionMatrix.tsx`.

[`.codex/verify.commands`](.codex/verify.commands) lists the routine install/check sequence. CI currently runs install, lint, and tests only for `main`; the established default is `feat/phase-3-polish-sharing-deployment`, so a PR to that branch may have no CI checks. Record local verification explicitly instead of treating absent checks as a pass.

### Browser checks when user-facing behavior changes

Use `pnpm dev` locally when changing the playground UI, shared URLs, training controls, or visualizations; pure documentation changes do not require a browser run. Check the affected flow and responsive layout, and inspect browser errors. For sharing changes, verify a malformed config shows the ignored notice without replacing the default model, a valid synthetic config hydrates, and Share preserves unrelated hash parameters. These checks can run without starting training or downloading data.

Dataset loading or training needs a separate explicitly intended check: it can fetch datasets and write the browser's IndexedDB cache. CIFAR-10 binary files are excluded from Git, and WebGPU availability depends on the browser and OS. Record which backend and dataset were actually exercised; local fixture tests do not establish GPU or real-dataset behavior.

The build uses `output: "export"`. Preview `out/` with a local static-file server if testing the built artifact; `pnpm start` invokes `next start` and cannot serve this export. Publishing and deployment are separate from local verification.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, static export) |
| ML runtime | TensorFlow.js 4.x + WebGPU backend |
| Training execution | Web Worker + Comlink |
| Network graph | Canvas 2D (weight heatmaps) |
| Charts | D3.js 7.x |
| State | Zustand 5.x |
| Dataset caching | IndexedDB via idb-keyval |
| URL sharing | LZ-string (compressed hash params) |
| Styling | Tailwind CSS 4.x |

## License

MIT
