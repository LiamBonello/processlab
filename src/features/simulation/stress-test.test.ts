import { describe, expect, it } from 'vitest';
import { runVolumeStressTest } from './stress-test';
import type { ProcessConnection, ProcessStep } from './engine/types';

const steps: ProcessStep[] = [
  { id: 'start', label: 'Start', kind: 'start' },
  {
    id: 'task',
    label: 'Review',
    kind: 'task',
    durationMinutes: 60,
    workers: 1,
    hourlyCost: 20,
    variabilityPercent: 0,
  },
  { id: 'end', label: 'End', kind: 'end' },
];

const connections: ProcessConnection[] = [
  { source: 'start', target: 'task' },
  { source: 'task', target: 'end' },
];

describe('runVolumeStressTest', () => {
  it('finds warning and overloaded volume bands', () => {
    const result = runVolumeStressTest(steps, connections, {
      monthlyVolume: 100,
      workdaysPerMonth: 20,
      hoursPerDay: 8,
      seed: 1,
    });

    expect(result.points).toHaveLength(7);
    expect(result.firstWarningVolume).toBe(150);
    expect(result.firstOverloadedVolume).toBe(200);
    expect(result.points.find((point) => point.monthlyVolume === 100)?.highestLoad)
      .toBeCloseTo(0.625);
  });
});
