import type { Edge, Node } from '@xyflow/react';

export interface ProcessNodeData extends Record<string, unknown> {
  label: string;
  durationMinutes: number;
  workers: number;
  hourlyCost: number;
}

export type ProcessFlowNode = Node<ProcessNodeData, 'process'>;
export type ProcessFlowEdge = Edge<Record<string, unknown>, 'default'>;
