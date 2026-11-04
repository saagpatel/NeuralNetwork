# NeuralNetwork

## Purpose

NeuralNetwork is a zero-backend Next.js playground for building, training, and inspecting neural networks in the browser. TensorFlow.js training runs in a Web Worker. Keep model configuration serializable for URL sharing.

## Layout

- `src/app/` contains the static-exported Next.js application.
- `src/components/playground/` contains the playground UI.
- `src/workers/` contains the training worker and Comlink API.
- `src/lib/`, `src/stores/`, and `src/types/` contain application logic, state, and contracts.
- `scripts/` contains dataset preparation utilities.

## Setup

- Use the Node version in `.node-version` and pnpm version in `package.json`.
- Install dependencies with `pnpm install --frozen-lockfile`.
- Run the development app with `pnpm dev`.
- CIFAR-10 binaries are local generated assets and are not committed.

## Checks

- Run `make check` for typecheck, formatting, lint, tests, and static build.
- Use `pnpm preview` to serve the generated `out/` directory.
- For playground UI, training, sharing, or visualization changes, inspect the affected browser flow.
- Local fixtures do not establish real dataset, GPU, hosted CI, or deployed behavior.

## Boundaries

- Keep the app client-side and zero-backend unless explicitly requested.
- Keep TensorFlow.js training off the main thread.
- Use Canvas for frequent drawing and D3 for charts.
- Do not commit large CIFAR-10 binary files.
- Preserve unrelated work and report unavailable verification lanes honestly.

## Delivery

- Make focused changes and review the complete diff before delivery.
- Keep lockfile changes intentional and use the frozen lockfile for verification.
- Report checks run, their results, and any remaining uncertainty.
