'use client';

import { Box, Stack, Typography, alpha } from '@mui/material';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import type { ProcessFlowEdge } from '../process-builder.types';

export function SimulationEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  selected,
  data,
}: EdgeProps<ProcessFlowEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.28,
  });

  const probability = data?.probability;
  const visits = data?.simulationVisits;
  const activeTraceIds = data?.activeTraceIds ?? [];
  const playbackSpeed = data?.playbackSpeed ?? 1;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected ? 2.5 : 1.7,
          opacity: visits === 0 ? 0.35 : 1,
        }}
      />

      {activeTraceIds.map((traceId, index) => (
        <circle
          key={traceId}
          r={4.2}
          fill="var(--mui-palette-primary-main)"
          opacity={0.96}
        >
          <animateMotion
            dur={String(Math.max(0.22, 0.78 / playbackSpeed)) + 's'}
            begin={String(index * 0.035) + 's'}
            repeatCount="1"
            path={edgePath}
          />
        </circle>
      ))}

      {probability !== undefined || visits !== undefined ? (
        <EdgeLabelRenderer>
          <Box
            className="nodrag nopan"
            sx={(theme) => ({
              position: 'absolute',
              transform: 'translate(-50%, -50%) translate(' + labelX + 'px, ' + labelY + 'px)',
              px: 0.8,
              py: 0.45,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: alpha(theme.palette.common.white, 0.12),
              bgcolor: alpha(theme.palette.background.paper, 0.96),
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            })}
          >
            <Stack direction="row" spacing={0.65} alignItems="center">
              {probability !== undefined ? (
                <Typography variant="caption" fontWeight={750} color="secondary.main">
                  {Math.round(probability * 100)}%
                </Typography>
              ) : null}
              {visits !== undefined ? (
                <Typography variant="caption" color="text.secondary">
                  {visits.toLocaleString()} {visits === 1 ? 'visit' : 'visits'}
                </Typography>
              ) : null}
            </Stack>
          </Box>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
