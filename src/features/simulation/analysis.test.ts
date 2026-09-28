import { describe, expect, it } from 'vitest';
import {
  buildSimulationInsights,
  estimateCapacity,
} from './analysis';
import type { SimulationResult } from './engine/types';

function makeResult(workloadRatio: number): SimulationResult {
  return {
    transactions: 100,
    completedTransactions: 100,
    throughputWithinMonth: 100,
    backlogAtMonthEnd: 0,
    averageCycleMinutes: 10,
    averageQueueMinutes: 2,
    totalProcessingCost: 1000,
    costPerTransaction: 10,
    bottleneckTaskId: 'task',
    bottleneckLabel: 'Review',
    taskMetrics: [
      {
        taskId: 'task',
        label: 'Review',
        visits: 100,
        busyMinutes: 500,
        averageQueueMinutes: 2,
        workloadRatio,
        monthlyCapacity: 120,
        processingCost: 1000,
      },
    ],
    routeMetrics: [],
    trace: {
      sampledTransactionIds: [],
      events: [],
      startAt: 0,
      endAt: 0,
    },
  };
}

describe('simulation analysis', () => {
  it('estimates theoretical and 80% capacity volumes', () => {
    const estimate = estimateCapacity(makeResult(0.5), 100);

    expect(estimate.estimatedMaxVolume).toBe(200);
    expect(estimate.target80PercentVolume).toBe(160);
  });

  it('reports a critical capacity insight above 100% load', () => {
    const insights = buildSimulationInsights(makeResult(1.2), 100);

    expect(
      insights.some(
        (insight) =>
          insight.id === 'capacity-overload' &&
          insight.severity === 'critical',
      ),
    ).toBe(true);
  });

  it('reports healthy headroom below the warning threshold', () => {
    const insights = buildSimulationInsights(makeResult(0.5), 100);

    expect(
      insights.some((insight) => insight.id === 'capacity-headroom'),
    ).toBe(true);
  });
});
