'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import CallSplitRoundedIcon from '@mui/icons-material/CallSplitRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
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
import { ProcessNode } from './components/ProcessNode';
import { SimulationEdge } from './components/SimulationEdge';
import type { ProcessFlowEdge, ProcessFlowNode } from './process-builder.types';
import { simulateProcess } from '@/features/simulation/engine/simulate';
import type { SimulationResult } from '@/features/simulation/engine/types';

const initialNodes: ProcessFlowNode[] = [
  {
    id: 'start',
    type: 'process',
    position: { x: 40, y: 220 },
    data: { label: 'Invoice received', kind: 'start', durationMinutes: 0, workers: 0, hourlyCost: 0 },
  },
  {
    id: 'check-invoice',
    type: 'process',
    position: { x: 270, y: 220 },
    data: { label: 'Check invoice', kind: 'task', durationMinutes: 5, workers: 2, hourlyCost: 22 },
  },
  {
    id: 'needs-approval',
    type: 'process',
    position: { x: 560, y: 220 },
    data: { label: 'Needs approval?', kind: 'decision', durationMinutes: 0, workers: 0, hourlyCost: 0 },
  },
  {
    id: 'manager-approval',
    type: 'process',
    position: { x: 850, y: 80 },
    data: { label: 'Manager approval', kind: 'task', durationMinutes: 8, workers: 1, hourlyCost: 35 },
  },
  {
    id: 'enter-system',
    type: 'process',
    position: { x: 1120, y: 220 },
    data: { label: 'Enter into system', kind: 'task', durationMinutes: 4, workers: 1, hourlyCost: 22 },
  },
  {
    id: 'payment',
    type: 'process',
    position: { x: 1410, y: 220 },
    data: { label: 'Prepare payment', kind: 'task', durationMinutes: 3, workers: 1, hourlyCost: 24 },
  },
  {
    id: 'end',
    type: 'process',
    position: { x: 1710, y: 220 },
    data: { label: 'Ready for payment', kind: 'end', durationMinutes: 0, workers: 0, hourlyCost: 0 },
  },
];

const initialEdges: ProcessFlowEdge[] = [
  { id: 'e-start-check', source: 'start', target: 'check-invoice', data: {} },
  { id: 'e-check-decision', source: 'check-invoice', target: 'needs-approval', data: {} },
  {
    id: 'e-decision-approval',
    source: 'needs-approval',
    target: 'manager-approval',
    data: { probability: 0.35 },
  },
  {
    id: 'e-decision-enter',
    source: 'needs-approval',
    target: 'enter-system',
    data: { probability: 0.65 },
  },
  { id: 'e-approval-enter', source: 'manager-approval', target: 'enter-system', data: {} },
  { id: 'e-enter-payment', source: 'enter-system', target: 'payment', data: {} },
  { id: 'e-payment-end', source: 'payment', target: 'end', data: {} },
];

const nodeTypes: NodeTypes = { process: ProcessNode };
const edgeTypes: EdgeTypes = { simulation: SimulationEdge };

const currencyFormatter = new Intl.NumberFormat('en', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

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
  const [monthlyVolume, setMonthlyVolume] = useState(800);
  const [workdaysPerMonth, setWorkdaysPerMonth] = useState(22);
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [baseline, setBaseline] = useState<SimulationResult | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
    };
  }, []);

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

  const renderedEdges = useMemo(() => {
    const routeMetrics = new Map(
      (result?.routeMetrics ?? []).map((metric) => [
        `${metric.source}::${metric.target}`,
        metric,
      ]),
    );

    return edges.map((edge) => {
      const metric = routeMetrics.get(`${edge.source}::${edge.target}`);

      return {
        ...edge,
        type: 'simulation' as const,
        data: {
          ...edge.data,
          simulationVisits: metric?.visits,
          isPlaying: isAnimating,
        },
        style: {
          ...edge.style,
          strokeWidth: isAnimating ? 2.2 : 1.7,
        },
      };
    });
  }, [edges, isAnimating, result]);

  const clearResult = useCallback(() => {
    setResult(null);
    setSimulationError(null);
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

  const replaySimulation = useCallback(() => {
    if (!result) return;

    setIsAnimating(true);
    if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
    animationTimeoutRef.current = setTimeout(() => setIsAnimating(false), 4200);
  }, [result]);

  const runSimulation = useCallback(() => {
    try {
      const nextResult = simulateProcess(
        nodes.map((node) => ({
          id: node.id,
          label: node.data.label,
          kind: node.data.kind,
          durationMinutes: node.data.kind === 'task' ? node.data.durationMinutes : undefined,
          workers: node.data.kind === 'task' ? node.data.workers : undefined,
          hourlyCost: node.data.kind === 'task' ? node.data.hourlyCost : undefined,
        })),
        edges.map((edge) => ({
          source: edge.source,
          target: edge.target,
          probability: edge.data?.probability,
        })),
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

      setIsAnimating(true);
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = setTimeout(() => setIsAnimating(false), 4200);
    } catch (error) {
      setResult(null);
      setIsAnimating(false);
      setSimulationError(error instanceof Error ? error.message : 'Unable to run the simulation.');
    }
  }, [edges, hoursPerDay, monthlyVolume, nodes, setNodes, workdaysPerMonth]);

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
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          gap={1.5}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <ScienceRoundedIcon color="primary" />
              <Typography variant="h4">ProcessLab</Typography>
              <Chip size="small" label="v0.3" variant="outlined" />
            </Stack>
            <Typography color="text.secondary" mt={0.5}>
              Build the process, run the numbers, find the bottleneck.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button startIcon={<AddRoundedIcon />} variant="outlined" onClick={insertTask}>
              Insert task
            </Button>
            <Button startIcon={<CallSplitRoundedIcon />} variant="outlined" onClick={insertDecision}>
              Insert decision
            </Button>
            <Button startIcon={<BoltRoundedIcon />} variant="contained" onClick={runSimulation}>
              Run simulation
            </Button>
          </Stack>
        </Stack>

        {simulationError ? <Alert severity="error">{simulationError}</Alert> : null}

        <Stack direction={{ xs: 'column', xl: 'row' }} spacing={2} alignItems="stretch">
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
              nodes={nodes}
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
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'stretch', md: 'flex-start' }}
              gap={2}
            >
              <Box>
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
                  startIcon={<ReplayRoundedIcon />}
                  onClick={replaySimulation}
                  disabled={isAnimating}
                >
                  {isAnimating ? 'Playing' : 'Replay flow'}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SaveRoundedIcon />}
                  onClick={() => setBaseline(result)}
                >
                  {baseline ? 'Replace baseline' : 'Save baseline'}
                </Button>
              </Stack>
            </Stack>

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
      </Stack>
    </Box>
  );
}
