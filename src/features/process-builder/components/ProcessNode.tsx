'use client';

import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import CallSplitRoundedIcon from '@mui/icons-material/CallSplitRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { Box, Chip, LinearProgress, Stack, Typography, alpha } from '@mui/material';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ProcessFlowNode } from '../process-builder.types';

const kindMeta = {
  start: {
    label: 'Start',
    icon: PlayArrowRoundedIcon,
  },
  task: {
    label: 'Task',
    icon: AccessTimeRoundedIcon,
  },
  decision: {
    label: 'Decision',
    icon: CallSplitRoundedIcon,
  },
  end: {
    label: 'End',
    icon: FlagRoundedIcon,
  },
} as const;

export function ProcessNode({ data, selected }: NodeProps<ProcessFlowNode>) {
  const meta = kindMeta[data.kind];
  const KindIcon = meta.icon;
  const isTerminal = data.kind === 'start' || data.kind === 'end';
  const canReceive = data.kind !== 'start';
  const canSend = data.kind !== 'end';

  return (
    <Box
      sx={(theme) => ({
        minWidth: isTerminal ? 150 : 220,
        border: '1px solid',
        borderColor: data.isBottleneck
          ? 'warning.main'
          : selected
            ? 'primary.main'
            : alpha(theme.palette.common.white, 0.12),
        bgcolor: alpha(theme.palette.background.paper, 0.96),
        borderRadius: data.kind === 'decision' ? 4 : 2.5,
        px: 2,
        py: 1.45,
        boxShadow: data.isBottleneck
          ? `0 0 0 3px ${alpha(theme.palette.warning.main, 0.12)}`
          : selected
            ? `0 0 0 3px ${alpha(theme.palette.primary.main, 0.14)}`
            : 'none',
        transition: theme.transitions.create(['border-color', 'box-shadow']),
      })}
    >
      {canReceive ? <Handle type="target" position={Position.Left} /> : null}

      <Stack direction="row" alignItems="center" spacing={1}>
        <KindIcon
          sx={{
            fontSize: 18,
            color:
              data.kind === 'decision'
                ? 'secondary.main'
                : data.kind === 'start'
                  ? 'success.main'
                  : data.kind === 'end'
                    ? 'error.light'
                    : 'primary.light',
          }}
        />
        <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ flex: 1 }}>
          {data.label}
        </Typography>
        {data.kind !== 'task' ? (
          <Chip size="small" label={meta.label} variant="outlined" sx={{ height: 22 }} />
        ) : null}
      </Stack>

      {data.kind === 'task' ? (
        <>
          <Stack direction="row" spacing={1.5} mt={1.1} color="text.secondary">
            <Stack direction="row" spacing={0.5} alignItems="center">
              <AccessTimeRoundedIcon sx={{ fontSize: 15 }} />
              <Typography variant="caption">{data.durationMinutes} min</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <GroupsRoundedIcon sx={{ fontSize: 15 }} />
              <Typography variant="caption">{data.workers}</Typography>
            </Stack>
          </Stack>

          {data.simulation ? (
            <Box mt={1.15}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.55}>
                <Typography variant="caption" color="text.secondary">
                  {data.simulation.visits.toLocaleString()} visits
                </Typography>
                <Typography
                  variant="caption"
                  color={data.simulation.workloadRatio > 1 ? 'error.main' : 'text.secondary'}
                >
                  {Math.round(data.simulation.workloadRatio * 100)}% load
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, data.simulation.workloadRatio * 100)}
                color={
                  data.simulation.workloadRatio > 1
                    ? 'error'
                    : data.simulation.workloadRatio >= 0.8
                      ? 'warning'
                      : 'primary'
                }
                sx={{ height: 4, borderRadius: 999 }}
              />
              <Typography variant="caption" color="text.secondary" display="block" mt={0.45}>
                Avg queue {data.simulation.averageQueueMinutes.toFixed(1)} min
              </Typography>
            </Box>
          ) : null}
        </>
      ) : data.kind === 'decision' ? (
        <Typography variant="caption" color="text.secondary" display="block" mt={1}>
          Routes work by probability
        </Typography>
      ) : null}

      {data.playback ? (
        <Stack direction="row" spacing={0.65} mt={1} flexWrap="wrap" useFlexGap>
          {data.kind === 'task' && data.playback.queued > 0 ? (
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              label={`Queue ${data.playback.queued}`}
              sx={{ height: 22 }}
            />
          ) : null}
          {data.kind === 'task' && data.playback.processing > 0 ? (
            <Chip
              size="small"
              color="primary"
              label={`Processing ${data.playback.processing}`}
              sx={{ height: 22 }}
            />
          ) : null}
          {data.kind === 'start' && data.playback.traversed > 0 ? (
            <Typography variant="caption" color="success.main">
              {data.playback.traversed} sampled arrivals
            </Typography>
          ) : null}
          {data.kind === 'decision' && data.playback.traversed > 0 ? (
            <Typography variant="caption" color="secondary.main">
              {data.playback.traversed} sampled routed
            </Typography>
          ) : null}
          {data.kind === 'end' && data.playback.completed > 0 ? (
            <Typography variant="caption" color="success.main">
              {data.playback.completed} sampled completed
            </Typography>
          ) : null}
        </Stack>
      ) : null}

      {canSend ? <Handle type="source" position={Position.Right} /> : null}
    </Box>
  );
}
