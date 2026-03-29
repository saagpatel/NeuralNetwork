# Neural Network Playground

An interactive, in-browser neural network playground where you architect custom networks (dense + CNN layers), train them on real visual datasets, and watch weights, activations, loss curves, and confusion matrices update in real time. Zero backend — all training runs client-side via TensorFlow.js.

**Live demo:** https://neural-network-playground.vercel.app

---

## Features

- Build dense and convolutional networks layer-by-layer
- Train on MNIST, Fashion-MNIST, and CIFAR-10 (datasets cached in IndexedDB)
- Real-time weight heatmaps rendered on Canvas 2D during training
- Loss/accuracy curves (D3.js), confusion matrix, and per-layer activation viewer
- Overfitting demo mode — watch train loss diverge from val loss live
- Guided tutorials: "What is a Neuron?", "Why Overfitting Happens", "How CNNs See Images"
- URL sharing — encode full network config + dataset into a hash link
- Dark/light mode with localStorage persistence
- WebGPU → WebGL → WASM backend fallback for broadest browser support

---

## Running Locally

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

### CIFAR-10 Data Prep

CIFAR-10 requires converting the binary batch files to a single `.bin` before serving:

```bash
node scripts/prepare-cifar10.js
```

Download the CIFAR-10 binary format from https://www.cs.toronto.edu/~kriz/cifar.html, place the batch files in `data/cifar-10-batches-bin/`, then run the script. Output goes to `public/datasets/cifar10/`.

---

## Tech Stack

| Layer | Library |
|-------|---------|
| Framework | Next.js 14 (App Router, static export) |
| ML Runtime | TensorFlow.js 4.x + WebGPU backend |
| Training execution | Web Worker + Comlink (keeps main thread free) |
| Network graph | Canvas 2D (weight heatmaps at interactive frame rates) |
| Metrics charts | D3.js 7.x (lazy-loaded) |
| State | Zustand 4.x |
| Dataset caching | IndexedDB via idb-keyval |
| URL sharing | LZ-string (compressed hash params) |
| Styling | Tailwind CSS 3.x |

---

## Architecture

```
src/
  app/              Next.js app router
  components/
    playground/     PlaygroundShell + all panel components
  constants/        Presets, tutorials, dataset metadata, defaults
  lib/              Backend selector, model compiler, dataset loader, URL state
  stores/           Zustand stores (architecture, training, UI)
  types/            Shared TypeScript types
  workers/          Training Web Worker + Comlink API
```

Training runs entirely in a Web Worker. The main thread receives weight snapshots and metrics via structured-clone messages and renders them on Canvas 2D without blocking the UI.

---

## License

MIT — see [LICENSE](LICENSE).
