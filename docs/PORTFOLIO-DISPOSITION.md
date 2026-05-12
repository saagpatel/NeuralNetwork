# Neural Network Playground — Portfolio Disposition

**Status:** Release Frozen (static-host, pure static SPA with
TensorFlow.js client-side training) — TypeScript + React + D3 +
**TensorFlow.js** + IndexedDB browser-only neural network
playground on `origin/feat/phase-3-polish-sharing-deployment`
(**feat-branch-as-default trap** — origin/HEAD points to feat
branch). Production-deployed at
`https://neural-network-playground.vercel.app`. Includes Vercel
deploy config (framework null for static export), security
headers, social share metadataBase, accessibility audit fixes
(contrast + form labels), Next.js 14.2.35 vulnerability patch.
**Fifth static-host cluster member.** Joins static SPA sub-shape
(alongside HowMoneyMoves), but with substantial **client-side
ML compute** as a distinguishing feature.

> Disposition uses strict `origin/HEAD` verification.
> **Feat-branch-as-default trap**: PR base must target
> `feat/phase-3-polish-sharing-deployment`, not `main`.

---

## Verification posture

Only `origin` (`saagpatel/NeuralNetwork`). Clean migration state.
**`origin/HEAD → refs/heads/feat/phase-3-polish-sharing-deployment`**
— feat-branch-as-default trap variant (third occurrence after
BrowserHistoryVisualizer, Terroir, JobMarketHeatmap).

`origin/feat/phase-3-polish-sharing-deployment`:

- Tip: `c9476cb` fix: upgrade Next.js 14.2.29 → 14.2.35 to patch
  high-severity vulnerabilities
- Production-hardening cadence:
  - `c9476cb` Next.js 14.2.35 security patch
  - `dadaabd` perf: fix accessibility audit findings (contrast,
    form labels)
  - `c28b2d8` chore: add security headers and vercel deploy config
  - `f1c4c54` chore: set framework null for static export on Vercel
  - `66ae478` fix: set metadataBase for correct social share URLs
- **Already deployed**: `https://neural-network-playground.vercel.app`
- Default branch (per `origin/HEAD`): `feat/phase-3-polish-sharing-deployment`

---

## Current state in one paragraph

Neural Network Playground is an in-browser TypeScript + React +
D3 + TensorFlow.js neural network instructional tool. Users build
custom networks (dense + CNN layers) via a UI, train on **MNIST /
Fashion-MNIST / CIFAR-10** (cached in IndexedDB after first
download), and watch weight heatmaps, loss/accuracy curves,
confusion matrices, and per-layer activations update **in real
time on the user's own machine** — no backend, all compute is
client-side via TensorFlow.js. Three guided tutorials ("What is a
Neuron?", "Why Overfitting Happens", "How CNNs See Images") and
an "overfitting demo mode" (train loss diverges from validation
loss live). **URL sharing**: full network config + dataset
encoded into a compressed hash link. Per memory: Phase 3
complete. The release commits confirm Vercel static export +
security headers + accessibility audit fixes + vulnerability
patch — production-deployed and operationally hardened.

---

## Why "Release Frozen (static-host, client-side ML)" — fifth cluster member

Static SPA sub-shape with substantial client-side compute:

| Member | Sub-shape | Compute |
|---|---|---|
| PomGambler | PWA | Light client-side |
| HowMoneyMoves | Static SPA | Pure presentation |
| Premise | SSR + Supabase | Server-side via Supabase |
| Devil's Advocate | Next.js + SQLite | Server-side via Anthropic |
| **Neural Network Playground** | **Static SPA + heavy client-side ML (TensorFlow.js)** | **Client-side training** |

The client-side ML compute is distinguishing: training neural
networks in the browser tab is computationally expensive (CIFAR-10
training can spike CPU and warm laptops). UX needs to communicate
this — `dadaabd` accessibility audit + form labels suggest the
operator has done UX polish.

---

## Cluster taxonomy update

| Cluster | Count | Sub-shapes |
|---|---|---|
| **Static-host (web)** | **5** | PWA / static SPA (2: HowMoneyMoves + NeuralNetwork) / SSR+Supabase / Next.js+SQLite |
| (others unchanged) | | |

Static SPA sub-shape now has 2 members.

---

## Unblock trigger (operator)

Production-deployed at `https://neural-network-playground.vercel.app`
— **already shipped**. Operational concerns:

1. **Branch consolidation decision** — merge
   `feat/phase-3-polish-sharing-deployment` → `main` and update
   `origin/HEAD` for less branch-naming overhead.
2. **TensorFlow.js version pinning + monitoring** — TF.js evolves
   quickly; verify pinned version periodically.
3. **CIFAR-10 IndexedDB cache size** — CIFAR-10 is ~163 MB; verify
   IndexedDB quota handling for users with limited storage.
4. **Mobile UX** — neural network training on phones is
   battery-punishing. Verify graceful degradation or warning.
5. **GitHub Actions CI / deploy automation** — verify Vercel auto-
   deploy from main is set up (or the chosen canonical branch).
6. **Continued accessibility audits** — `dadaabd` did one pass;
   future visualizations (D3, Canvas) may need additional WCAG
   contrast / form label verification.

Estimated operator time for branch consolidation: ~30 minutes.

---

## Portfolio operating system instructions

| Aspect | Posture |
|---|---|
| Portfolio status | `Release Frozen (static-host, client-side ML)` |
| Distribution channel | **Vercel** (deployed) |
| Live URL | `https://neural-network-playground.vercel.app` |
| Review cadence | Suspend overdue counting |
| Resurface conditions | (a) Branch consolidation, (b) TF.js major version, (c) accessibility regression, (d) v1.1 (more datasets, more layer types, transfer learning) |
| Co-batch with | Static-host cluster — **now 5 repos** |
| Sub-shape | **Static SPA + client-side ML (TensorFlow.js)** |
| Special concern | **Feat-branch-as-default trap.** Operator may want to consolidate to `main`. |
| Special concern | **Client-side ML CPU / battery cost.** Mobile UX warning recommended. |
| Special concern | **CIFAR-10 IndexedDB ~163 MB cache.** Storage quota handling. |

---

## Reactivation procedure

1. **Re-confirm `origin/HEAD`** — may change if operator consolidates.
2. Review stash `r16-nn-stash` (untracked `.claude/` only —
   minimal carryover).
3. **Decide branch consolidation** for `main` ↔ feat branch.
4. Verify TF.js version against current upstream.
5. Test CIFAR-10 load + train on a clean browser profile (cache
   miss path).
6. Run `pnpm test` + `pnpm build` (Next static export).

---

## Last known reference

| Field | Value |
|---|---|
| `origin/HEAD` | `refs/heads/feat/phase-3-polish-sharing-deployment` |
| Tip | `c9476cb` fix: upgrade Next.js 14.2.29 → 14.2.35 to patch high-severity vulnerabilities |
| Default branch | **`feat/phase-3-polish-sharing-deployment`** (NOT `main`) |
| Build system | TypeScript + React + D3 + TensorFlow.js + Next.js + Vercel static export |
| Phases shipped | Phase 3 (sharing + deployment) complete on canonical default; production-deployed |
| Live URL | `https://neural-network-playground.vercel.app` |
| Datasets | MNIST + Fashion-MNIST + CIFAR-10 (IndexedDB cached) |
| Compute model | **Client-side TF.js training** (no backend) |
| Migration state | No `legacy-origin` remote |
| Distinguishing feature | **Fifth static-host cluster member; second static SPA sub-shape member (alongside HowMoneyMoves). First with heavy client-side ML compute.** Already deployed to Vercel. Feat-branch-as-default trap. |
