# Neural Network Playground

An interactive neural-network playground that runs in the browser. Build dense and convolutional networks, train them with TensorFlow.js in a Web Worker, and inspect weights, activations, and training metrics. No application backend is required.

**Live demo:** https://neural-network-playground-delta.vercel.app

## Features

- Dense and convolutional network presets and a layer editor
- Loaders for MNIST, Fashion-MNIST, and CIFAR-10 (see [data requirements](#known-risks))
- Canvas network visualization and D3 training charts
- Activation inspection, confusion matrix, guided tutorials, and shareable URLs
- IndexedDB dataset caching

## Quick Start

### Prerequisites

- Node.js matching `.node-version`
- pnpm 12.11.2 as pinned by `packageManager` in `package.json`
- `make` for verification and `tar` for optional CIFAR-10 preparation

### Installation

```bash
pnpm install --frozen-lockfile
```

### Usage

```bash
pnpm dev
# Open http://localhost:3000
```

If the dev server cannot start its file watcher, run `WATCHPACK_POLLING=1500 pnpm dev --webpack` to use polling.

## Verification

Run `make check` for typecheck, formatting, lint, tests, and the static build. Use `pnpm preview` to serve the generated `out/` directory. CIFAR-10 binary files are generated locally with `node scripts/prepare-cifar10.js` and are excluded from Git.

Local fixture checks do not exercise real dataset downloads, GPU backends, hosted CI, or deployment. UI, sharing, training, and visualization changes should be checked in a browser.

## Tech Stack

| Area          | Technology                           |
| ------------- | ------------------------------------ |
| Framework     | Next.js 16, static export            |
| UI            | React 19, TypeScript 5               |
| ML            | TensorFlow.js 4, Web Worker, Comlink |
| State         | Zustand 5                            |
| Charts        | D3.js 7                              |
| Visualization | Canvas 2D                            |
| Styling       | Tailwind CSS 4                       |
| Dataset cache | IndexedDB via idb-keyval             |

## Status

### Stack

The app exports a static site and performs model training in the browser. Install and check commands use pnpm and the checked-in `pnpm-lock.yaml`.

### Known risks

- The default MNIST and Fashion-MNIST downloads return 404. For local training, place the four uncompressed IDX files in `public/datasets/` and set `NEXT_PUBLIC_DATASET_BASE_URL=/datasets` before starting or building the app. Name the files with the prefix `mnist_` or `fashion_mnist_` and the suffixes `train_images`, `train_labels`, `test_images`, and `test_labels`.
- The CIFAR-10 loader expects 10,000 training records and 2,000 test records. The preparation script writes 50,000 and 10,000 respectively, so the loader rejects its files unless you trim each split to the expected count (3,073 bytes per record).
- Regularization controls are preserved, but L1/L2 are not currently applied to model kernels.
- Hosted CI, branch protection, and deployment state are not established by local checks.

### Next steps

- Decide whether CIFAR-10 uses the browser subset or the full dataset.
- Decide whether to implement or remove the regularization controls and URL fields.
- Choose the CIFAR-10 hosting approach, edge-color semantics, and theme scope.

## License

MIT
