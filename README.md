# ProcessLab

ProcessLab is a local-first business process modelling and simulation product. Users draw a workflow, define task duration, staffing and cost, then run a discrete-event simulation to expose queueing, capacity constraints, cost and bottlenecks.

The core product is intentionally independent of third-party business data and AI APIs. The user supplies the process inputs; ProcessLab owns the computation.

## Current prototype

- Visual drag-and-connect process builder
- Editable task duration, worker count and hourly cost
- Configurable monthly transaction volume and working capacity
- Seeded discrete-event simulation engine
- Queueing, workload, monthly capacity and processing-cost metrics
- Bottleneck detection
- Backlog detection when workload exceeds monthly capacity
- Unit tests for the simulation engine

## Stack

- Next.js 16
- React 19
- TypeScript
- Material UI
- React Flow
- Vitest

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Architecture

```text
src/
  app/                         Next.js app shell
  features/
    process-builder/           Visual workflow editor and UI mapping
    simulation/engine/         Framework-independent simulation domain
  theme/                       Material UI theme
```

The simulation engine has no dependency on React, Next.js, Material UI or React Flow. UI graph data is mapped into engine types at the feature boundary so that simulation logic remains portable and testable.

## Simulation assumptions in v0.1

- Exactly one starting task is required.
- Cyclic workflows are rejected for now.
- Multiple outgoing connections are treated as equally likely unless probabilities are supplied by a future UI.
- Working time is represented as compressed monthly business minutes. Nights, weekends and shift calendars are not modelled yet.
- Processing cost currently represents task labour consumed, not fixed monthly salary cost.

These constraints are deliberate. Later versions can add calendars, conditional branching, rework loops, fixed staffing cost, scenarios and richer stochastic distributions without coupling them to the UI.
