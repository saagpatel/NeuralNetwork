# NeuralNetwork

## Communication Contract

- Follow `/Users/d/.codex/policies/communication/BigPictureReportingV1.md` for user-facing updates.
- Keep default updates beginner-friendly, big-picture, and low-noise.
- Keep technical receipts in internal notes unless the user asks for details or a failure needs escalation.

## Project Goal

NeuralNetwork is a zero-backend Next.js playground for training and inspecting real neural networks in the browser with TensorFlow.js, Web Workers, Canvas, D3, and IndexedDB dataset caching. Keep learning workflows client-side, fast, and inspectable.

## First Read

- `README.md` for product scope, local commands, and known dataset constraints.
- `CLAUDE.md` for portfolio context and current state.
- `package.json` and `package-lock.json` before dependency or script changes.
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

- Use `.codex/verify.commands` as the canonical verifier for routine Codex work.
- Current canonical verifier:
  - `npm ci`
  - `npm test`
  - `npm run build`
- Current caveat: the build passes with existing React hook dependency warnings in `ConfusionMatrix.tsx`; treat them as cleanup candidates unless the task touches that component.
- If dependency install fails because `package-lock.json` is stale, refresh the lockfile intentionally and rerun the canonical verifier.

## Done Criteria

- The requested change is implemented.
- Relevant checks were run, or the exact reason they were not run is stated.
- UI/training behavior changes include browser or Playwright evidence.
- Assumptions, risks, and next steps are summarized before closeout.
