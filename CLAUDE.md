# Neural Network Playground

## Overview
A modern, open-source, in-browser neural network playground where users architect custom networks (dense + CNN layers), train them on real visual datasets (MNIST, Fashion-MNIST, CIFAR-10), and watch weights, activations, loss curves, and decision boundaries update in real-time. Built as the spiritual successor to TensorFlow Playground — same interactive learning philosophy, but with real image data and modern architecture visualization. Zero-backend: all training runs client-side via TensorFlow.js.

## Tech Stack
- **Next.js**: 14+ (App Router, static export)
- **React**: 18+ (hooks-only, concurrent rendering)
- **TypeScript**: 5.x (strict mode, no `any`)
- **TensorFlow.js**: 4.x (`@tensorflow/tfjs` + `@tensorflow/tfjs-backend-webgpu`)
- **Zustand**: 4.x (state management)
- **D3.js**: 7.x (charts only — loss curves, accuracy plots)
- **Canvas 2D**: Network graph + weight heatmaps (not SVG — performance critical)
- **Comlink**: 4.x (typed Web Worker RPC)
- **idb-keyval**: 6.x (IndexedDB dataset caching)
- **Tailwind CSS**: 3.x

## Development Conventions
- TypeScript strict mode — no `any` types, no `@ts-ignore`
- kebab-case for files, PascalCase for React components
- Conventional commits: `feat:`, `fix:`, `chore:`, `perf:`, `docs:`
- All TF.js training runs in a Web Worker — never on the main thread
- Canvas 2D for all high-frequency rendering (network graph, weight heatmaps)
- D3.js only for the metrics charts panel
- Unit tests for data transforms and model compilation before committing

## Current Phase
**Phase 0: Foundation**
See IMPLEMENTATION-ROADMAP.md for full phase details, architecture, data models, and acceptance criteria.

## Key Decisions
| Decision | Choice | Why |
|----------|--------|-----|
| ML Runtime | TensorFlow.js Layers API | Keras-like API maps to "build a network" UX. WebGPU backend available. |
| Training execution | Web Worker + Comlink | Keeps main thread free for 20+ FPS visualization during training |
| Rendering | Canvas 2D (network) + D3 (charts) | Canvas handles heatmaps at interactive frame rates; SVG would choke on large networks |
| State management | Zustand | Lighter than Redux, no boilerplate, sufficient for this app's complexity |
| Network definition | JSON schema (LayerConfig[]) | Serializable for URL sharing, validatable, decoupled from TF.js internals |
| Dataset caching | IndexedDB via idb-keyval | Avoids re-downloading 11-60MB datasets on every visit |
| Backend fallback | WebGPU → WebGL → WASM | Progressive enhancement for broadest browser support |
| Deployment | Next.js static export → Vercel | Zero server costs, edge CDN, free tier handles educational traffic |

## Do NOT
- Do not run TensorFlow.js training on the main thread — always use the Web Worker
- Do not use SVG or D3 for the network graph or weight heatmaps — use Canvas 2D
- Do not use class components — hooks only
- Do not add features not in the current phase of IMPLEMENTATION-ROADMAP.md
- Do not add user accounts, analytics, cookies, or any telemetry
- Do not render all 784 MNIST input neurons — use compressed input layer representation
- Do not fetch datasets on every page load — check IndexedDB cache first
