# ProcessLab

ProcessLab is a self-contained, local-first business process modelling and simulation application. It lets users build a workflow, define staffing, cost and timing assumptions, simulate monthly transaction flow, identify capacity constraints, compare scenarios and stress-test growth without relying on external business data or AI APIs.

## ProcessLab V1

### Build

- Visual Start, Task, Decision and End workflow modelling
- Drag-and-connect process canvas
- Smart insertion of tasks and decisions into existing routes
- Decision-only branching with editable weighted probabilities
- Automatic probability rebalancing to 100%
- Task duration, worker count, hourly cost and duration variability
- Workflow validation for disconnected steps, illegal branching and cycles

### Simulate

- Seeded discrete-event simulation engine
- Task queues and worker availability
- Seeded triangular task-duration variability
- Weighted routing through decisions
- Monthly throughput and month-end carryover
- Labour processing cost and cost per transaction
- Per-task utilisation, queue time, capacity and visit counts
- Route-level simulated visit counts
- Capacity constraint detection

### Replay

- Deterministic sampled transaction event trace
- Real simulated arrivals, queue entry, processing, routing and completion
- Play, pause, restart and 0.5x / 1x / 2x / 4x controls
- Live sampled queue and processing state on the canvas
- Animated sampled route events
- Up to 24 representative transactions are replayed; aggregate calculations always use the full simulated population

### Analyse

- Rule-based process insights with no AI dependency
- Capacity headroom estimates
- Queue concentration findings
- Labour-cost concentration findings
- Volume stress tests from 0.5x to 3x current volume
- First 80% capacity-warning volume
- First overloaded-volume estimate
- Quick baseline comparison
- Persistent named scenario snapshots

### Workspace

- Named projects
- Automatic browser-local persistence
- Blank workflow plus invoice, customer support, employee onboarding and order-fulfilment templates
- JSON project backup and restore
- Saved scenarios restored with the project
- Printable simulation report

## Architecture

```text
src/
  app/
    Next.js application shell

  features/
    process-builder/
      Canvas, workflow UI, templates, workspace persistence and reports

    simulation/
      engine/
        Framework-independent discrete-event simulation
      analysis.ts
        Deterministic rule-based findings
      stress-test.ts
        Volume stress analysis

  theme/
    Material UI theme
```

The simulation engine is deliberately independent of React, Next.js, Material UI and React Flow.

## Technology

- Next.js 16
- React 19
- TypeScript
- Material UI
- React Flow
- Vitest

ProcessLab V1 does not require an AI API, ERP API, CRM API, external dataset, or third-party business-data provider.

## Run locally

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Verify

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The repository also runs these checks automatically through GitHub Actions.

## Current modelling assumptions

- Exactly one Start step is required.
- At least one End step is required.
- Every non-End step must lead somewhere.
- Every non-Start step must be reachable from Start.
- Only Decision steps may branch to multiple outgoing routes.
- Decision probabilities must total exactly 100%.
- Rework loops/cyclic workflows are not included in V1.
- Working time is modelled as compressed monthly business minutes rather than explicit shift calendars.
- Labour cost represents task processing time × hourly cost, not fixed payroll cost.
- Duration variability uses a seeded triangular distribution centred on the configured task duration.
- Replay is sampled for visual performance; all core result metrics use every simulated transaction.

## Data ownership

Project state is stored in the browser and can be exported as a ProcessLab JSON backup. Core calculations are performed by ProcessLab itself.
