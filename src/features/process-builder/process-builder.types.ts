import type { Edge, Node } from '@xyflow/react';
import type { ProcessStepKind } from '@/features/simulation/engine/types';

export interface ProcessNodeData extends Record<string, unknown> {
  label: string;
  kind: ProcessStepKind;
  durationMinutes: number;
  workers: number;
  hourlyCost: number;
  isBottleneck?: boolean;
  simulation?: {
    visits: number;
    averageQueueMinutes: number;
    workloadRatio: number;
  };
}

export interface ProcessEdgeData extends Record<string, unknown> {
  probability?: number;
  simulationVisits?: number;
  isPlaying?: boolean;
}

export type ProcessFlowNode = Node<ProcessNodeData, 'process'>;
export type ProcessFlowEdge = Edge<ProcessEdgeData, 'simulation'>;
