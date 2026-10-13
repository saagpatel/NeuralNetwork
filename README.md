# Neural Network Playground

An interactive neural-network playground that runs in the browser. Build dense and convolutional networks, train them with TensorFlow.js in a Web Worker, and inspect weights, activations, and training metrics. No application backend is required.

**Live demo:** https://neural-network-playground.vercel.app

## Features

- Dense and convolutional network presets and custom layers
- MNIST, Fashion-MNIST, and CIFAR-10 dataset support
- Canvas network visualization and D3 training charts
- Activation inspection, confusion matrix, guided tutorials, and shareable URLs
- IndexedDB dataset caching

## Quick Start

### Prerequisites

- Node.js matching `.node-version`
- pnpm 12.11.2 as pinned by `packageManager` in `package.json`

### Installation

```bash
corepack enable
pnpm install --frozen-lockfile
```

### Usage

```bash
pnpm dev
# Open http://localhost:3000
```

## Verification

Run `make check` for typecheck, formatting, lint, tests, and the static build. Use `pnpm preview` to serve the generated `out/` directory. CIFAR-10 binary files are generated locally with `node scripts/prepare-cifar10.js` and are excluded from Git.

Local fixture checks do not exercise real dataset downloads, GPU backends, hosted CI, or deployment. UI, sharing, training, and visualization changes should be checked in a browser.

## Tech Stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 16, static export |
| UI | React 19, TypeScript 5 |
| ML | TensorFlow.js 4, Web Worker, Comlink |
| State | Zustand 5 |
| Charts | D3.js 7 |
| Visualization | Canvas 2D |
| Styling | Tailwind CSS 4 |
| Dataset cache | IndexedDB via idb-keyval |

## Status

### Stack

The app exports a static site and performs model training in the browser. Install and check commands use pnpm and the checked-in `pnpm-lock.yaml`.

### Known risks

- CIFAR-10 metadata advertises a 10,000/2,000 subset while the preparation script produces 50,000/10,000; loading now reports a count mismatch until the intended dataset size is chosen.
- The README demo URL and the canonical URL in `src/app/layout.tsx` differ; the canonical public URL still needs an owner decision.
- Regularization controls are preserved, but L1/L2 are not currently applied to model kernels.
- Hosted CI, branch protection, and deployment state are not established by local checks.

### Next steps

- Decide whether CIFAR-10 uses the browser subset or the full dataset.
- Decide whether to implement or remove the regularization controls and URL fields.
- Choose the canonical live URL, CIFAR-10 hosting approach, edge-color semantics, theme scope, and license holder.

## License

MIT
