# Neural Network Playground

A modern, open-source, in-browser neural network playground where users architect custom networks (dense + CNN layers), train them on real visual datasets (MNIST, Fashion-MNIST, CIFAR-10), and watch weights, activations, loss curves, and decision boundaries update in real time. Spiritual successor to TensorFlow Playground — same interactive learning philosophy, but with real image data, CNN support, URL sharing, and guided tutorials. Zero-backend: all training runs client-side via TensorFlow.js.

## Tech Stack
- **Next.js**: 14+ (App Router, static export)
- **React**: 18+ (hooks-only, concurrent rendering)
- **TypeScript**: 5.x (strict mode, no `any`)
- **TensorFlow.js**: 4.x (`@tensorflow/tfjs` + `@tensorflow/tfjs-backend-webgpu`)
- **Zustand**: 4.x (state management)
- **D3.js**: 7.x (loss curves, accuracy plots — charts only)
- **Canvas 2D**: network graph + weight heatmaps (performance-critical, not SVG)
- **Comlink**: 4.x (typed Web Worker RPC)
- **idb-keyval**: 6.x (IndexedDB dataset caching)
- **Tailwind CSS**: 3.x

## Status
Phase 3 complete — all planned phases shipped:
- Phase 0: TF.js infrastructure, Web Worker, Zustand stores, core types
- Phase 1: Full playground UI — network canvas, D3 charts, training controls
- Phase 2: CNN support, CIFAR-10 dataset, confusion matrix, activation viewer
- Phase 3: URL sharing of network configs, guided tutorials, deployment prep, README overhaul

Deployed as static Next.js export. CIFAR-10 binary datasets excluded from git (gitignored).

## Build & Run
```bash
npm install
npm run dev        # development server
npm run build      # static export
npm run start      # preview static export
```

## Architecture
- `app/` — Next.js App Router pages (static export)
- `components/` — React UI: network builder, training panel, metrics charts, tutorial overlay
- `lib/worker/` — TF.js training Web Worker (Comlink RPC) — never runs on main thread
- `lib/stores/` — Zustand stores for network config, training state, dataset cache
- `lib/types.ts` — `LayerConfig[]` JSON schema for network definition (serializable for URL sharing)
- Canvas 2D for all high-frequency rendering (network graph, weight heatmaps); D3 for metrics only
- IndexedDB via idb-keyval caches datasets to avoid re-downloading 11-60MB on each visit
- Backend fallback: WebGPU → WebGL → WASM

## Known Issues
- CIFAR-10 dataset files must be downloaded separately (gitignored due to binary size)
- Input layer uses compressed representation — not all 784 MNIST neurons rendered individually
- WebGPU backend availability varies by browser/OS; falls back to WebGL automatically
