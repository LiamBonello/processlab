import { describe, expect, it } from 'vitest';
import { simulateProcess } from './simulate';
import type { ProcessConnection, ProcessStep } from './types';

const steps: ProcessStep[] = [
  { id: 'start', label: 'Start', kind: 'start' },
  { id: 'check', label: 'Check invoice', kind: 'task', durationMinutes: 5, workers: 2, hourlyCost: 22 },
  { id: 'decision', label: 'Needs approval?', kind: 'decision' },
  { id: 'approve', label: 'Approve', kind: 'task', durationMinutes: 8, workers: 1, hourlyCost: 35 },
  { id: 'enter', label: 'Enter system', kind: 'task', durationMinutes: 4, workers: 1, hourlyCost: 22 },
  { id: 'end', label: 'End', kind: 'end' },
];

const connections: ProcessConnection[] = [
  { source: 'start', target: 'check' },
  { source: 'check', target: 'decision' },
  { source: 'decision', target: 'approve', probability: 0.35 },
  { source: 'decision', target: 'enter', probability: 0.65 },
  { source: 'approve', target: 'enter' },
  { source: 'enter', target: 'end' },
];

describe('simulateProcess', () => {
  it('simulates a branched workflow deterministically', () => {
    const result = simulateProcess(steps, connections, {
      monthlyVolume: 800,
      workdaysPerMonth: 22,
      hoursPerDay: 8,
      seed: 42,
    });

    expect(result.transactions).toBe(800);
    expect(result.completedTransactions).toBe(800);
    expect(result.totalProcessingCost).toBeGreaterThan(0);
    expect(result.taskMetrics).toHaveLength(3);
    expect(result.taskMetrics.find((metric) => metric.taskId === 'approve')?.visits).toBeGreaterThan(0);

    const approvalRoute = result.routeMetrics.find(
      (metric) => metric.source === 'decision' && metric.target === 'approve',
    );
    const directRoute = result.routeMetrics.find(
      (metric) => metric.source === 'decision' && metric.target === 'enter',
    );

    expect(approvalRoute?.visits).toBeGreaterThan(0);
    expect(directRoute?.visits).toBeGreaterThan(0);
    expect((approvalRoute?.visits ?? 0) + (directRoute?.visits ?? 0)).toBe(800);
  });

  it('reports backlog when a task is overloaded', () => {
    const result = simulateProcess(
      [
        { id: 'start', label: 'Start', kind: 'start' },
        { id: 'slow', label: 'Slow task', kind: 'task', durationMinutes: 60, workers: 1, hourlyCost: 20 },
        { id: 'end', label: 'End', kind: 'end' },
      ],
      [
        { source: 'start', target: 'slow' },
        { source: 'slow', target: 'end' },
      ],
      {
        monthlyVolume: 300,
        workdaysPerMonth: 20,
        hoursPerDay: 8,
        seed: 1,
      },
    );

    expect(result.backlogAtMonthEnd).toBeGreaterThan(0);
    expect(result.taskMetrics[0].workloadRatio).toBeGreaterThan(1);
  });

  it('rejects decision probabilities that do not total 100%', () => {
    expect(() =>
      simulateProcess(
        steps,
        connections.map((connection) =>
          connection.source === 'decision' && connection.target === 'approve'
            ? { ...connection, probability: 0.2 }
            : connection,
        ),
        { monthlyVolume: 100, workdaysPerMonth: 20, hoursPerDay: 8 },
      ),
    ).toThrow(/must total 100%/);
  });

  it('rejects cycles', () => {
    expect(() =>
      simulateProcess(
        [
          { id: 'start', label: 'Start', kind: 'start' },
          { id: 'a', label: 'A', kind: 'task', durationMinutes: 1, workers: 1, hourlyCost: 1 },
          { id: 'b', label: 'B?', kind: 'decision' },
          { id: 'end', label: 'End', kind: 'end' },
        ],
        [
          { source: 'start', target: 'a' },
          { source: 'a', target: 'b' },
          { source: 'b', target: 'a', probability: 0.5 },
          { source: 'b', target: 'end', probability: 0.5 },
        ],
        { monthlyVolume: 100, workdaysPerMonth: 20, hoursPerDay: 8 },
      ),
    ).toThrow(/Cycles are not supported/);
  });
});
