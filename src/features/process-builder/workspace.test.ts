import { describe, expect, it } from 'vitest';
import { createWorkspace, parseWorkspace } from './workspace';
import type { ProcessFlowEdge, ProcessFlowNode } from './process-builder.types';

const nodes: ProcessFlowNode[] = [
  {
    id: 'start',
    type: 'process',
    position: { x: 0, y: 0 },
    data: {
      label: 'Start',
      kind: 'start',
      durationMinutes: 0,
      workers: 0,
      hourlyCost: 0,
      variabilityPercent: 0,
    },
  },
  {
    id: 'end',
    type: 'process',
    position: { x: 100, y: 0 },
    data: {
      label: 'End',
      kind: 'end',
      durationMinutes: 0,
      workers: 0,
      hourlyCost: 0,
      variabilityPercent: 0,
    },
  },
];

const edges: ProcessFlowEdge[] = [
  {
    id: 'edge',
    source: 'start',
    target: 'end',
    data: {},
  },
];

describe('workspace backups', () => {
  it('round-trips a V1 workspace', () => {
    const workspace = createWorkspace(
      'Test project',
      nodes,
      edges,
      100,
      22,
      8,
      [],
    );

    const parsed = parseWorkspace(JSON.stringify(workspace));

    expect(parsed?.projectName).toBe('Test project');
    expect(parsed?.nodes).toHaveLength(2);
    expect(parsed?.edges).toHaveLength(1);
    expect(parsed?.monthlyVolume).toBe(100);
  });

  it('rejects malformed backups', () => {
    expect(parseWorkspace('not json')).toBeNull();
    expect(parseWorkspace(JSON.stringify({ version: 1 }))).toBeNull();
  });
});
