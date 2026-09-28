'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import CallSplitRoundedIcon from '@mui/icons-material/CallSplitRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import { InsightsPanel } from './components/InsightsPanel';
import { ProcessNode } from './components/ProcessNode';
import { ScenarioPanel } from './components/ScenarioPanel';
import { SimulationEdge } from './components/SimulationEdge';
import { StressTestPanel } from './components/StressTestPanel';
import type { ProcessFlowEdge, ProcessFlowNode } from './process-builder.types';
import {
  blankProcessTemplate,
  cloneTemplate,
  processTemplates,
  type ProcessTemplate,
} from './templates';
import {
  createWorkspace,
  parseWorkspace,
  WORKSPACE_STORAGE_KEY,
  type ScenarioSnapshot,
} from './workspace';
import { buildSimulationInsights } from '@/features/simulation/analysis';
import { simulateProcess } from '@/features/simulation/engine/simulate';
import type {
  ProcessConnection,
  ProcessStep,
  SimulationResult,
} from '@/features/simulation/engine/types';
import {
  runVolumeStressTest,
  type StressTestResult,
} from '@/features/simulation/stress-test';

const defaultTemplate = cloneTemplate(processTemplates[0]);
const initialNodes: ProcessFlowNode[] = defaultTemplate.nodes;
const initialEdges: ProcessFlowEdge[] = defaultTemplate.edges;

const nodeTypes: NodeTypes = { process: ProcessNode };
const edgeTypes: EdgeTypes = { simulation: SimulationEdge };

const currencyFormatter = new Intl.NumberFormat('en', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'finished';

const PLAYBACK_DURATION_MS = 14000;

function formatPlaybackTime(minutes: number, hoursPerDay: number) {
  const safeMinutes = Math.max(0, minutes);
  const workdayMinutes = Math.max(1, hoursPerDay * 60);
  const day = Math.floor(safeMinutes / workdayMinutes) + 1;
  const minutesIntoShift = safeMinutes % workdayMinutes;
  const hours = Math.floor(minutesIntoShift / 60);
  const remainingMinutes = Math.floor(minutesIntoShift % 60);

  return `Day ${day} · +${hours}h ${remainingMinutes.toString().padStart(2, '0')}m`;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes.toFixed(1)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} hrs`;
  return `${(hours / 24).toFixed(1)} days`;
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Box sx={{ minWidth: 0, flex: '1 1 150px' }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6" mt={0.25} sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
      {detail ? (
        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
      ) : null}
    </Box>
  );
}

function ComparisonChip({
  current,
  baseline,
  suffix = '%',
  lowerIsBetter = true,
}: {
  current: number;
  baseline: number;
  suffix?: string;
  lowerIsBetter?: boolean;
}) {
  if (baseline === 0) return null;
  const delta = ((current - baseline) / baseline) * 100;
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  const label = `${delta > 0 ? '+' : ''}${delta.toFixed(1)}${suffix} vs baseline`;

  return (
    <Chip
      size="small"
      color={Math.abs(delta) < 0.05 ? 'default' : improved ? 'success' : 'warning'}
      variant="outlined"
      label={label}
    />
  );
}

export function ProcessBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState<ProcessFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<ProcessFlowEdge>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('check-invoice');
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState(defaultTemplate.name);
  const [monthlyVolume, setMonthlyVolume] = useState(defaultTemplate.monthlyVolume);
  const [workdaysPerMonth, setWorkdaysPerMonth] = useState(defaultTemplate.workdaysPerMonth);
  const [hoursPerDay, setHoursPerDay] = useState(defaultTemplate.hoursPerDay);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [baseline, setBaseline] = useState<SimulationResult | null>(null);
  const [savedScenarios, setSavedScenarios] = useState<ScenarioSnapshot[]>([]);
  const [stressTestResult, setStressTestResult] = useState<StressTestResult | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [scenarioDialogOpen, setScenarioDialogOpen] = useState(false);
  const [scenarioName, setScenarioName] = useState('Scenario 1');
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('idle');
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackProgressRef = useRef(0);
  const playbackFrameRef = useRef<number | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    const workspace = stored ? parseWorkspace(stored) : null;

    if (workspace) {
      setProjectName(workspace.projectName);
      setNodes(
        workspace.nodes.map((node) => ({
          ...node,
          type: 'process' as const,
          data: {
            ...node.data,
            variabilityPercent: node.data.variabilityPercent ?? 0,
            isBottleneck: false,
            simulation: undefined,
            playback: undefined,
          },
        })),
      );
      setEdges(
        workspace.edges.map((edge) => ({
          ...edge,
          type: 'simulation' as const,
          data: {
            probability: edge.data?.probability,
          },
        })),
      );
      setMonthlyVolume(workspace.monthlyVolume);
      setWorkdaysPerMonth(workspace.workdaysPerMonth);
      setHoursPerDay(workspace.hoursPerDay);
      setSavedScenarios(workspace.savedScenarios);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }

    setWorkspaceReady(true);
  }, [setEdges, setNodes]);

  useEffect(() => {
    if (!workspaceReady) return;

    const saveTimeout = window.setTimeout(() => {
      const workspace = createWorkspace(
        projectName.trim() || 'Untitled process',
        nodes,
        edges,
        monthlyVolume,
        workdaysPerMonth,
        hoursPerDay,
        savedScenarios,
      );
      localStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        JSON.stringify(workspace),
      );
    }, 250);

    return () => window.clearTimeout(saveTimeout);
  }, [
    edges,
    hoursPerDay,
    monthlyVolume,
    nodes,
    projectName,
    savedScenarios,
    workdaysPerMonth,
    workspaceReady,
  ]);

  useEffect(() => {
    if (playbackStatus !== 'playing' || !result) return;

    let previousTimestamp = performance.now();

    const tick = (timestamp: number) => {
      const elapsed = timestamp - previousTimestamp;
      previousTimestamp = timestamp;

      const nextProgress = Math.min(
        1,
        playbackProgressRef.current +
          (elapsed * playbackSpeed) / PLAYBACK_DURATION_MS,
      );

      playbackProgressRef.current = nextProgress;
      setPlaybackProgress(nextProgress);

      if (nextProgress >= 1) {
        setPlaybackStatus('finished');
        playbackFrameRef.current = null;
        return;
      }

      playbackFrameRef.current = requestAnimationFrame(tick);
    };

    playbackFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (playbackFrameRef.current !== null) {
        cancelAnimationFrame(playbackFrameRef.current);
        playbackFrameRef.current = null;
      }
    };
  }, [playbackSpeed, playbackStatus, result]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId],
  );

  const selectedNodeBranches = useMemo(
    () =>
      selectedNode?.data.kind === 'decision'
        ? edges.filter((edge) => edge.source === selectedNode.id)
        : [],
    [edges, selectedNode],
  );

  const simulationSteps = useMemo<ProcessStep[]>(
    () =>
      nodes.map((node) => ({
        id: node.id,
        label: node.data.label,
        kind: node.data.kind,
        durationMinutes:
          node.data.kind === 'task' ? node.data.durationMinutes : undefined,
        workers: node.data.kind === 'task' ? node.data.workers : undefined,
        hourlyCost:
          node.data.kind === 'task' ? node.data.hourlyCost : undefined,
        variabilityPercent:
          node.data.kind === 'task'
            ? node.data.variabilityPercent
            : undefined,
      })),
    [nodes],
  );

  const simulationConnections = useMemo<ProcessConnection[]>(
    () =>
      edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        probability: edge.data?.probability,
      })),
    [edges],
  );

  const simulationInsights = useMemo(
    () =>
      result ? buildSimulationInsights(result, monthlyVolume) : [],
    [monthlyVolume, result],
  );

  const highestLoadMetric = useMemo(
    () =>
      result?.taskMetrics.find((metric) => metric.taskId === result.bottleneckTaskId) ?? null,
    [result],
  );

  const constraintLabel = highestLoadMetric
    ? highestLoadMetric.workloadRatio >= 1
      ? `Bottleneck: ${highestLoadMetric.label} · ${Math.round(highestLoadMetric.workloadRatio * 100)}% load`
      : highestLoadMetric.workloadRatio >= 0.8
        ? `Capacity watch: ${highestLoadMetric.label} · ${Math.round(highestLoadMetric.workloadRatio * 100)}% load`
        : `Highest load: ${highestLoadMetric.label} · ${Math.round(highestLoadMetric.workloadRatio * 100)}%`
    : null;

  const constraintColor =
    (highestLoadMetric?.workloadRatio ?? 0) >= 1
      ? 'error'
      : (highestLoadMetric?.workloadRatio ?? 0) >= 0.8
        ? 'warning'
        : 'default';

  const traceSpan = Math.max(
    1,
    (result?.trace.endAt ?? 0) - (result?.trace.startAt ?? 0),
  );
  const playbackTime =
    (result?.trace.startAt ?? 0) + playbackProgress * traceSpan;

  const playbackNodeState = useMemo(() => {
    const state = new Map<
      string,
      { queued: number; processing: number; traversed: number; completed: number }
    >();

    if (!result || playbackStatus === 'idle') return state;

    const getState = (stepId: string) => {
      const existing = state.get(stepId);
      if (existing) return existing;

      const created = {
        queued: 0,
        processing: 0,
        traversed: 0,
        completed: 0,
      };
      state.set(stepId, created);
      return created;
    };

    for (const event of result.trace.events) {
      if (event.at > playbackTime) break;

      if (event.kind === 'arrive') {
        getState(event.stepId).traversed += 1;
      } else if (event.kind === 'queue') {
        getState(event.stepId).queued += 1;
      } else if (event.kind === 'start') {
        const stepState = getState(event.stepId);
        if ((event.queueMinutes ?? 0) > 0) {
          stepState.queued = Math.max(0, stepState.queued - 1);
        }
        stepState.processing += 1;
        stepState.traversed += 1;
      } else if (event.kind === 'finish') {
        const stepState = getState(event.stepId);
        stepState.processing = Math.max(0, stepState.processing - 1);
      } else if (event.kind === 'route' && event.fromStepId) {
        const sourceNode = nodes.find((node) => node.id === event.fromStepId);
        if (sourceNode?.data.kind === 'decision') {
          getState(event.fromStepId).traversed += 1;
        }
      } else if (event.kind === 'complete') {
        getState(event.stepId).completed += 1;
      }
    }

    return state;
  }, [nodes, playbackStatus, playbackTime, result]);

  const displayNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          playback: playbackNodeState.get(node.id),
        },
      })),
    [nodes, playbackNodeState],
  );

  const activeRouteTraceIds = useMemo(() => {
    const active = new Map<string, string[]>();

    if (!result || playbackStatus !== 'playing') return active;

    const windowProgress = Math.min(0.2, 0.05 * playbackSpeed);
    const windowStart = Math.max(0, playbackProgress - windowProgress);

    for (const event of result.trace.events) {
      if (event.kind !== 'route' || !event.fromStepId || !event.toStepId) continue;

      const eventProgress = Math.max(
        0,
        Math.min(1, (event.at - result.trace.startAt) / traceSpan),
      );

      if (eventProgress > playbackProgress || eventProgress < windowStart) continue;

      const key = `${event.fromStepId}::${event.toStepId}`;
      const ids = active.get(key) ?? [];
      ids.push(`${event.transactionId}-${event.at}`);
      active.set(key, ids);
    }

    return active;
  }, [playbackProgress, playbackSpeed, playbackStatus, result, traceSpan]);

  const renderedEdges = useMemo(() => {
    const routeMetrics = new Map(
      (result?.routeMetrics ?? []).map((metric) => [
        `${metric.source}::${metric.target}`,
        metric,
      ]),
    );

    return edges.map((edge) => {
      const routeKey = `${edge.source}::${edge.target}`;
      const metric = routeMetrics.get(routeKey);
      const activeTraceIds = (activeRouteTraceIds.get(routeKey) ?? []).slice(-6);

      return {
        ...edge,
        type: 'simulation' as const,
        data: {
          ...edge.data,
          simulationVisits: metric?.visits,
          activeTraceIds,
          playbackSpeed,
        },
        style: {
          ...edge.style,
          strokeWidth: activeTraceIds.length > 0 ? 2.4 : 1.7,
        },
      };
    });
  }, [activeRouteTraceIds, edges, playbackSpeed, result]);

  const clearResult = useCallback(() => {
    setResult(null);
    setStressTestResult(null);
    setSimulationError(null);
    playbackProgressRef.current = 0;
    setPlaybackProgress(0);
    setPlaybackStatus('idle');
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.data.isBottleneck || node.data.simulation
          ? {
              ...node,
              data: {
                ...node.data,
                isBottleneck: false,
                simulation: undefined,
              },
            }
          : node,
      ),
    );
  }, [setNodes]);

  const applyTemplate = useCallback(
    (template: ProcessTemplate) => {
      const cloned = cloneTemplate(template);
      setProjectName(template.name);
      setNodes(cloned.nodes);
      setEdges(cloned.edges);
      setMonthlyVolume(cloned.monthlyVolume);
      setWorkdaysPerMonth(cloned.workdaysPerMonth);
      setHoursPerDay(cloned.hoursPerDay);
      setSavedScenarios([]);
      setBaseline(null);
      setResult(null);
      setStressTestResult(null);
      setSimulationError(null);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      playbackProgressRef.current = 0;
      setPlaybackProgress(0);
      setPlaybackStatus('idle');
      setTemplateDialogOpen(false);
    },
    [setEdges, setNodes],
  );

  const exportWorkspace = useCallback(() => {
    const workspace = createWorkspace(
      projectName.trim() || 'Untitled process',
      nodes,
      edges,
      monthlyVolume,
      workdaysPerMonth,
      hoursPerDay,
      savedScenarios,
    );
    const blob = new Blob([JSON.stringify(workspace, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = (projectName.trim() || 'processlab-project')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    link.href = url;
    link.download = (safeName || 'processlab-project') + '.processlab.json';
    link.click();
    URL.revokeObjectURL(url);
  }, [
    edges,
    hoursPerDay,
    monthlyVolume,
    nodes,
    projectName,
    savedScenarios,
    workdaysPerMonth,
  ]);

  const importWorkspace = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (!file) return;

      const workspace = parseWorkspace(await file.text());
      if (!workspace) {
        setSimulationError('This file is not a valid ProcessLab project backup.');
        return;
      }

      setProjectName(workspace.projectName);
      setNodes(
        workspace.nodes.map((node) => ({
          ...node,
          type: 'process' as const,
          data: {
            ...node.data,
            variabilityPercent: node.data.variabilityPercent ?? 0,
            isBottleneck: false,
            simulation: undefined,
            playback: undefined,
          },
        })),
      );
      setEdges(
        workspace.edges.map((edge) => ({
          ...edge,
          type: 'simulation' as const,
          data: { probability: edge.data?.probability },
        })),
      );
      setMonthlyVolume(workspace.monthlyVolume);
      setWorkdaysPerMonth(workspace.workdaysPerMonth);
      setHoursPerDay(workspace.hoursPerDay);
      setSavedScenarios(workspace.savedScenarios);
      setBaseline(null);
      setResult(null);
      setStressTestResult(null);
      setSimulationError(null);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      playbackProgressRef.current = 0;
      setPlaybackProgress(0);
      setPlaybackStatus('idle');
    },
    [setEdges, setNodes],
  );

  const saveScenario = useCallback(() => {
    if (!result) return;

    const name =
      scenarioName.trim() || 'Scenario ' + (savedScenarios.length + 1);
    const scenario: ScenarioSnapshot = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      monthlyVolume,
      workdaysPerMonth,
      hoursPerDay,
      result,
    };

    setSavedScenarios((current) => [...current, scenario]);
    setScenarioDialogOpen(false);
    setScenarioName('Scenario ' + (savedScenarios.length + 2));
  }, [
    hoursPerDay,
    monthlyVolume,
    result,
    savedScenarios.length,
    scenarioName,
    workdaysPerMonth,
  ]);

  const runStressTest = useCallback(() => {
    try {
      const nextStressTest = runVolumeStressTest(
        simulationSteps,
        simulationConnections,
        {
          monthlyVolume,
          workdaysPerMonth,
          hoursPerDay,
          seed: 20260928,
        },
      );
      setStressTestResult(nextStressTest);
      setSimulationError(null);
    } catch (error) {
      setStressTestResult(null);
      setSimulationError(
        error instanceof Error ? error.message : 'Unable to run the stress test.',
      );
    }
  }, [
    hoursPerDay,
    monthlyVolume,
    simulationConnections,
    simulationSteps,
    workdaysPerMonth,
  ]);

  const deleteScenario = useCallback((scenarioId: string) => {
    setSavedScenarios((current) =>
      current.filter((scenario) => scenario.id !== scenarioId),
    );
  }, []);

  const useScenarioAsBaseline = useCallback((scenario: ScenarioSnapshot) => {
    setBaseline(scenario.result);
  }, []);

  const printReport = useCallback(() => {
    window.print();
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);
      if (!sourceNode || !targetNode) return;

      if (sourceNode.data.kind === 'end') {
        setSimulationError('End steps cannot have outgoing connections.');
        return;
      }
      if (targetNode.data.kind === 'start') {
        setSimulationError('Start cannot have an incoming connection.');
        return;
      }

      const outgoing = edges.filter((edge) => edge.source === connection.source);
      if (sourceNode.data.kind !== 'decision' && outgoing.length > 0) {
        setSimulationError('Only a Decision step can have multiple outgoing routes.');
        return;
      }

      if (sourceNode.data.kind === 'decision') {
        const nextBranchCount = outgoing.length + 1;
        const probability = 1 / nextBranchCount;

        setEdges((currentEdges) => {
          const rebalanced = currentEdges.map((edge) =>
            edge.source === connection.source
              ? { ...edge, data: { ...edge.data, probability } }
              : edge,
          );

          return addEdge(
            {
              ...connection,
              data: { probability },
            },
            rebalanced,
          ) as ProcessFlowEdge[];
        });
      } else {
        setEdges((currentEdges) => addEdge(connection, currentEdges) as ProcessFlowEdge[]);
      }

      clearResult();
    },
    [clearResult, edges, nodes, setEdges],
  );

  const updateSelectedNode = useCallback(
    (patch: Partial<ProcessFlowNode['data']>) => {
      if (!selectedNodeId) return;
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id === selectedNodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                ...patch,
                isBottleneck: false,
                simulation: undefined,
              },
            };
          }

          if (node.data.isBottleneck || node.data.simulation) {
            return {
              ...node,
              data: {
                ...node.data,
                isBottleneck: false,
                simulation: undefined,
              },
            };
          }

          return node;
        }),
      );
      setResult(null);
      setSimulationError(null);
      playbackProgressRef.current = 0;
      setPlaybackProgress(0);
      setPlaybackStatus('idle');
    },
    [selectedNodeId, setNodes],
  );

  const findInsertionEdge = useCallback(() => {
    if (selectedEdgeId) {
      const selected = edges.find((edge) => edge.id === selectedEdgeId);
      if (selected) return selected;
    }

    if (selectedNodeId) {
      const outgoing = edges.filter((edge) => edge.source === selectedNodeId);
      if (outgoing.length === 1) return outgoing[0];
    }

    const endNodeIds = new Set(
      nodes.filter((node) => node.data.kind === 'end').map((node) => node.id),
    );
    return edges.find((edge) => endNodeIds.has(edge.target)) ?? null;
  }, [edges, nodes, selectedEdgeId, selectedNodeId]);

  const insertTask = useCallback(() => {
    const edge = findInsertionEdge();
    if (!edge) {
      setSimulationError('Select a connection or a step with one outgoing connection before adding a task.');
      return;
    }

    const sourceNode = nodes.find((node) => node.id === edge.source);
    const targetNode = nodes.find((node) => node.id === edge.target);
    if (!sourceNode || !targetNode) return;

    const id = `task-${crypto.randomUUID()}`;
    const newNode: ProcessFlowNode = {
      id,
      type: 'process',
      position: {
        x: (sourceNode.position.x + targetNode.position.x) / 2,
        y: (sourceNode.position.y + targetNode.position.y) / 2,
      },
      data: {
        label: 'New task',
        kind: 'task',
        durationMinutes: 5,
        workers: 1,
        hourlyCost: 25,
        variabilityPercent: 10,
      },
    };

    setNodes((currentNodes) => [...currentNodes, newNode]);
    setEdges((currentEdges) => [
      ...currentEdges.filter((currentEdge) => currentEdge.id !== edge.id),
      {
        id: `edge-${crypto.randomUUID()}`,
        source: edge.source,
        target: id,
        data: edge.data?.probability === undefined
          ? {}
          : { probability: edge.data.probability },
      },
      {
        id: `edge-${crypto.randomUUID()}`,
        source: id,
        target: edge.target,
        data: {},
      },
    ]);

    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    clearResult();
  }, [clearResult, findInsertionEdge, nodes, setEdges, setNodes]);

  const insertDecision = useCallback(() => {
    const edge = findInsertionEdge();
    if (!edge) {
      setSimulationError('Select a connection before adding a decision.');
      return;
    }

    const sourceNode = nodes.find((node) => node.id === edge.source);
    const targetNode = nodes.find((node) => node.id === edge.target);
    if (!sourceNode || !targetNode) return;

    const decisionId = `decision-${crypto.randomUUID()}`;
    const branchAId = `task-${crypto.randomUUID()}`;
    const branchBId = `task-${crypto.randomUUID()}`;
    const decisionX = sourceNode.position.x + 260;
    const branchX = decisionX + 280;

    setNodes((currentNodes) => {
      const shiftedNodes = currentNodes.map((node) =>
        node.position.x >= targetNode.position.x
          ? { ...node, position: { ...node.position, x: node.position.x + 420 } }
          : node,
      );

      return [
        ...shiftedNodes,
        {
          id: decisionId,
          type: 'process',
          position: { x: decisionX, y: sourceNode.position.y },
          data: {
            label: 'Choose route',
            kind: 'decision',
            durationMinutes: 0,
            workers: 0,
            hourlyCost: 0,
            variabilityPercent: 0,
          },
        },
        {
          id: branchAId,
          type: 'process',
          position: { x: branchX, y: sourceNode.position.y - 120 },
          data: {
            label: 'Path A',
            kind: 'task',
            durationMinutes: 5,
            workers: 1,
            hourlyCost: 25,
            variabilityPercent: 10,
          },
        },
        {
          id: branchBId,
          type: 'process',
          position: { x: branchX, y: sourceNode.position.y + 120 },
          data: {
            label: 'Path B',
            kind: 'task',
            durationMinutes: 5,
            workers: 1,
            hourlyCost: 25,
            variabilityPercent: 10,
          },
        },
      ];
    });

    setEdges((currentEdges) => [
      ...currentEdges.filter((currentEdge) => currentEdge.id !== edge.id),
      {
        id: `edge-${crypto.randomUUID()}`,
        source: edge.source,
        target: decisionId,
        data: edge.data?.probability === undefined
          ? {}
          : { probability: edge.data.probability },
      },
      {
        id: `edge-${crypto.randomUUID()}`,
        source: decisionId,
        target: branchAId,
        data: { probability: 0.5 },
      },
      {
        id: `edge-${crypto.randomUUID()}`,
        source: decisionId,
        target: branchBId,
        data: { probability: 0.5 },
      },
      {
        id: `edge-${crypto.randomUUID()}`,
        source: branchAId,
        target: edge.target,
        data: {},
      },
      {
        id: `edge-${crypto.randomUUID()}`,
        source: branchBId,
        target: edge.target,
        data: {},
      },
    ]);

    setSelectedNodeId(decisionId);
    setSelectedEdgeId(null);
    clearResult();
  }, [clearResult, findInsertionEdge, nodes, setEdges, setNodes]);

  const updateBranchProbability = useCallback(
    (edgeId: string, percent: number) => {
      const selected = edges.find((edge) => edge.id === edgeId);
      if (!selected) return;

      const siblings = edges.filter((edge) => edge.source === selected.source);
      if (siblings.length < 2) return;

      const nextProbability = Math.min(0.99, Math.max(0.01, percent / 100));
      const remaining = 1 - nextProbability;
      const siblingProbability = remaining / (siblings.length - 1);

      setEdges((currentEdges) =>
        currentEdges.map((edge) => {
          if (edge.id === edgeId) {
            return { ...edge, data: { ...edge.data, probability: nextProbability } };
          }
          if (edge.source === selected.source) {
            return { ...edge, data: { ...edge.data, probability: siblingProbability } };
          }
          return edge;
        }),
      );
      clearResult();
    },
    [clearResult, edges, setEdges],
  );

  const deleteSelectedStep = useCallback(() => {
    if (!selectedNode || selectedNode.data.kind === 'start' || selectedNode.data.kind === 'end') {
      return;
    }

    const incoming = edges.filter((edge) => edge.target === selectedNode.id);
    const outgoing = edges.filter((edge) => edge.source === selectedNode.id);

    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== selectedNode.id));
    setEdges((currentEdges) => {
      const withoutStep = currentEdges.filter(
        (edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id,
      );

      if (selectedNode.data.kind === 'task' && incoming.length === 1 && outgoing.length === 1) {
        return [
          ...withoutStep,
          {
            id: `edge-${crypto.randomUUID()}`,
            source: incoming[0].source,
            target: outgoing[0].target,
            data: incoming[0].data?.probability === undefined
              ? {}
              : { probability: incoming[0].data.probability },
          },
        ];
      }

      return withoutStep;
    });

    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    clearResult();
  }, [clearResult, edges, selectedNode, setEdges, setNodes]);

  const togglePlayback = useCallback(() => {
    if (!result) return;

    if (playbackStatus === 'playing') {
      setPlaybackStatus('paused');
      return;
    }

    if (playbackStatus === 'finished') {
      playbackProgressRef.current = 0;
      setPlaybackProgress(0);
    }

    setPlaybackStatus('playing');
  }, [playbackStatus, result]);

  const restartPlayback = useCallback(() => {
    if (!result) return;

    playbackProgressRef.current = 0;
    setPlaybackProgress(0);
    setPlaybackStatus('playing');
  }, [result]);

  const runSimulation = useCallback(() => {
    try {
      const nextResult = simulateProcess(
        simulationSteps,
        simulationConnections,
        { monthlyVolume, workdaysPerMonth, hoursPerDay },
      );

      setResult(nextResult);
      setSimulationError(null);
      const taskMetrics = new Map(
        nextResult.taskMetrics.map((metric) => [metric.taskId, metric]),
      );

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          const metric = taskMetrics.get(node.id);

          return {
            ...node,
            data: {
              ...node.data,
              isBottleneck:
                node.id === nextResult.bottleneckTaskId &&
                (metric?.workloadRatio ?? 0) >= 1,
              simulation: metric
                ? {
                    visits: metric.visits,
                    averageQueueMinutes: metric.averageQueueMinutes,
                    workloadRatio: metric.workloadRatio,
                  }
                : undefined,
            },
          };
        }),
      );

      playbackProgressRef.current = 0;
      setPlaybackProgress(0);
      setPlaybackStatus('playing');
    } catch (error) {
      setResult(null);
      playbackProgressRef.current = 0;
      setPlaybackProgress(0);
      setPlaybackStatus('idle');
      setSimulationError(error instanceof Error ? error.message : 'Unable to run the simulation.');
    }
  }, [
    hoursPerDay,
    monthlyVolume,
    setNodes,
    simulationConnections,
    simulationSteps,
    workdaysPerMonth,
  ]);

  return (
    <Box
      component="main"
      sx={(theme) => ({
        minHeight: '100vh',
        bgcolor: 'background.default',
        backgroundImage: `radial-gradient(circle at 18% 0%, ${alpha(theme.palette.primary.main, 0.11)}, transparent 30%)`,
        p: { xs: 1.5, md: 2.5 },
      })}
    >
      <Stack spacing={2} sx={{ maxWidth: 1760, mx: 'auto' }}>
        <Stack
          className="processlab-no-print"
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          gap={1.5}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
              <ScienceRoundedIcon color="primary" />
              <Typography variant="h4">ProcessLab</Typography>
              <Chip size="small" label="V1" variant="outlined" />
              <Chip
                size="small"
                color={workspaceReady ? 'success' : 'default'}
                variant="outlined"
                label={workspaceReady ? 'Autosaved locally' : 'Loading workspace'}
              />
            </Stack>
            <TextField
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              variant="standard"
              label="Project name"
              sx={{ mt: 1, minWidth: 280 }}
            />
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              startIcon={<AddRoundedIcon />}
              variant="outlined"
              onClick={() => applyTemplate(blankProcessTemplate)}
            >
              New
            </Button>
            <Button
              startIcon={<FolderOpenRoundedIcon />}
              variant="outlined"
              onClick={() => setTemplateDialogOpen(true)}
            >
              Templates
            </Button>
            <Button
              startIcon={<UploadFileRoundedIcon />}
              variant="outlined"
              onClick={() => importInputRef.current?.click()}
            >
              Import
            </Button>
            <Button
              startIcon={<FileDownloadRoundedIcon />}
              variant="outlined"
              onClick={exportWorkspace}
            >
              Export
            </Button>
            <Button startIcon={<AddRoundedIcon />} variant="outlined" onClick={insertTask}>
              Insert task
            </Button>
            <Button startIcon={<CallSplitRoundedIcon />} variant="outlined" onClick={insertDecision}>
              Insert decision
            </Button>
            <Button startIcon={<BoltRoundedIcon />} variant="contained" onClick={runSimulation}>
              Run simulation
            </Button>
            <input
              ref={importInputRef}
              hidden
              type="file"
              accept=".json,.processlab.json,application/json"
              onChange={importWorkspace}
            />
          </Stack>
        </Stack>

        {simulationError ? <Alert severity="error">{simulationError}</Alert> : null}

        <Stack
          className="processlab-no-print"
          direction={{ xs: 'column', xl: 'row' }}
          spacing={2}
          alignItems="stretch"
        >
          <Paper
            variant="outlined"
            sx={{
              flex: '1 1 auto',
              minWidth: 0,
              height: { xs: 540, md: 680 },
              overflow: 'hidden',
            }}
          >
            <ReactFlow<ProcessFlowNode, ProcessFlowEdge>
              nodes={displayNodes}
              edges={renderedEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={(changes) => {
                onNodesChange(changes);
                if (changes.some((change) => change.type === 'remove')) {
                  clearResult();
                }
              }}
              onEdgesChange={(changes) => {
                onEdgesChange(changes);
                if (changes.some((change) => change.type === 'remove')) {
                  clearResult();
                }
              }}
              onConnect={onConnect}
              onNodeClick={(_, node) => {
                setSelectedNodeId(node.id);
                setSelectedEdgeId(null);
              }}
              onEdgeClick={(_, edge) => {
                setSelectedEdgeId(edge.id);
                setSelectedNodeId(null);
              }}
              onPaneClick={() => {
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
              }}
              fitView
              fitViewOptions={{ padding: 0.16, minZoom: 0.62, maxZoom: 0.9 }}
              minZoom={0.3}
              maxZoom={1.8}
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
              <MiniMap pannable zoomable />
              <Controls />
            </ReactFlow>
          </Paper>

          <Paper
            variant="outlined"
            sx={{
              width: { xs: '100%', xl: 370 },
              flex: { xl: '0 0 370px' },
              p: 2,
            }}
          >
            <Typography variant="h6">Simulation setup</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              One month is represented as compressed working minutes. No external data is used.
            </Typography>

            <Stack spacing={1.5} mt={2}>
              <TextField
                label="Transactions / month"
                type="number"
                value={monthlyVolume}
                onChange={(event) => {
                  setMonthlyVolume(Math.max(1, Number(event.target.value)));
                  clearResult();
                }}
                slotProps={{ htmlInput: { min: 1, max: 50000 } }}
              />
              <Stack direction="row" spacing={1.5}>
                <TextField
                  label="Workdays"
                  type="number"
                  value={workdaysPerMonth}
                  onChange={(event) => {
                    setWorkdaysPerMonth(Math.max(1, Number(event.target.value)));
                    clearResult();
                  }}
                  slotProps={{ htmlInput: { min: 1, max: 31 } }}
                />
                <TextField
                  label="Hours / day"
                  type="number"
                  value={hoursPerDay}
                  onChange={(event) => {
                    setHoursPerDay(Math.max(1, Number(event.target.value)));
                    clearResult();
                  }}
                  slotProps={{ htmlInput: { min: 1, max: 24 } }}
                />
              </Stack>
            </Stack>

            <Divider sx={{ my: 2.5 }} />

            {selectedNode ? (
              <>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="h6">Selected step</Typography>
                  <Chip size="small" label={selectedNode.data.kind} variant="outlined" />
                </Stack>

                <Stack spacing={1.5} mt={2}>
                  <TextField
                    label="Step name"
                    value={selectedNode.data.label}
                    onChange={(event) => updateSelectedNode({ label: event.target.value })}
                  />

                  {selectedNode.data.kind === 'task' ? (
                    <>
                      <TextField
                        label="Duration (minutes)"
                        type="number"
                        value={selectedNode.data.durationMinutes}
                        onChange={(event) =>
                          updateSelectedNode({
                            durationMinutes: Math.max(0.1, Number(event.target.value)),
                          })
                        }
                        slotProps={{ htmlInput: { min: 0.1, step: 0.1 } }}
                      />
                      <TextField
                        label="Workers"
                        type="number"
                        value={selectedNode.data.workers}
                        onChange={(event) =>
                          updateSelectedNode({
                            workers: Math.max(1, Math.floor(Number(event.target.value))),
                          })
                        }
                        slotProps={{ htmlInput: { min: 1, step: 1 } }}
                      />
                      <TextField
                        label="Hourly cost (€)"
                        type="number"
                        value={selectedNode.data.hourlyCost}
                        onChange={(event) =>
                          updateSelectedNode({
                            hourlyCost: Math.max(0, Number(event.target.value)),
                          })
                        }
                        slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                      />
                      <TextField
                        label="Duration variability (%)"
                        type="number"
                        value={selectedNode.data.variabilityPercent}
                        onChange={(event) =>
                          updateSelectedNode({
                            variabilityPercent: Math.min(
                              100,
                              Math.max(0, Number(event.target.value)),
                            ),
                          })
                        }
                        helperText="0% is fixed. Higher values simulate real-world task-time variation."
                        slotProps={{ htmlInput: { min: 0, max: 100, step: 5 } }}
                      />
                    </>
                  ) : null}

                  {selectedNode.data.kind === 'decision' ? (
                    <Stack spacing={1}>
                      <Typography variant="subtitle2">Branch probabilities</Typography>
                      {selectedNodeBranches.map((edge) => {
                        const target = nodes.find((node) => node.id === edge.target);
                        return (
                          <TextField
                            key={edge.id}
                            label={target?.data.label ?? 'Branch'}
                            type="number"
                            value={Math.round((edge.data?.probability ?? 0) * 100)}
                            onChange={(event) =>
                              updateBranchProbability(edge.id, Number(event.target.value))
                            }
                            slotProps={{
                              htmlInput: { min: 1, max: 99, step: 1 },
                              input: { endAdornment: <Typography color="text.secondary">%</Typography> },
                            }}
                          />
                        );
                      })}
                      <Typography variant="caption" color="text.secondary">
                        Changing one branch automatically rebalances the others to keep the total at 100%.
                      </Typography>
                    </Stack>
                  ) : null}

                  {selectedNode.data.kind !== 'start' && selectedNode.data.kind !== 'end' ? (
                    <Button
                      color="error"
                      variant="text"
                      startIcon={<DeleteOutlineRoundedIcon />}
                      onClick={deleteSelectedStep}
                    >
                      Delete step
                    </Button>
                  ) : null}
                </Stack>
              </>
            ) : selectedEdge ? (
              <>
                <Typography variant="h6">Selected connection</Typography>
                <Typography variant="body2" color="text.secondary" mt={1}>
                  Insert a task or decision here using the toolbar above.
                </Typography>
                {selectedEdge.data?.probability !== undefined ? (
                  <Chip
                    sx={{ mt: 2 }}
                    label={`Branch probability ${Math.round(selectedEdge.data.probability * 100)}%`}
                    variant="outlined"
                    color="secondary"
                  />
                ) : null}
              </>
            ) : (
              <>
                <Typography variant="h6">Inspector</Typography>
                <Typography variant="body2" color="text.secondary" mt={1}>
                  Select a step to edit it, or select a connection to insert a new step exactly where you want it.
                </Typography>
              </>
            )}
          </Paper>
        </Stack>

        {result ? (
          <Paper className="processlab-print-report" variant="outlined" sx={{ p: 2 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'stretch', md: 'flex-start' }}
              gap={2}
            >
              <Box>
                <Typography variant="overline" color="text.secondary">
                  {projectName}
                </Typography>
                <Typography variant="h6">Simulation result</Typography>
                <Typography variant="body2" color="text.secondary">
                  {result.transactions.toLocaleString()} transactions across {result.taskMetrics.length} working tasks
                </Typography>
              </Box>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {constraintLabel ? (
                  <Chip
                    color={constraintColor}
                    variant="outlined"
                    label={constraintLabel}
                  />
                ) : null}
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={
                    playbackStatus === 'playing'
                      ? <PauseRoundedIcon />
                      : <PlayArrowRoundedIcon />
                  }
                  onClick={togglePlayback}
                >
                  {playbackStatus === 'playing'
                    ? 'Pause replay'
                    : playbackStatus === 'finished'
                      ? 'Play again'
                      : 'Play replay'}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<RestartAltRoundedIcon />}
                  onClick={restartPlayback}
                >
                  Restart
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SaveRoundedIcon />}
                  onClick={() => setBaseline(result)}
                >
                  {baseline ? 'Replace baseline' : 'Quick baseline'}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SaveRoundedIcon />}
                  onClick={() => {
                    setScenarioName('Scenario ' + (savedScenarios.length + 1));
                    setScenarioDialogOpen(true);
                  }}
                >
                  Save scenario
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SpeedRoundedIcon />}
                  onClick={runStressTest}
                >
                  Stress test
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PrintRoundedIcon />}
                  onClick={printReport}
                >
                  Print report
                </Button>
              </Stack>
            </Stack>

            <Box
              sx={(theme) => ({
                mt: 2,
                p: 1.5,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.common.white, 0.025),
                border: '1px solid',
                borderColor: alpha(theme.palette.common.white, 0.07),
              })}
            >
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                alignItems={{ xs: 'stretch', md: 'center' }}
                justifyContent="space-between"
                gap={1.25}
              >
                <Box>
                  <Typography variant="subtitle2">Sampled transaction replay</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {result.trace.sampledTransactionIds.length} transactions · {formatPlaybackTime(playbackTime, hoursPerDay)}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="caption" color="text.secondary">
                    Speed
                  </Typography>
                  <ButtonGroup size="small" variant="outlined" aria-label="Replay speed">
                    {[0.5, 1, 2, 4].map((speed) => (
                      <Button
                        key={speed}
                        variant={playbackSpeed === speed ? 'contained' : 'outlined'}
                        onClick={() => setPlaybackSpeed(speed)}
                      >
                        {speed}×
                      </Button>
                    ))}
                  </ButtonGroup>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={
                      playbackStatus === 'finished'
                        ? 'Finished'
                        : playbackStatus === 'paused'
                          ? 'Paused'
                          : playbackStatus === 'playing'
                            ? 'Playing'
                            : 'Ready'
                    }
                  />
                </Stack>
              </Stack>

              <LinearProgress
                variant="determinate"
                value={playbackProgress * 100}
                sx={{ mt: 1.25, height: 6, borderRadius: 999 }}
              />
            </Box>

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" flexWrap="wrap" gap={3}>
              <Box sx={{ minWidth: 0, flex: '1 1 180px' }}>
                <MetricCard
                  label="Processing cost"
                  value={currencyFormatter.format(result.totalProcessingCost)}
                  detail={`${currencyFormatter.format(result.costPerTransaction)} / transaction`}
                />
                {baseline ? (
                  <Box mt={1}>
                    <ComparisonChip
                      current={result.totalProcessingCost}
                      baseline={baseline.totalProcessingCost}
                    />
                  </Box>
                ) : null}
              </Box>

              <Box sx={{ minWidth: 0, flex: '1 1 180px' }}>
                <MetricCard label="Average cycle" value={formatDuration(result.averageCycleMinutes)} />
                {baseline ? (
                  <Box mt={1}>
                    <ComparisonChip
                      current={result.averageCycleMinutes}
                      baseline={baseline.averageCycleMinutes}
                    />
                  </Box>
                ) : null}
              </Box>

              <Box sx={{ minWidth: 0, flex: '1 1 180px' }}>
                <MetricCard label="Average queue" value={formatDuration(result.averageQueueMinutes)} />
                {baseline ? (
                  <Box mt={1}>
                    <ComparisonChip
                      current={result.averageQueueMinutes}
                      baseline={baseline.averageQueueMinutes}
                    />
                  </Box>
                ) : null}
              </Box>

              <Box sx={{ minWidth: 0, flex: '1 1 180px' }}>
                <MetricCard
                  label="Completed in month"
                  value={result.throughputWithinMonth.toLocaleString()}
                  detail={`${result.backlogAtMonthEnd.toLocaleString()} month-end carryover`}
                />
                {baseline ? (
                  <Box mt={1}>
                    <ComparisonChip
                      current={result.throughputWithinMonth}
                      baseline={baseline.throughputWithinMonth}
                      lowerIsBetter={false}
                    />
                  </Box>
                ) : null}
              </Box>
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Stack spacing={1}>
              {result.taskMetrics.map((metric) => (
                <Stack
                  key={metric.taskId}
                  direction={{ xs: 'column', md: 'row' }}
                  alignItems={{ xs: 'stretch', md: 'center' }}
                  gap={1}
                  sx={(theme) => ({
                    px: 1.5,
                    py: 1.2,
                    borderRadius: 1.5,
                    bgcolor:
                      metric.taskId === result.bottleneckTaskId &&
                      metric.workloadRatio >= 0.8
                        ? alpha(theme.palette.warning.main, 0.08)
                        : alpha(theme.palette.common.white, 0.025),
                  })}
                >
                  <Typography fontWeight={650} sx={{ flex: '1 1 240px' }}>
                    {metric.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 105 }}>
                    Load {(metric.workloadRatio * 100).toFixed(0)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 135 }}>
                    Queue {formatDuration(metric.averageQueueMinutes)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 150 }}>
                    Capacity {metric.monthlyCapacity.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 115 }}>
                    Visits {metric.visits.toLocaleString()}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
        ) : baseline ? (
          <Alert severity="info">
            Baseline saved. Change the workflow or assumptions, then run the simulation again to compare the scenario.
          </Alert>
        ) : null}

        {result ? <InsightsPanel insights={simulationInsights} /> : null}

        {result && stressTestResult ? (
          <StressTestPanel result={stressTestResult} />
        ) : null}

        {result ? (
          <ScenarioPanel
            scenarios={savedScenarios}
            currentResult={result}
            onSetBaseline={useScenarioAsBaseline}
            onDelete={deleteScenario}
          />
        ) : null}
      </Stack>

      <Dialog
        open={templateDialogOpen}
        onClose={() => setTemplateDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Start from a template</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            {[blankProcessTemplate, ...processTemplates].map((template) => (
              <Button
                key={template.id}
                variant="outlined"
                onClick={() => applyTemplate(template)}
                sx={{
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  px: 2,
                  py: 1.5,
                }}
              >
                <Box>
                  <Typography fontWeight={700}>{template.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {template.description}
                  </Typography>
                </Box>
              </Button>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={scenarioDialogOpen}
        onClose={() => setScenarioDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Save scenario</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Scenario name"
            value={scenarioName}
            onChange={(event) => setScenarioName(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScenarioDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveScenario}>
            Save scenario
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
