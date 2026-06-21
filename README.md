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
- Node.js 18+, pnpm

### Installation
```bash
pnpm install
```

### Usage
```bash
pnpm dev
# Open http://localhost:3000
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router, static export) |
| ML runtime | TensorFlow.js 4.x + WebGPU backend |
| Training execution | Web Worker + Comlink |
| Network graph | Canvas 2D (weight heatmaps) |
| Charts | D3.js 7.x |
| State | Zustand 4.x |
| Dataset caching | IndexedDB via idb-keyval |
| URL sharing | LZ-string (compressed hash params) |
| Styling | Tailwind CSS 3.x |

## License

MIT
