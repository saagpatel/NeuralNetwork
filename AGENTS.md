# NeuralNetwork

## Communication Contract

- Inherit the global Codex communication contract from `~/.codex/AGENTS.md`.
- Keep this file focused on NeuralNetwork-specific product, safety, and verification rules.

## Project Goal

NeuralNetwork is a zero-backend Next.js playground for training and inspecting real neural networks in the browser with TensorFlow.js, Web Workers, Canvas, D3, and IndexedDB dataset caching. Keep learning workflows client-side, fast, and inspectable.

## First Read

- `README.md` for product scope, local commands, and known dataset constraints.
- `CLAUDE.md` for portfolio context and current state.
- `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` before dependency or script changes.
- `src/workers/`, `src/lib/`, `src/components/playground/`, and `src/stores/` before changing training, datasets, visualization, or UI state.

## Core Rules

- Keep the app zero-backend unless explicitly requested.
- Do not commit large CIFAR-10 binary dataset files.
- Keep TensorFlow.js training off the main UI thread.
- Use Canvas for high-frequency rendering paths; use D3 only for charts.
- Preserve URL-shareable, serializable model configuration shapes.

## Codex App Usage

- Use Codex App Projects for repo-local implementation, review, and verification.
- Use a Worktree for dependency upgrades, TensorFlow/backend changes, dataset/cache behavior, worker contracts, or larger UI rewrites.
- Use browser or Playwright evidence for playground UI, training controls, visualization, sharing, and responsive behavior changes.
- Use artifacts for reusable tutorial notes, course/teaching handoffs, and generated QA summaries.
- Keep connectors read-first and task-scoped. Do not pull external data unless the user explicitly asks.

## Verification

- Follow [README verification](README.md#verification) for the supported Node/pnpm versions, focused fixture checks, full tests, lint, build, and conditional browser checks.
- Use `.codex/verify.commands` as the routine command sequence. Keep frozen-lockfile verification separate from intentional dependency updates.
- Report unavailable lanes explicitly. Local fixtures do not establish real-dataset, GPU, provider, or deployed behavior.

## Done Criteria

- The requested change is implemented.
- Relevant checks were run, or the exact reason they were not run is stated.
- UI/training behavior changes include browser or Playwright evidence.
- Assumptions, risks, and next steps are summarized before closeout.
