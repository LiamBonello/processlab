import { describe, expect, it } from 'vitest';
import { simulateProcess } from './simulate';
import type { ProcessConnection, ProcessTask } from './types';

const tasks: ProcessTask[] = [
  { id: 'check', label: 'Check invoice', durationMinutes: 5, workers: 2, hourlyCost: 22 },
  { id: 'approve', label: 'Approve', durationMinutes: 8, workers: 1, hourlyCost: 35 },
  { id: 'enter', label: 'Enter system', durationMinutes: 4, workers: 1, hourlyCost: 22 },
];

const connections: ProcessConnection[] = [
  { source: 'check', target: 'approve' },
  { source: 'approve', target: 'enter' },
];

describe('simulateProcess', () => {
  it('simulates a linear process deterministically', () => {
    const result = simulateProcess(tasks, connections, {
      monthlyVolume: 800,
      workdaysPerMonth: 22,
      hoursPerDay: 8,
      seed: 42,
    });

    expect(result.transactions).toBe(800);
    expect(result.completedTransactions).toBe(800);
    expect(result.totalProcessingCost).toBeGreaterThan(0);
    expect(result.taskMetrics).toHaveLength(3);
    expect(result.bottleneckTaskId).toBe('approve');
  });

  it('reports backlog when a task is overloaded', () => {
    const result = simulateProcess(
      [{ id: 'slow', label: 'Slow task', durationMinutes: 60, workers: 1, hourlyCost: 20 }],
      [],
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

  it('rejects cycles', () => {
    expect(() =>
      simulateProcess(
        tasks,
        [
          { source: 'check', target: 'approve' },
          { source: 'approve', target: 'enter' },
          { source: 'enter', target: 'check' },
        ],
        { monthlyVolume: 100, workdaysPerMonth: 20, hoursPerDay: 8 },
      ),
    ).toThrow(/Cycles are not supported/);
  });
});
