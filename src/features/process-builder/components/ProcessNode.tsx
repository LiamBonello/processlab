'use client';

import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import CallSplitRoundedIcon from '@mui/icons-material/CallSplitRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { Box, Chip, Stack, Typography, alpha } from '@mui/material';
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
      ) : data.kind === 'decision' ? (
        <Typography variant="caption" color="text.secondary" display="block" mt={1}>
          Routes work by probability
        </Typography>
      ) : null}

      {canSend ? <Handle type="source" position={Position.Right} /> : null}
    </Box>
  );
}
