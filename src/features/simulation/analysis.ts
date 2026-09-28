import type { SimulationResult } from './engine/types';

export type InsightSeverity = 'critical' | 'warning' | 'opportunity' | 'info';

export interface SimulationInsight {
  id: string;
  severity: InsightSeverity;
  title: string;
  description: string;
}

export interface CapacityEstimate {
  currentVolume: number;
  estimatedMaxVolume: number | null;
  target80PercentVolume: number | null;
  highestLoad: number;
}

export function estimateCapacity(
  result: SimulationResult,
  currentVolume: number,
): CapacityEstimate {
  const highestLoad = result.taskMetrics.reduce(
    (maximum, metric) => Math.max(maximum, metric.workloadRatio),
    0,
  );

  if (highestLoad <= 0) {
    return {
      currentVolume,
      estimatedMaxVolume: null,
      target80PercentVolume: null,
      highestLoad,
    };
  }

  return {
    currentVolume,
    estimatedMaxVolume: Math.floor(currentVolume / highestLoad),
    target80PercentVolume: Math.floor((currentVolume * 0.8) / highestLoad),
    highestLoad,
  };
}

export function buildSimulationInsights(
  result: SimulationResult,
  currentVolume: number,
): SimulationInsight[] {
  const insights: SimulationInsight[] = [];
  const sortedByLoad = [...result.taskMetrics].sort(
    (left, right) => right.workloadRatio - left.workloadRatio,
  );
  const sortedByQueue = [...result.taskMetrics].sort(
    (left, right) => right.averageQueueMinutes - left.averageQueueMinutes,
  );
  const sortedByCost = [...result.taskMetrics].sort(
    (left, right) => right.processingCost - left.processingCost,
  );

  const highestLoad = sortedByLoad[0];
  const highestQueue = sortedByQueue[0];
  const highestCost = sortedByCost[0];
  const capacity = estimateCapacity(result, currentVolume);

  if (highestLoad?.workloadRatio >= 1) {
    insights.push({
      id: 'capacity-overload',
      severity: 'critical',
      title: `${highestLoad.label} is over capacity`,
      description: `Estimated workload is ${Math.round(highestLoad.workloadRatio * 100)}% of available capacity. Add capacity, reduce task time, or reduce the volume routed through this step.`,
    });
  } else if (highestLoad?.workloadRatio >= 0.8) {
    insights.push({
      id: 'capacity-watch',
      severity: 'warning',
      title: `${highestLoad.label} has limited headroom`,
      description: `This step is running at approximately ${Math.round(highestLoad.workloadRatio * 100)}% load and is the first place likely to constrain growth.`,
    });
  } else if (capacity.estimatedMaxVolume) {
    const headroom = Math.max(
      0,
      Math.round(
        ((capacity.estimatedMaxVolume - currentVolume) / currentVolume) * 100,
      ),
    );
    insights.push({
      id: 'capacity-headroom',
      severity: 'opportunity',
      title: `The process has about ${headroom}% volume headroom`,
      description: `At the current task mix, the highest-loaded step reaches theoretical capacity at roughly ${capacity.estimatedMaxVolume.toLocaleString()} transactions per month.`,
    });
  }

  if (highestQueue && highestQueue.averageQueueMinutes >= 15) {
    insights.push({
      id: 'queue-delay',
      severity: highestQueue.averageQueueMinutes >= 60 ? 'critical' : 'warning',
      title: `Queueing is concentrated at ${highestQueue.label}`,
      description: `Transactions wait an average of ${highestQueue.averageQueueMinutes.toFixed(1)} minutes before processing at this step.`,
    });
  }

  if (highestCost && result.totalProcessingCost > 0) {
    const costShare = highestCost.processingCost / result.totalProcessingCost;
    if (costShare >= 0.3) {
      insights.push({
        id: 'cost-concentration',
        severity: 'opportunity',
        title: `${highestCost.label} drives ${Math.round(costShare * 100)}% of labour cost`,
        description:
          'Reducing duration, hourly cost, or the number of transactions routed through this task will have the largest direct impact on processing cost.',
      });
    }
  }

  if (result.backlogAtMonthEnd > 0) {
    insights.push({
      id: 'carryover',
      severity: result.backlogAtMonthEnd / result.transactions >= 0.05 ? 'warning' : 'info',
      title: `${result.backlogAtMonthEnd.toLocaleString()} transactions complete after the month boundary`,
      description:
        'Month-end carryover can be caused by late arrivals even when capacity is healthy. Stress testing helps distinguish timing carryover from genuine overload.',
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: 'healthy',
      severity: 'info',
      title: 'No material constraint detected',
      description:
        'Current volume is flowing through the model without a notable capacity, queueing, or cost concentration warning.',
    });
  }

  return insights;
}
