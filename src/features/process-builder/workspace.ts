import type { ProcessFlowEdge, ProcessFlowNode } from './process-builder.types';
import type { SimulationResult } from '@/features/simulation/engine/types';

export const WORKSPACE_STORAGE_KEY = 'processlab.workspace.v1';

export interface ScenarioSnapshot {
  id: string;
  name: string;
  createdAt: string;
  monthlyVolume: number;
  workdaysPerMonth: number;
  hoursPerDay: number;
  result: SimulationResult;
}

export interface ProcessWorkspace {
  version: 1;
  projectName: string;
  nodes: ProcessFlowNode[];
  edges: ProcessFlowEdge[];
  monthlyVolume: number;
  workdaysPerMonth: number;
  hoursPerDay: number;
  savedScenarios: ScenarioSnapshot[];
  updatedAt: string;
}

export function createWorkspace(
  projectName: string,
  nodes: ProcessFlowNode[],
  edges: ProcessFlowEdge[],
  monthlyVolume: number,
  workdaysPerMonth: number,
  hoursPerDay: number,
  savedScenarios: ScenarioSnapshot[],
): ProcessWorkspace {
  return {
    version: 1,
    projectName,
    nodes: nodes.map((node) => ({
      ...node,
      selected: false,
      dragging: false,
      data: {
        ...node.data,
        isBottleneck: false,
        simulation: undefined,
        playback: undefined,
      },
    })),
    edges: edges.map((edge) => ({
      ...edge,
      selected: false,
      data: {
        probability: edge.data?.probability,
      },
    })),
    monthlyVolume,
    workdaysPerMonth,
    hoursPerDay,
    savedScenarios,
    updatedAt: new Date().toISOString(),
  };
}

export function parseWorkspace(value: string): ProcessWorkspace | null {
  try {
    const parsed = JSON.parse(value) as Partial<ProcessWorkspace>;
    if (
      parsed.version !== 1 ||
      typeof parsed.projectName !== 'string' ||
      !Array.isArray(parsed.nodes) ||
      !Array.isArray(parsed.edges) ||
      typeof parsed.monthlyVolume !== 'number' ||
      typeof parsed.workdaysPerMonth !== 'number' ||
      typeof parsed.hoursPerDay !== 'number'
    ) {
      return null;
    }

    return {
      version: 1,
      projectName: parsed.projectName,
      nodes: parsed.nodes,
      edges: parsed.edges,
      monthlyVolume: parsed.monthlyVolume,
      workdaysPerMonth: parsed.workdaysPerMonth,
      hoursPerDay: parsed.hoursPerDay,
      savedScenarios: Array.isArray(parsed.savedScenarios) ? parsed.savedScenarios : [],
      updatedAt:
        typeof parsed.updatedAt === 'string'
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
