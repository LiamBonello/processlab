'use client';

import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded';
import {
  Alert,
  Box,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type {
  InsightSeverity,
  SimulationInsight,
} from '@/features/simulation/analysis';

const severityMap: Record<
  InsightSeverity,
  'error' | 'warning' | 'success' | 'info'
> = {
  critical: 'error',
  warning: 'warning',
  opportunity: 'success',
  info: 'info',
};

export function InsightsPanel({
  insights,
}: {
  insights: SimulationInsight[];
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <LightbulbRoundedIcon color="primary" />
        <Box>
          <Typography variant="h6">Process insights</Typography>
          <Typography variant="body2" color="text.secondary">
            Deterministic findings derived from the simulation results.
          </Typography>
        </Box>
      </Stack>

      <Stack spacing={1.25} sx={{ mt: 2 }}>
        {insights.map((insight) => (
          <Alert
            key={insight.id}
            severity={severityMap[insight.severity]}
            variant="outlined"
          >
            <Typography variant="subtitle2">{insight.title}</Typography>
            <Typography variant="body2">{insight.description}</Typography>
          </Alert>
        ))}
      </Stack>
    </Paper>
  );
}
