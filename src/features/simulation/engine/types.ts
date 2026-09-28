export type ProcessStepKind = 'start' | 'task' | 'decision' | 'end';

export interface ProcessStep {
  id: string;
  label: string;
  kind: ProcessStepKind;
  durationMinutes?: number;
  workers?: number;
  hourlyCost?: number;
}

export interface ProcessConnection {
  source: string;
  target: string;
  probability?: number;
}

export interface SimulationSettings {
  monthlyVolume: number;
  workdaysPerMonth: number;
  hoursPerDay: number;
  seed?: number;
}

export interface TaskSimulationMetric {
  taskId: string;
  label: string;
  visits: number;
  busyMinutes: number;
  averageQueueMinutes: number;
  workloadRatio: number;
  monthlyCapacity: number;
  processingCost: number;
}

export interface SimulationResult {
  transactions: number;
  completedTransactions: number;
  throughputWithinMonth: number;
  backlogAtMonthEnd: number;
  averageCycleMinutes: number;
  averageQueueMinutes: number;
  totalProcessingCost: number;
  costPerTransaction: number;
  bottleneckTaskId: string | null;
  bottleneckLabel: string | null;
  taskMetrics: TaskSimulationMetric[];
}
