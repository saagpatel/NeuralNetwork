# Neural Network Playground — Implementation Roadmap

## Architecture

### System Overview
```
[User Browser]
├── [React UI (Main Thread)]
│   ├── [Network Architect Panel] ← Zustand store ← LayerConfig[]
│   ├── [Canvas: Network Graph + Weight Heatmaps] ← weight snapshots from Worker
│   ├── [D3: Loss Curves + Metrics] ← training metrics from Worker
│   ├── [Dataset Selector + Preview] ← IndexedDB cache
│   └── [Controls: Train/Pause/Reset/Speed]
│
├── [Training Web Worker]
│   ├── [TF.js Runtime (WebGPU → WebGL → WASM fallback)]
│   ├── [Model Compiler: LayerConfig[] → tf.Sequential/tf.Model]
│   ├── [Training Loop: model.fit() with onEpochEnd/onBatchEnd callbacks]
│   └── [Weight Extractor: serialize layer weights as Float32Arrays]
│
└── [IndexedDB]
    ├── [Cached datasets (MNIST, Fashion-MNIST, CIFAR-10)]
    └── [Saved model configs (future)]
```

**Data flow:**
1. User configures network architecture → `LayerConfig[]` stored in Zustand
2. User clicks Train → main thread posts `LayerConfig[]` + dataset ID + hyperparams to Worker via Comlink
3. Worker compiles model, loads dataset from IndexedDB (or fetches + caches), starts `model.fit()`
4. Every N batches, Worker posts `TrainingUpdate` message to main thread (metrics + weight snapshots)
5. Main thread updates Zustand store → React re-renders loss curves, Canvas repaints weight heatmaps
6. User can pause/resume/reset from main thread → control messages to Worker

### File Structure
```
neural-network-playground/
├── public/
│   └── datasets/              # Hosted dataset files (MNIST .bin, etc.)
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout with metadata, fonts
│   │   ├── page.tsx           # Main playground page
│   │   └── globals.css        # Tailwind base + custom CSS vars
│   ├── components/
│   │   ├── playground/
│   │   │   ├── PlaygroundShell.tsx      # Main layout orchestrator
│   │   │   ├── NetworkArchitect.tsx     # Layer config panel (add/remove/edit layers)
│   │   │   ├── NetworkCanvas.tsx        # Canvas-based network graph + weight heatmaps
│   │   │   ├── TrainingControls.tsx     # Play/Pause/Reset/Speed/Epochs
│   │   │   ├── LossCurveChart.tsx       # D3-based real-time loss + accuracy curves
│   │   │   ├── ActivationViewer.tsx     # Per-layer activation heatmaps
│   │   │   ├── DatasetSelector.tsx      # Dataset picker with preview thumbnails
│   │   │   ├── HyperparamPanel.tsx      # Learning rate, optimizer, batch size, regularization
│   │   │   └── ConfusionMatrix.tsx      # Live confusion matrix during training
│   │   └── ui/
│   │       ├── Slider.tsx              # Reusable slider component
│   │       ├── Select.tsx              # Dropdown select
│   │       ├── Button.tsx              # Styled button variants
│   │       └── Tooltip.tsx             # Info tooltips for ML concepts
│   ├── workers/
│   │   ├── training.worker.ts          # Web Worker: TF.js training loop
│   │   └── training.api.ts            # Comlink-wrapped typed API for the worker
│   ├── lib/
│   │   ├── model-compiler.ts          # LayerConfig[] → tf.Sequential model
│   │   ├── dataset-loader.ts          # Fetch, parse, cache datasets in IndexedDB
│   │   ├── weight-extractor.ts        # Extract + serialize layer weights for viz
│   │   ├── network-layout.ts          # Calculate node positions for canvas rendering
│   │   └── backend-selector.ts        # WebGPU → WebGL → WASM fallback chain
│   ├── stores/
│   │   ├── architecture-store.ts      # Zustand: LayerConfig[], add/remove/edit actions
│   │   ├── training-store.ts          # Zustand: training state, metrics history, weight snapshots
│   │   └── ui-store.ts               # Zustand: panel visibility, selected layer, viz options
│   ├── types/
│   │   └── index.ts                   # All shared TypeScript interfaces
│   └── constants/
│       ├── datasets.ts                # Dataset metadata (name, shape, classes, URL)
│       ├── presets.ts                 # Pre-built network architecture templates
│       └── defaults.ts               # Default hyperparameters
├── CLAUDE.md
├── IMPLEMENTATION-ROADMAP.md
├── next.config.js                     # Static export config
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### Data Model

No traditional database. All state is in-memory (Zustand) and browser storage (IndexedDB).

**IndexedDB stores:**
- `nnp-datasets`: Cached dataset binaries keyed by DatasetId
  - Key: `'mnist'` | `'fashion-mnist'` | `'cifar10'`
  - Value: `{ trainX: ArrayBuffer, trainY: ArrayBuffer, testX: ArrayBuffer, testY: ArrayBuffer, shape: number[], numClasses: number }`

### Type Definitions

```typescript
// === Network Architecture ===

type LayerType = 'dense' | 'conv2d' | 'maxPooling2d' | 'flatten' | 'dropout';

type ActivationFn = 'relu' | 'sigmoid' | 'tanh' | 'softmax' | 'linear' | 'leakyRelu' | 'elu' | 'swish';

interface DenseLayerConfig {
  type: 'dense';
  units: number;
  activation: ActivationFn;
}

interface Conv2DLayerConfig {
  type: 'conv2d';
  filters: number;
  kernelSize: number;
  strides: number;
  activation: ActivationFn;
  padding: 'same' | 'valid';
}

interface MaxPooling2DLayerConfig {
  type: 'maxPooling2d';
  poolSize: number;
  strides: number;
}

interface FlattenLayerConfig {
  type: 'flatten';
}

interface DropoutLayerConfig {
  type: 'dropout';
  rate: number;
}

type LayerConfig = DenseLayerConfig | Conv2DLayerConfig | MaxPooling2DLayerConfig | FlattenLayerConfig | DropoutLayerConfig;

interface NetworkConfig {
  layers: LayerConfig[];
  inputShape: number[];  // e.g., [28, 28, 1] for MNIST
}

// === Training ===

type OptimizerType = 'sgd' | 'adam' | 'rmsprop' | 'adagrad';

type RegularizationType = 'none' | 'l1' | 'l2';

interface TrainingConfig {
  optimizer: OptimizerType;
  learningRate: number;
  batchSize: number;
  epochs: number;
  validationSplit: number;         // 0.0 - 1.0
  regularization: RegularizationType;
  regularizationRate: number;
}

interface TrainingUpdate {
  epoch: number;
  batch: number;
  totalBatches: number;
  trainLoss: number;
  trainAccuracy: number;
  valLoss: number | null;          // null during batch updates (only on epoch end)
  valAccuracy: number | null;
  weightSnapshots: WeightSnapshot[];
  activationSnapshots: ActivationSnapshot[] | null;  // optional, every N epochs
  elapsedMs: number;
}

interface WeightSnapshot {
  layerIndex: number;
  layerName: string;
  weights: Float32Array;           // flattened weight matrix
  biases: Float32Array;
  shape: number[];                 // original weight tensor shape
}

interface ActivationSnapshot {
  layerIndex: number;
  layerName: string;
  activations: Float32Array;       // activations for a sample batch
  shape: number[];
}

// === Worker Messages ===

interface WorkerStartMessage {
  type: 'start';
  networkConfig: NetworkConfig;
  trainingConfig: TrainingConfig;
  datasetId: DatasetId;
  snapshotEveryNBatches: number;
}

interface WorkerControlMessage {
  type: 'pause' | 'resume' | 'stop';
}

type WorkerInboundMessage = WorkerStartMessage | WorkerControlMessage;

interface WorkerUpdateMessage {
  type: 'update';
  data: TrainingUpdate;
}

interface WorkerCompleteMessage {
  type: 'complete';
  finalMetrics: { trainLoss: number; trainAccuracy: number; valLoss: number; valAccuracy: number };
}

interface WorkerErrorMessage {
  type: 'error';
  error: string;
}

type WorkerOutboundMessage = WorkerUpdateMessage | WorkerCompleteMessage | WorkerErrorMessage;

// === Datasets ===

type DatasetId = 'mnist' | 'fashion-mnist' | 'cifar10';

interface DatasetMeta {
  id: DatasetId;
  name: string;
  description: string;
  inputShape: number[];            // [28, 28, 1] for MNIST
  numClasses: number;
  trainSize: number;
  testSize: number;
  downloadSizeMB: number;
  classLabels: string[];
  url: string;                     // URL to fetch the preprocessed binary
}

// === Visualization ===

interface NetworkLayoutNode {
  layerIndex: number;
  neuronIndex: number;
  x: number;
  y: number;
  activation: number;              // current activation value (0-1 range, normalized)
}

interface NetworkLayoutEdge {
  fromLayer: number;
  fromNeuron: number;
  toLayer: number;
  toNeuron: number;
  weight: number;
}

interface MetricsHistoryPoint {
  epoch: number;
  trainLoss: number;
  trainAccuracy: number;
  valLoss: number;
  valAccuracy: number;
}
```

### API Contracts

**External APIs:** None. Zero-backend architecture.

**Dataset hosting:** Datasets are served as static binary files from `/public/datasets/`. Format: raw Float32 arrays pre-normalized to [0, 1]. No external API calls for data.

| Asset | URL Pattern | Format | Size |
|-------|-------------|--------|------|
| MNIST Train Images | `/datasets/mnist-train-images.bin` | Float32Array [60000×784] | ~188MB raw, served gzipped ~23MB |
| MNIST Train Labels | `/datasets/mnist-train-labels.bin` | Uint8Array [60000] | 60KB |
| MNIST Test Images | `/datasets/mnist-test-images.bin` | Float32Array [10000×784] | ~31MB raw |
| MNIST Test Labels | `/datasets/mnist-test-labels.bin` | Uint8Array [10000] | 10KB |
| Fashion-MNIST | Same structure as MNIST | Same | Same |
| CIFAR-10 Train Images | `/datasets/cifar10-train-images.bin` | Float32Array [50000×3072] | ~614MB raw, served gzipped ~150MB |
| CIFAR-10 Train Labels | `/datasets/cifar10-train-labels.bin` | Uint8Array [50000] | 50KB |

**Note:** For MVP, consider hosting pre-processed datasets on a CDN (e.g., Vercel's built-in CDN via /public) rather than bundling in the repo. The dataset-loader should fetch from a configurable base URL.

**Alternative approach for MNIST (lighter):** Use the TF.js MNIST data utilities pattern — fetch the original IDX format files (~11MB compressed total for MNIST) and parse them client-side. This avoids serving 200MB+ of pre-processed floats. The dataset-loader should:
1. Fetch compressed IDX files
2. Parse the IDX binary format (4 magic bytes, dimensions, pixel data as Uint8)
3. Normalize to Float32 [0, 1]
4. Cache the processed Float32Arrays in IndexedDB

### Dependencies
```bash
# Create project
npx create-next-app@latest neural-network-playground --typescript --tailwind --app --eslint --src-dir

# Core dependencies
npm install @tensorflow/tfjs@4 @tensorflow/tfjs-backend-webgpu@4 zustand@4 d3@7 comlink@4 idb-keyval@6

# Dev dependencies
npm install -D @types/d3@7
```

## Scope Boundaries

**In scope:**
- Dense, Conv2D, MaxPooling2D, Flatten, Dropout layers
- MNIST, Fashion-MNIST, CIFAR-10 datasets
- Real-time weight heatmaps, activation viewer, loss curves, confusion matrix
- Network architecture editor with validation
- Hyperparameter controls (LR, optimizer, batch size, regularization)
- Train/Pause/Reset controls
- Overfitting demonstration mode
- URL-based config sharing
- Dark mode
- 3 guided tutorials
- Open-source README + MIT license

**Out of scope:**
- User accounts or authentication
- Server-side training or inference
- RNN/LSTM/Transformer layers
- Custom dataset uploads
- Model export/download
- Collaborative/shared training sessions
- Gradient flow / backprop animation
- Mobile-first design (responsive but desktop-primary)

**Deferred:**
- Tauri desktop packaging (post-Phase 3)
- Custom dataset upload (Phase 4+)
- Model export as TF.js JSON (Phase 4+)
- Attention mechanism visualization (Phase 4+)

## Security & Credentials

- **Credentials:** None required. Zero-backend architecture.
- **Data boundaries:** Nothing leaves the browser. All training, inference, and visualization are client-side. No telemetry, no analytics, no external API calls.
- **Encryption:** Not applicable — no sensitive data.
- **Privacy:** No cookies, no localStorage for tracking, no third-party scripts.

---

## Phase 0: Foundation (Week 1)

**Objective:** Scaffolded Next.js project with TF.js training running in a Web Worker, MNIST dataset loading with IndexedDB caching, and a working model compiler.

**Tasks:**
1. Scaffold Next.js project with all dependencies installed — **Acceptance:** `npm run dev` serves blank page at localhost:3000, zero TypeScript errors
2. Create all type definitions in `src/types/index.ts` from the Type Definitions section above — **Acceptance:** Types compile with zero errors in strict mode
3. Implement `src/lib/backend-selector.ts` — detect WebGPU availability, set TF.js backend with fallback chain: WebGPU → WebGL → WASM — **Acceptance:** Console logs `"TF.js backend: webgpu"` (or `"webgl"` on unsupported browsers) on page load
4. Implement `src/lib/dataset-loader.ts` — fetch MNIST IDX files, parse binary format, normalize to Float32 [0,1], cache processed arrays in IndexedDB via idb-keyval — **Acceptance:** Call `loadDataset('mnist')` → returns `{trainImages: Float32Array, trainLabels: Uint8Array, testImages: Float32Array, testLabels: Uint8Array}` with correct sizes (60000×784 train, 10000×784 test). Second call loads from IndexedDB cache in <500ms.
5. Implement `src/lib/model-compiler.ts` — convert `NetworkConfig` (LayerConfig[] + inputShape) to a compiled `tf.Sequential` model — **Acceptance:** Compile `{inputShape: [28,28,1], layers: [{type:'flatten'}, {type:'dense', units:128, activation:'relu'}, {type:'dense', units:10, activation:'softmax'}]}` → model with 101,770 trainable parameters. Compile with `{loss: 'categoricalCrossentropy', optimizer: 'adam', metrics: ['accuracy']}`.
6. Implement `src/workers/training.worker.ts` — Web Worker that: receives `WorkerStartMessage`, compiles model, loads dataset, runs `model.fit()` with `onBatchEnd`/`onEpochEnd` callbacks, posts `TrainingUpdate` messages every N batches — **Acceptance:** Post start message from main thread with default MNIST config → receive ≥10 `WorkerUpdateMessage`s → receive `WorkerCompleteMessage` with accuracy >90% after 5 epochs
7. Implement `src/lib/weight-extractor.ts` — extract weights and biases from all layers as `WeightSnapshot[]` — **Acceptance:** After 1 training epoch, extract weights → each snapshot has correct `shape` matching layer config, `weights` is a Float32Array with `shape[0] × shape[1]` elements
8. Implement `src/workers/training.api.ts` — Comlink-wrapped typed API for the worker — **Acceptance:** From React component, call `trainingWorker.start(config)` and receive typed `TrainingUpdate` callbacks
9. Implement Zustand stores: `architecture-store.ts` (LayerConfig[] with add/remove/edit actions), `training-store.ts` (training state, metrics history, weight snapshots), `ui-store.ts` (panel visibility, selected layer) — **Acceptance:** Zustand devtools show all three stores with correct initial state
10. Implement `src/constants/datasets.ts` (dataset metadata), `presets.ts` (3 dense network templates), `defaults.ts` (default hyperparams: Adam, lr=0.001, batch=64, epochs=10, valSplit=0.2) — **Acceptance:** All constants importable, TypeScript-typed correctly

**Verification checklist:**
- [ ] `npm run build` → zero errors, zero warnings
- [ ] `npm run dev` → loads at localhost:3000
- [ ] Browser console → `"TF.js backend: webgpu"` or `"webgl"`
- [ ] Manual test (console): `loadDataset('mnist')` → returns correct tensor shapes
- [ ] Manual test (console): trigger training of dense [128,64,10] on MNIST via worker → console logs epoch metrics, accuracy >90% after 5 epochs
- [ ] IndexedDB (DevTools → Application → IndexedDB) → dataset cached after first load
- [ ] Second page load → dataset loads from cache (no network request visible in Network tab)
- [ ] Zustand devtools → 3 stores visible with correct initial state

**Risks:**
- **Risk:** TF.js in Web Worker may not auto-detect WebGPU backend
  - Mitigation: Explicitly call `tf.setBackend('webgpu')` inside worker scope before any tensor ops. Import the WebGPU backend package in the worker file.
  - Fallback: If WebGPU fails in worker context, call `tf.setBackend('webgl')` — WebGL is well-tested in workers
- **Risk:** MNIST IDX binary format parsing edge cases (endianness, header format)
  - Mitigation: Use the well-documented IDX format spec. MNIST uses big-endian — use DataView for reading. Reference the TF.js MNIST example for the parsing code.
  - Fallback: Host pre-processed JSON arrays (larger download but simpler parsing)
- **Risk:** Comlink may have issues with transferable objects (Float32Arrays in training updates)
  - Mitigation: Use Comlink's `transfer()` utility for weight snapshots to avoid copying large arrays
  - Fallback: Use raw `postMessage` with transfer list instead of Comlink

---

## Phase 1: Core Visualization + MVP UI (Weeks 2-3)

**Objective:** Full playground UI with network architecture editor, real-time training visualization (Canvas network graph + D3 loss curves + weight heatmaps), train/pause/reset controls, and visible overfitting on small datasets.

**Tasks:**
1. Build `PlaygroundShell.tsx` — responsive main layout with 4 zones: left panel (network architect + hyperparams, ~280px), center (network canvas, flexible), right panel (metrics + charts, ~320px), bottom bar (training controls + epoch counter) — **Acceptance:** Layout renders correctly at 1440px, 1280px, and 1024px. All 4 zones visible. Panels are collapsible.
2. Build `NetworkArchitect.tsx` — interactive list of layers with: add layer button (dropdown: Dense, Flatten, Dropout), remove layer button per layer, per-layer config (units slider for Dense: 16-512, activation dropdown). Shows param count per layer and total. — **Acceptance:** Add 3 dense layers (128, 64, 10), configure activations (relu, relu, softmax), see total params update. Remove middle layer → remaining layers re-index correctly.
3. Build `HyperparamPanel.tsx` — controls for: learning rate (slider, log scale: 0.0001 to 1.0, default 0.001), optimizer (dropdown: SGD, Adam, RMSProp, Adagrad), batch size (dropdown: 16, 32, 64, 128, 256), epochs (number input, default 10), validation split (slider 0.1-0.5, default 0.2), regularization type (none, L1, L2) + rate (slider 0.0001-0.1) — **Acceptance:** All controls render, values flow into Zustand training config store.
4. Build `NetworkCanvas.tsx` — Canvas 2D rendering: nodes arranged in columns by layer, edges colored by weight value (blue=positive, orange/red=negative, opacity=magnitude). Input layer rendered as compressed 8×8 grid (not 784 individual nodes). Hidden layer nodes show activation heatmap fill. Output layer nodes labeled with class names. Weight heatmaps rendered as small matrix images per layer (hover to enlarge). — **Acceptance:** Render a 784→128→64→10 network. Edges color-coded by weight. Weight heatmaps visible per layer. Renders at ≥30 FPS when receiving weight snapshots at 2 Hz.
5. Build `LossCurveChart.tsx` — D3 line chart with: train loss (solid blue line), val loss (dashed blue line), train accuracy (solid green line), val accuracy (dashed green line). Auto-scaling Y-axes (loss left, accuracy right). Epoch numbers on X-axis. Tooltip on hover showing exact values. — **Acceptance:** During training, 4 lines animate in real-time. Chart rescales as values change. Hover tooltip shows epoch + exact metric values.
6. Build `TrainingControls.tsx` — horizontal bar with: Play/Pause toggle button, Reset button (re-initialize weights), epoch counter (`Epoch 3/10`), speed slider (snapshot frequency: every 1/5/10/20 batches), training status indicator (idle/training/paused/complete). — **Acceptance:** Play → training starts, button shows Pause icon. Pause → training pauses, button shows Play icon. Reset → weights re-initialize, loss curves clear, canvas shows random weights. Speed slider changes snapshot frequency in real-time.
7. Build `DatasetSelector.tsx` — card-based picker showing: dataset name, input dimensions, sample count, preview thumbnails (4 sample images per dataset). Download progress bar for first-time fetch. Green checkmark for cached datasets. — **Acceptance:** Show MNIST and Fashion-MNIST cards. Click Fashion-MNIST → progress bar during download → cached → subsequent selections are instant. Preview thumbnails render actual dataset samples.
8. Implement preset network templates in `src/constants/presets.ts`: "Simple Dense" (Flatten→128→10), "Deep Dense" (Flatten→256→128→64→10), "Wide Dense" (Flatten→512→256→10) — **Acceptance:** Each preset loads into the architect panel with correct layer configs. Dropdown selector at top of architect panel.
9. Wire end-to-end flow: dataset selector → architect → hyperparams → train → live visualization — **Acceptance:** From fresh page: select MNIST → use "Simple Dense" preset → click Train → loss curves animate, weight heatmaps update, epoch counter increments → after 5 epochs accuracy shows >95%.
10. Implement overfitting demo: button/toggle that limits training set to 500 random samples and disables regularization — **Acceptance:** Enable overfitting mode → train for 50 epochs → train loss drops near 0 by epoch 20 → val loss rises visibly after ~epoch 15 → clear visual divergence in loss chart. Add a label/annotation on the chart marking the divergence point.

**Verification checklist:**
- [ ] `npm run dev` → full playground UI renders with all panels
- [ ] Train "Simple Dense" on MNIST → loss curves animate smoothly (no jank)
- [ ] Weight heatmaps update at configured snapshot interval
- [ ] Pause → Resume → training continues correctly (metrics pick up where they left off)
- [ ] Reset → weights randomized (visible in canvas), loss curves clear
- [ ] Overfitting demo: train/test loss diverge visibly within 20 epochs on 500 samples
- [ ] Fashion-MNIST: loads, trains, shows different preview thumbnails
- [ ] Architect: add Dense(64) layer → total params update → new model trains successfully
- [ ] Architect: remove a hidden layer → model re-compiles → trains correctly
- [ ] Responsive: at 1024px width, all panels visible and functional
- [ ] Performance: Canvas rendering ≥20 FPS during active training (check via DevTools Performance tab)
- [ ] Lighthouse: performance score ≥85

**Risks:**
- **Risk:** Canvas rendering of 784-node input layer too slow
  - Mitigation: Don't render 784 nodes. Render input layer as a single 28×28 pixel thumbnail of the current input image, or an 8×8 compressed grid. Only render individual neurons for hidden and output layers.
  - Fallback: Collapse input layer to a single labeled rectangle ("Input: 28×28×1")
- **Risk:** D3 chart re-rendering on every training update causes main thread jank
  - Mitigation: Buffer metric updates in Zustand. Chart component subscribes with a selector and re-renders on `requestAnimationFrame` — max 60 updates/sec regardless of training speed.
  - Fallback: Reduce chart update to epoch-level only (not batch-level)
- **Risk:** Zustand re-renders cascading through unrelated components
  - Mitigation: Use Zustand selectors in every component — `useTrainingStore(s => s.metricsHistory)` not `useTrainingStore()`. This prevents re-renders when unrelated state changes.

---

## Phase 2: CNN Support + Advanced Visualizations (Weeks 4-5)

**Objective:** Full CNN layer support (Conv2D, MaxPooling2D, Flatten, Dropout) in the architect and compiler. Activation viewer for per-layer feature maps. Confusion matrix. CIFAR-10 dataset. Convolutional filter visualization.

**Tasks:**
1. Extend `NetworkArchitect.tsx` with Conv2D config UI: filters (slider: 8-128, step 8), kernel size (dropdown: 3, 5, 7), strides (dropdown: 1, 2), padding (dropdown: same, valid), activation (dropdown). MaxPooling2D: pool size (dropdown: 2, 3), strides (dropdown: 1, 2). Flatten: no config (auto-placed). Dropout: rate slider (0.1-0.5, step 0.05). — **Acceptance:** Build LeNet: Conv2D(32,3,relu)→MaxPool(2)→Conv2D(64,3,relu)→MaxPool(2)→Flatten→Dense(128,relu)→Dropout(0.25)→Dense(10,softmax). Compiles successfully.
2. Extend `model-compiler.ts` to handle Conv2D, MaxPooling2D, Flatten, Dropout layers — **Acceptance:** Compile LeNet architecture → verify model.summary() shows ~100K trainable params. All layer types compile without error.
3. Implement architecture validation in `model-compiler.ts`: (a) Dense after Conv2D without Flatten → error, (b) Conv2D after Flatten → error, (c) MaxPooling that would reduce dimensions to 0 → error, (d) Last layer must be Dense with softmax, (e) Dropout rate must be 0 < rate < 1 — **Acceptance:** 5 invalid architecture tests all produce clear error messages. 5 valid architectures all compile.
4. Build `ActivationViewer.tsx` — panel that: lets user select a test image (grid of 20 random test samples), feeds it through the trained model, shows per-layer activation maps. For Conv layers: grid of feature maps (e.g., 32 small heatmaps for Conv2D with 32 filters). For Dense layers: horizontal bar chart of activations. For output layer: bar chart of class probabilities with predicted label highlighted. — **Acceptance:** Train LeNet on MNIST → select a "5" from test set → Conv1 shows 32 feature maps with visible edge patterns → Conv2 shows 64 more abstract patterns → Dense shows activation bars → Output shows highest bar on "5".
5. Build `ConfusionMatrix.tsx` — 10×10 grid (numClasses × numClasses) with: cell color intensity proportional to count, row labels (true class), column labels (predicted class), diagonal highlighted (correct predictions), tooltip showing count + percentage on hover. Updates at each epoch end. — **Acceptance:** After training MNIST to >95% → strong blue diagonal, faint off-diagonal cells. Hovering (4, 9) cell shows the count of 4s misclassified as 9s.
6. Implement CIFAR-10 dataset loader in `dataset-loader.ts` — **Acceptance:** Load CIFAR-10 (50K train × 3072, 10K test × 3072), preview thumbnails show recognizable 32×32 color images, CNN preset trains on it.
7. Add CIFAR-10 to `DatasetSelector.tsx` with appropriate preview thumbnails and size warning (60MB download) — **Acceptance:** CIFAR-10 card shows, has download size warning, downloads with progress bar, caches in IndexedDB.
8. Add CNN preset templates to `presets.ts`: "Simple CNN (MNIST)" (Conv32→Pool→Conv64→Pool→Flatten→Dense128→Dense10), "LeNet-5" (classic architecture), "Deep CNN (CIFAR-10)" (3 conv blocks + dense head) — **Acceptance:** Each preset loads, compiles, and trains on its target dataset.
9. Implement convolutional filter visualization: for Conv2D layers, render learned kernels as small grayscale images in a grid alongside the layer in NetworkCanvas — **Acceptance:** After training LeNet, Conv1 filters (3×3) show recognizable edge detector patterns.
10. Update `NetworkCanvas.tsx` to handle Conv/Pool/Flatten layers: Conv layers shown as stacked feature map rectangles, Pool layers shown as dimension-reducing arrows, Flatten shown as a transition from 2D to 1D — **Acceptance:** LeNet architecture renders with visually distinct layer type representations. Layer dimensions labeled (e.g., "26×26×32" for Conv output).

**Verification checklist:**
- [ ] Train LeNet on MNIST → >98% accuracy in <2 minutes
- [ ] Train "Deep CNN" on CIFAR-10 → >55% accuracy (realistic for small CNN, ~3 minutes)
- [ ] Activation viewer: select test image → meaningful feature maps for Conv layers
- [ ] Confusion matrix: updates each epoch, diagonal dominates after convergence
- [ ] Conv filter visualization: first-layer filters show edge-like patterns
- [ ] Invalid architecture (Dense after Conv, no Flatten) → clear error message displayed
- [ ] Dropout: training loss noisier than val loss during training (expected behavior)
- [ ] CIFAR-10 downloads with progress, caches, reloads from cache on second visit
- [ ] Network canvas: LeNet architecture renders with distinct Conv/Pool/Flatten/Dense visuals

**Risks:**
- **Risk:** CIFAR-10 (60MB raw, ~150MB as Float32) may cause browser memory pressure
  - Mitigation: Load CIFAR in batches — use tf.data.generator() to stream training data from IndexedDB in 1000-sample chunks instead of loading all 50K into a single tensor
  - Fallback: Ship "CIFAR-10 Lite" (10K train, 2K test) as default. Full dataset available via toggle with memory warning.
- **Risk:** Activation extraction for Conv layers is expensive (large feature maps × many filters)
  - Mitigation: Extract activations for exactly 1 sample image, only when user explicitly clicks a test image in the viewer. Don't extract during training. Use `tf.tidy()` to clean up intermediate tensors immediately.
  - Fallback: Show activations only for the first and last Conv layer, not intermediate ones

---

## Phase 3: Polish + Sharing + Deployment (Weeks 6-7)

**Objective:** URL-based state sharing, guided tutorials, dark mode, responsive refinement, performance optimization, open-source packaging, Vercel deployment.

**Tasks:**
1. Implement URL state encoding: serialize `{networkConfig, trainingConfig, datasetId}` to JSON → compress with LZ-string → encode as base64 URL hash fragment — **Acceptance:** Configure a custom network → URL updates in address bar → copy URL → paste in new tab → exact same config loads. URL length < 2000 chars for typical configs.
2. Build 3 guided tutorial presets as objects in `src/constants/tutorials.ts`. Each has: preset config, step-by-step explainer cards, highlighted UI elements. Tutorials: (a) "What is a Neuron?" — 1 hidden layer, 2D classification-like explanation, (b) "Why Overfitting Happens" — overfitting demo with annotations, (c) "How CNNs See Images" — LeNet on MNIST with activation viewer focus. — **Acceptance:** Tutorial selector in header → click tutorial → config loads, explainer cards appear as overlay steps.
3. Implement dark mode via Tailwind's `dark:` classes. Toggle button in header. Persist preference in localStorage (this is the only localStorage use — not tracking). Canvas and D3 charts must also adapt colors. — **Acceptance:** Toggle dark mode → all panels, charts, canvas, tooltips switch to dark palette. No white flashes, no unreadable text.
4. Responsive breakpoints: at ≤1024px, right panel moves below center canvas. At ≤768px, left panel collapses to a slide-out drawer. All controls remain accessible. — **Acceptance:** At 768px width, all features usable (may require scrolling). No overflow, no cut-off text.
5. Performance optimization pass: (a) Profile Canvas rendering — ensure no unnecessary redraws, (b) Memoize Zustand selectors, (c) Lazy-load D3 (dynamic import), (d) Lazy-load TF.js WebGPU backend, (e) Code-split the activation viewer and confusion matrix — **Acceptance:** 60 FPS sustained on M4 Mac during training. ≥30 FPS on 2020 Intel Mac. Time-to-interactive < 3 seconds.
6. Write `README.md`: project title + tagline + screenshot/GIF, feature list, "Try it" link, architecture overview diagram, getting started (clone, install, dev), tech stack, contributing guide, credits + inspiration (link to original TF Playground, CNN Explainer). — **Acceptance:** README renders correctly on GitHub with working links and visible screenshots.
7. Add MIT `LICENSE` file at project root — **Acceptance:** File exists, correct MIT text with current year and your name.
8. Configure `next.config.js` for static export: `output: 'export'`, configure `basePath` if needed, handle dynamic imports for Web Worker — **Acceptance:** `npm run build` produces `out/` directory. `npx serve out/` serves fully functional app.
9. Deploy to Vercel: connect GitHub repo, configure build settings — **Acceptance:** App live at `neural-network-playground.vercel.app` (or custom domain), all features work including Web Worker training.
10. Add `<head>` metadata in `layout.tsx`: title, description, Open Graph image (screenshot), Twitter card — **Acceptance:** Share URL on LinkedIn → shows preview card with title "Neural Network Playground" and screenshot.

**Verification checklist:**
- [ ] URL sharing: configure network → copy URL → new tab → same config loads
- [ ] URL length: typical config produces URL < 2000 characters
- [ ] Tutorials: all 3 load correctly with step-by-step explainer cards
- [ ] Dark mode: full toggle, no rendering artifacts, Canvas and D3 colors adapt
- [ ] 768px viewport: all panels accessible, no overflow
- [ ] `npm run build` → clean static export, no errors
- [ ] `npx serve out/` → app fully functional from static files
- [ ] Vercel: live URL loads in < 3 seconds, training works
- [ ] Open Graph: sharing on LinkedIn shows preview card
- [ ] README: complete, clear, no broken links
- [ ] Performance: 60 FPS on M4 Mac during training (DevTools Performance tab)

**Risks:**
- **Risk:** URL state with large CNN configs exceeds browser URL length limits (2083 chars in IE, ~8000 in modern browsers)
  - Mitigation: LZ-string compression typically achieves 40-60% compression on JSON. For configs that still exceed 2000 chars, show "Copy Config" button instead of URL hash.
  - Fallback: Use a simple JSON export/import clipboard flow instead of URL encoding
- **Risk:** Web Worker may not work correctly in Vercel's static export
  - Mitigation: Test worker loading in static export early in Phase 3. Workers need to be served as separate JS files — ensure Next.js build outputs the worker correctly.
  - Fallback: Use `worker-loader` webpack plugin or manually configure `next.config.js` to handle worker files
