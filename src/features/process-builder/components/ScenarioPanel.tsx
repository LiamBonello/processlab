'use client';

import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import type { ScenarioSnapshot } from '../workspace';
import type { SimulationResult } from '@/features/simulation/engine/types';

const currencyFormatter = new Intl.NumberFormat('en', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

function percentDelta(current: number, previous: number) {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function deltaText(current: number, previous: number, lowerIsBetter = true) {
  const delta = percentDelta(current, previous);
  if (delta === null || Math.abs(delta) < 0.05) return 'No material change';
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  return (improved ? 'Improved ' : 'Changed ') + Math.abs(delta).toFixed(1) + '%';
}

export function ScenarioPanel({
  scenarios,
  currentResult,
  onSetBaseline,
  onDelete,
}: {
  scenarios: ScenarioSnapshot[];
  currentResult: SimulationResult;
  onSetBaseline: (scenario: ScenarioSnapshot) => void;
  onDelete: (scenarioId: string) => void;
}) {
  if (scenarios.length === 0) return null;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box>
        <Typography variant="h6">Saved scenarios</Typography>
        <Typography variant="body2" color="text.secondary">
          Persistent snapshots stored inside this project.
        </Typography>
      </Box>

      <Stack spacing={1} sx={{ mt: 2 }}>
        {scenarios.map((scenario) => (
          <Box
            key={scenario.id}
            sx={(theme) => ({
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                lg: 'minmax(180px, 1.5fr) repeat(4, minmax(120px, 1fr)) auto',
              },
              gap: 1.25,
              alignItems: 'center',
              px: 1.5,
              py: 1.25,
              borderRadius: 1.5,
              bgcolor: alpha(theme.palette.common.white, 0.025),
            })}
          >
            <Box>
              <Typography sx={{ fontWeight: 700 }}>{scenario.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {scenario.monthlyVolume.toLocaleString()} / month ·{' '}
                {new Date(scenario.createdAt).toLocaleString()}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Cost
              </Typography>
              <Typography>
                {currencyFormatter.format(scenario.result.totalProcessingCost)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {deltaText(
                  currentResult.totalProcessingCost,
                  scenario.result.totalProcessingCost,
                )}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Cycle
              </Typography>
              <Typography>
                {scenario.result.averageCycleMinutes.toFixed(1)} min
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {deltaText(
                  currentResult.averageCycleMinutes,
                  scenario.result.averageCycleMinutes,
                )}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Queue
              </Typography>
              <Typography>
                {scenario.result.averageQueueMinutes.toFixed(1)} min
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {deltaText(
                  currentResult.averageQueueMinutes,
                  scenario.result.averageQueueMinutes,
                )}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Throughput
              </Typography>
              <Typography>
                {scenario.result.throughputWithinMonth.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {deltaText(
                  currentResult.throughputWithinMonth,
                  scenario.result.throughputWithinMonth,
                  false,
                )}
              </Typography>
            </Box>

            <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
              <Button
                size="small"
                startIcon={<FlagRoundedIcon />}
                onClick={() => onSetBaseline(scenario)}
              >
                Baseline
              </Button>
              <IconButton
                size="small"
                color="error"
                aria-label={'Delete ' + scenario.name}
                onClick={() => onDelete(scenario.id)}
              >
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}
