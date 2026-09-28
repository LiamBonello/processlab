'use client';

import { useCallback, useMemo, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
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
  type NodeTypes,
} from '@xyflow/react';
import { ProcessNode } from './components/ProcessNode';
import type { ProcessFlowEdge, ProcessFlowNode } from './process-builder.types';
import { simulateProcess } from '@/features/simulation/engine/simulate';
import type { SimulationResult } from '@/features/simulation/engine/types';

const initialNodes: ProcessFlowNode[] = [
  {
    id: 'check-invoice',
    type: 'process',
    position: { x: 60, y: 170 },
    data: { label: 'Check invoice', durationMinutes: 5, workers: 2, hourlyCost: 22 },
  },
  {
    id: 'manager-approval',
    type: 'process',
    position: { x: 350, y: 170 },
    data: { label: 'Manager approval', durationMinutes: 8, workers: 1, hourlyCost: 35 },
  },
  {
    id: 'enter-system',
    type: 'process',
    position: { x: 640, y: 170 },
    data: { label: 'Enter into system', durationMinutes: 4, workers: 1, hourlyCost: 22 },
  },
  {
    id: 'payment',
    type: 'process',
    position: { x: 930, y: 170 },
    data: { label: 'Prepare payment', durationMinutes: 3, workers: 1, hourlyCost: 24 },
  },
];

const initialEdges: ProcessFlowEdge[] = [
  { id: 'e1', source: 'check-invoice', target: 'manager-approval' },
  { id: 'e2', source: 'manager-approval', target: 'enter-system' },
  { id: 'e3', source: 'enter-system', target: 'payment' },
];

const nodeTypes: NodeTypes = { process: ProcessNode };

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

export function ProcessBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState<ProcessFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<ProcessFlowEdge>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('manager-approval');
  const [monthlyVolume, setMonthlyVolume] = useState(800);
  const [workdaysPerMonth, setWorkdaysPerMonth] = useState(22);
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((currentEdges) => addEdge(connection, currentEdges));
      setResult(null);
    },
    [setEdges],
  );

  const updateSelectedNode = useCallback(
    (patch: Partial<ProcessFlowNode['data']>) => {
      if (!selectedNodeId) return;
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === selectedNodeId
            ? { ...node, data: { ...node.data, ...patch } }
            : node,
        ),
      );
      setResult(null);
    },
    [selectedNodeId, setNodes],
  );

  const addTask = useCallback(() => {
    const id = `task-${crypto.randomUUID()}`;
    setNodes((currentNodes) => [
      ...currentNodes,
      {
        id,
        type: 'process',
        position: { x: 180 + currentNodes.length * 40, y: 340 + currentNodes.length * 18 },
        data: { label: 'New task', durationMinutes: 5, workers: 1, hourlyCost: 25 },
      },
    ]);
    setSelectedNodeId(id);
    setResult(null);
  }, [setNodes]);

  const deleteSelectedTask = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== selectedNodeId));
    setEdges((currentEdges) =>
      currentEdges.filter(
        (edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId,
      ),
    );
    setSelectedNodeId(null);
    setResult(null);
  }, [selectedNodeId, setEdges, setNodes]);

  const runSimulation = useCallback(() => {
    try {
      const nextResult = simulateProcess(
        nodes.map((node) => ({
          id: node.id,
          label: node.data.label,
          durationMinutes: node.data.durationMinutes,
          workers: node.data.workers,
          hourlyCost: node.data.hourlyCost,
        })),
        edges.map((edge) => ({ source: edge.source, target: edge.target })),
        { monthlyVolume, workdaysPerMonth, hoursPerDay },
      );
      setResult(nextResult);
      setSimulationError(null);
    } catch (error) {
      setResult(null);
      setSimulationError(error instanceof Error ? error.message : 'Unable to run the simulation.');
    }
  }, [edges, hoursPerDay, monthlyVolume, nodes, workdaysPerMonth]);

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
              <Chip size="small" label="Prototype" variant="outlined" />
            </Stack>
            <Typography color="text.secondary" mt={0.5}>
              Build the process, run the numbers, find the bottleneck.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button startIcon={<AddRoundedIcon />} variant="outlined" onClick={addTask}>
              Add task
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
              height: { xs: 520, md: 650 },
              overflow: 'hidden',
            }}
          >
            <ReactFlow<ProcessFlowNode, ProcessFlowEdge>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={(changes) => {
                onNodesChange(changes);
                setResult(null);
              }}
              onEdgesChange={(changes) => {
                onEdgesChange(changes);
                setResult(null);
              }}
              onConnect={onConnect}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              fitView
              minZoom={0.35}
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
              width: { xs: '100%', xl: 350 },
              flex: { xl: '0 0 350px' },
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
                  setResult(null);
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
                    setResult(null);
                  }}
                  slotProps={{ htmlInput: { min: 1, max: 31 } }}
                />
                <TextField
                  label="Hours / day"
                  type="number"
                  value={hoursPerDay}
                  onChange={(event) => {
                    setHoursPerDay(Math.max(1, Number(event.target.value)));
                    setResult(null);
                  }}
                  slotProps={{ htmlInput: { min: 1, max: 24 } }}
                />
              </Stack>
            </Stack>

            <Divider sx={{ my: 2.5 }} />

            <Typography variant="h6">Selected task</Typography>
            {selectedNode ? (
              <Stack spacing={1.5} mt={2}>
                <TextField
                  label="Task name"
                  value={selectedNode.data.label}
                  onChange={(event) => updateSelectedNode({ label: event.target.value })}
                />
                <TextField
                  label="Duration (minutes)"
                  type="number"
                  value={selectedNode.data.durationMinutes}
                  onChange={(event) =>
                    updateSelectedNode({ durationMinutes: Math.max(0.1, Number(event.target.value)) })
                  }
                  slotProps={{ htmlInput: { min: 0.1, step: 0.1 } }}
                />
                <TextField
                  label="Workers"
                  type="number"
                  value={selectedNode.data.workers}
                  onChange={(event) =>
                    updateSelectedNode({ workers: Math.max(1, Math.floor(Number(event.target.value))) })
                  }
                  slotProps={{ htmlInput: { min: 1, step: 1 } }}
                />
                <TextField
                  label="Hourly cost (€)"
                  type="number"
                  value={selectedNode.data.hourlyCost}
                  onChange={(event) =>
                    updateSelectedNode({ hourlyCost: Math.max(0, Number(event.target.value)) })
                  }
                  slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                />
                <Button
                  color="error"
                  variant="text"
                  startIcon={<DeleteOutlineRoundedIcon />}
                  onClick={deleteSelectedTask}
                >
                  Delete task
                </Button>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" mt={1.5}>
                Select a task on the canvas to edit it.
              </Typography>
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
                  {result.transactions.toLocaleString()} transactions across {nodes.length} tasks
                </Typography>
              </Box>
              {result.bottleneckLabel ? (
                <Chip
                  color="warning"
                  variant="outlined"
                  label={`Bottleneck: ${result.bottleneckLabel}`}
                />
              ) : null}
            </Stack>

            <Divider sx={{ my: 2 }} />
            <Stack direction="row" flexWrap="wrap" gap={3}>
              <MetricCard
                label="Processing cost"
                value={currencyFormatter.format(result.totalProcessingCost)}
                detail={`${currencyFormatter.format(result.costPerTransaction)} / transaction`}
              />
              <MetricCard label="Average cycle" value={formatDuration(result.averageCycleMinutes)} />
              <MetricCard label="Average queue" value={formatDuration(result.averageQueueMinutes)} />
              <MetricCard
                label="Completed in month"
                value={result.throughputWithinMonth.toLocaleString()}
                detail={`${result.backlogAtMonthEnd.toLocaleString()} backlog`}
              />
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
                      metric.taskId === result.bottleneckTaskId
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
                </Stack>
              ))}
            </Stack>
          </Paper>
        ) : null}
      </Stack>
    </Box>
  );
}
