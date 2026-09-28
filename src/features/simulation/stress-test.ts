import { simulateProcess } from './engine/simulate';
import type {
  ProcessConnection,
  ProcessStep,
  SimulationSettings,
} from './engine/types';

export interface StressTestPoint {
  multiplier: number;
  monthlyVolume: number;
  highestLoad: number;
  averageCycleMinutes: number;
  averageQueueMinutes: number;
  throughputWithinMonth: number;
  carryover: number;
  totalProcessingCost: number;
  constrainedTaskLabel: string | null;
}

export interface StressTestResult {
  points: StressTestPoint[];
  firstOverloadedVolume: number | null;
  firstWarningVolume: number | null;
}

const DEFAULT_MULTIPLIERS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

export function runVolumeStressTest(
  steps: ProcessStep[],
  connections: ProcessConnection[],
  settings: SimulationSettings,
  multipliers = DEFAULT_MULTIPLIERS,
): StressTestResult {
  const points = multipliers.map((multiplier) => {
    const monthlyVolume = Math.max(
      1,
      Math.round(settings.monthlyVolume * multiplier),
    );
    const result = simulateProcess(steps, connections, {
      ...settings,
      monthlyVolume,
      seed: settings.seed ?? 20260928,
    });

    const highestLoadMetric = result.taskMetrics.reduce<
      (typeof result.taskMetrics)[number] | null
    >((current, metric) => {
      if (!current || metric.workloadRatio > current.workloadRatio) return metric;
      return current;
    }, null);

    return {
      multiplier,
      monthlyVolume,
      highestLoad: highestLoadMetric?.workloadRatio ?? 0,
      averageCycleMinutes: result.averageCycleMinutes,
      averageQueueMinutes: result.averageQueueMinutes,
      throughputWithinMonth: result.throughputWithinMonth,
      carryover: result.backlogAtMonthEnd,
      totalProcessingCost: result.totalProcessingCost,
      constrainedTaskLabel: highestLoadMetric?.label ?? null,
    };
  });

  return {
    points,
    firstOverloadedVolume:
      points.find((point) => point.highestLoad >= 1)?.monthlyVolume ?? null,
    firstWarningVolume:
      points.find((point) => point.highestLoad >= 0.8)?.monthlyVolume ?? null,
  };
}
