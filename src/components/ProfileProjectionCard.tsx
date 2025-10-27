import { useId, useMemo } from 'react';
import { Alert, Box, Chip, Divider, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

import { useProfileDashboard } from '../api/profileDashboard';

const visuallyHidden = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: 1,
  margin: -1,
  overflow: 'hidden',
  padding: 0,
  position: 'absolute' as const,
  whiteSpace: 'nowrap' as const,
  width: 1
};

function normalizeMonthLabel(value: string): string {
  const date = value.length === 7 ? new Date(`${value}-01T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('fr-CA', {
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD'
  }).format(value);
}

export function ProfileProjectionCard() {
  const theme = useTheme();
  const { data, isLoading, isError } = useProfileDashboard();
  const chartTitleId = useId();
  const chartDescriptionId = useId();
  const projection = data?.projection ?? null;
  const timeline = useMemo(() => projection?.timeline ?? [], [projection]);
  const generatedAt = data?.generatedAt ?? null;

  const chartData = useMemo(
    () =>
      timeline.map((point) => ({
        month: normalizeMonthLabel(point.month),
        netWorth: point.projectedNetWorth,
        change: point.projectedChange
      })),
    [timeline]
  );

  const chartSummary = useMemo(() => {
    if (!timeline.length) {
      return '';
    }
    const firstPoint = timeline[0];
    const lastPoint = timeline[timeline.length - 1];
    const firstLabel = normalizeMonthLabel(firstPoint.month);
    const lastLabel = normalizeMonthLabel(lastPoint.month);
    const delta = lastPoint.projectedNetWorth - firstPoint.projectedNetWorth;
    const direction = delta > 0 ? 'augmentation' : delta < 0 ? 'diminution' : 'stabilité';
    return `Valeur nette projetée de ${formatCurrency(firstPoint.projectedNetWorth)} en ${firstLabel} à ${formatCurrency(lastPoint.projectedNetWorth)} en ${lastLabel}, soit une ${direction} de ${formatCurrency(Math.abs(delta))}.`;
  }, [timeline]);

  if (isLoading) {
    return (
      <Paper sx={{ p: 3, height: '100%' }}>
        <Stack spacing={2}>
          <Skeleton variant="text" width={220} height={32} />
          <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 2 }} />
          <Skeleton variant="text" width="60%" />
        </Stack>
      </Paper>
    );
  }

  if (isError || !projection || !generatedAt) {
    return (
      <Paper sx={{ p: 3, height: '100%' }}>
        <Typography variant="h6" gutterBottom>
          Projection patrimoniale
        </Typography>
        <Alert severity="warning">Impossible de récupérer la projection pour le moment.</Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack spacing={0.5}>
        <Typography variant="h6" id={chartTitleId}>
          Projection patrimoniale (12 mois)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Généré le {new Date(generatedAt).toLocaleDateString('fr-CA')} avec les hypothèses ci-dessous.
        </Typography>
      </Stack>

      {timeline.length === 0 ? (
        <Alert severity="info">Aucune projection n’a encore été calculée.</Alert>
      ) : (
        <Box
          sx={{ height: 280, position: 'relative' }}
          role="img"
          aria-labelledby={chartTitleId}
          aria-describedby={timeline.length ? chartDescriptionId : undefined}
        >
          {timeline.length > 0 && (
            <Box component="span" id={chartDescriptionId} sx={visuallyHidden}>
              {chartSummary}
            </Box>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 16, bottom: 0 }}>
              <defs>
                <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} width={90} />
              <Tooltip
                formatter={(value: unknown, name) => [formatCurrency(value as number), name === 'netWorth' ? 'Valeur nette' : 'Variation mensuelle']}
                labelFormatter={(label) => `Période ${label}`}
              />
              <Area type="monotone" dataKey="netWorth" stroke={theme.palette.primary.main} fill="url(#netWorthGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      )}

      <Divider />

      <Stack spacing={1.5}>
        <Typography variant="subtitle1">Hypothèses clés</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} useFlexGap flexWrap="wrap">
          <Chip label={`Valeur nette actuelle: ${formatCurrency(projection.assumptions.baselineNetWorth)}`} variant="outlined" />
          <Chip label={`Variation mensuelle moyenne: ${formatCurrency(projection.assumptions.averageMonthlyChange)}`} variant="outlined" />
          <Chip
            label={`Croissance mensuelle moyenne: ${(projection.assumptions.averageMonthlyGrowthRate * 100).toFixed(2)} %`}
            variant="outlined"
          />
          <Chip label={`Dépenses mensuelles: ${formatCurrency(projection.assumptions.monthlyExpenses)}`} variant="outlined" />
        </Stack>
      </Stack>

      {projection.notes.length > 0 && (
        <Stack spacing={1.5}>
          <Typography variant="subtitle1">Points à surveiller</Typography>
          <Stack spacing={1}>
            {projection.notes.map((note, index) => (
              <Alert key={`${note}-${index}`} severity="info" icon={false}>
                {note}
              </Alert>
            ))}
          </Stack>
        </Stack>
      )}
    </Paper>
  );
}

export default ProfileProjectionCard;
