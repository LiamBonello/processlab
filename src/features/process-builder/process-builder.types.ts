import type { Edge, Node } from '@xyflow/react';
import type { ProcessStepKind } from '@/features/simulation/engine/types';

export interface ProcessNodeData extends Record<string, unknown> {
  label: string;
  kind: ProcessStepKind;
  durationMinutes: number;
  workers: number;
  hourlyCost: number;
  variabilityPercent: number;
  isBottleneck?: boolean;
  simulation?: {
    visits: number;
    averageQueueMinutes: number;
    workloadRatio: number;
  };
  playback?: {
    queued: number;
    processing: number;
    traversed: number;
    completed: number;
  };
}

export interface ProcessEdgeData extends Record<string, unknown> {
  probability?: number;
  simulationVisits?: number;
  activeTraceIds?: string[];
  playbackSpeed?: number;
}

export type ProcessFlowNode = Node<ProcessNodeData, 'process'>;
export type ProcessFlowEdge = Edge<ProcessEdgeData, 'simulation'>;
