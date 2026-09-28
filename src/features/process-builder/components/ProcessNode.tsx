'use client';

import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { Box, Stack, Typography, alpha } from '@mui/material';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ProcessFlowNode } from '../process-builder.types';

export function ProcessNode({ data, selected }: NodeProps<ProcessFlowNode>) {
  return (
    <Box
      sx={(theme) => ({
        minWidth: 210,
        border: '1px solid',
        borderColor: selected ? 'primary.main' : alpha(theme.palette.common.white, 0.12),
        bgcolor: alpha(theme.palette.background.paper, 0.96),
        borderRadius: 2.5,
        px: 2,
        py: 1.6,
        boxShadow: selected ? `0 0 0 3px ${alpha(theme.palette.primary.main, 0.14)}` : 'none',
        transition: theme.transitions.create(['border-color', 'box-shadow']),
      })}
    >
      <Handle type="target" position={Position.Left} />
      <Typography variant="subtitle2" fontWeight={700} noWrap>
        {data.label}
      </Typography>
      <Stack direction="row" spacing={1.5} mt={1.2} color="text.secondary">
        <Stack direction="row" spacing={0.5} alignItems="center">
          <AccessTimeRoundedIcon sx={{ fontSize: 15 }} />
          <Typography variant="caption">{data.durationMinutes} min</Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <GroupsRoundedIcon sx={{ fontSize: 15 }} />
          <Typography variant="caption">{data.workers}</Typography>
        </Stack>
      </Stack>
      <Handle type="source" position={Position.Right} />
    </Box>
  );
}
