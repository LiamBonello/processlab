'use client';

import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import {
  Box,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import type { StressTestResult } from '@/features/simulation/stress-test';
import { formatSimulationDuration } from '@/features/simulation/format';

function loadColor(load: number): 'error' | 'warning' | 'primary' {
  if (load >= 1) return 'error';
  if (load >= 0.8) return 'warning';
  return 'primary';
}

export function StressTestPanel({
  result,
}: {
  result: StressTestResult;
}) {
  return (
    <Paper className="processlab-print-section" variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        sx={{ justifyContent: 'space-between', gap: 1.5 }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <SpeedRoundedIcon color="primary" />
          <Box>
            <Typography variant="h6">Volume stress test</Typography>
            <Typography variant="body2" color="text.secondary">
              Capacity response as monthly volume changes.
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {result.firstWarningVolume ? (
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              label={'80% load around ' + result.firstWarningVolume.toLocaleString() + '/mo'}
            />
          ) : null}
          {result.firstOverloadedVolume ? (
            <Chip
              size="small"
              color="error"
              variant="outlined"
              label={'Capacity exceeded around ' + result.firstOverloadedVolume.toLocaleString() + '/mo'}
            />
          ) : (
            <Chip
              size="small"
              color="success"
              variant="outlined"
              label="No overload in tested range"
            />
          )}
        </Stack>
      </Stack>

      <Stack spacing={1} sx={{ mt: 2 }}>
        {result.points.map((point) => (
          <Box
            key={point.multiplier}
            sx={(theme) => ({
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: '120px minmax(180px, 1fr) 120px 180px',
              },
              gap: 1.25,
              alignItems: 'center',
              px: 1.5,
              py: 1.2,
              borderRadius: 1.5,
              bgcolor: alpha(theme.palette.common.white, 0.025),
            })}
          >
            <Box>
              <Typography sx={{ fontWeight: 700 }}>
                {point.monthlyVolume.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {point.multiplier}x volume
              </Typography>
            </Box>

            <Box>
              <Stack
                direction="row"
                sx={{ justifyContent: 'space-between', mb: 0.5 }}
              >
                <Typography variant="caption" color="text.secondary">
                  {point.constrainedTaskLabel ?? 'No task'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {Math.round(point.highestLoad * 100)}%
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, point.highestLoad * 100)}
                color={loadColor(point.highestLoad)}
                sx={{ height: 6, borderRadius: 999 }}
              />
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Carryover
              </Typography>
              <Typography>
                {point.carryover.toLocaleString()}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Avg queue
              </Typography>
              <Typography>
                {formatSimulationDuration(point.averageQueueMinutes)}
              </Typography>
            </Box>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}
