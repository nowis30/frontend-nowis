import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Snackbar,
  Switch
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from 'recharts';

import { useCompanies } from '../api/companies';
import {
  downloadValuationCsv,
  downloadValuationPdf,
  useCreateValuationSnapshot,
  useDeleteValuationSnapshot,
  useValuationHistory,
  useValuationSnapshots,
  type CreateSnapshotPayload,
  type ShareholderEquityEntry,
  type ValuationSnapshotDto
} from '../api/valuation';
import {
  useFamilyWealthOverview,
  useFamilyWealthHistory,
  useRunFamilyWealthStressTest,
  type StressTestResultDto
} from '../api/wealth';
import { downloadBlob } from '../utils/download';

const currencyFormatter = new Intl.NumberFormat('fr-CA', {
  style: 'currency',
  currency: 'CAD'
});

const percentFormatter = new Intl.NumberFormat('fr-CA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
});

const dateFormatter = new Intl.DateTimeFormat('fr-CA', {
  dateStyle: 'medium'
});

function formatCurrency(value?: number | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }

  return currencyFormatter.format(value);
}

function formatPercent(value?: number | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }

  return `${percentFormatter.format(value)} %`;
}

function formatIsoDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return dateFormatter.format(parsed);
}

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error';
}

interface CreateSnapshotForm {
  companyId: string;
  valuationDate: string;
  notes: string;
}

const INITIAL_SNACKBAR: SnackbarState = {
  open: false,
  message: '',
  severity: 'success'
};

const INITIAL_FORM: CreateSnapshotForm = {
  companyId: '',
  valuationDate: '',
  notes: ''
};

type CompanyFilter = 'all' | number;

const FAMILY_WEALTH_CHART_PREFS_KEY = 'familyWealthChartPrefs';

interface ChartPreferences {
  seriesVisibility: {
    netWorth: boolean;
    assets: boolean;
    liabilities: boolean;
  };
  useLogScale: boolean;
}

interface ValuationStressForm {
  propertyValueShockPercent: number;
  marketShockPercent: number;
  interestRateShockPercent: number;
  debtShockPercent: number;
}

interface ValuationStressSummary {
  baseNetWorth: number;
  apiStressedNetWorth: number;
  adjustedNetWorth: number;
  debtDelta: number;
  deltas: StressTestResultDto['deltas'];
}

interface CompanyStressSummary {
  baseMarketValue: number;
  baseDebt: number;
  baseNetWorth: number;
  propertyDelta: number;
  marketDelta: number;
  interestDelta: number;
  debtDelta: number;
  stressedMarketValue: number;
  stressedDebt: number;
  stressedNetWorth: number;
}

function readStoredPreferences(): ChartPreferences | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(FAMILY_WEALTH_CHART_PREFS_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<ChartPreferences>;
    if (!parsed || typeof parsed !== 'object' || !parsed.seriesVisibility) {
      return null;
    }
    const visibility = parsed.seriesVisibility;
    const normalizedVisibility = {
      netWorth: visibility.netWorth ?? true,
      assets: visibility.assets ?? true,
      liabilities: visibility.liabilities ?? true
    };
    if (!normalizedVisibility.netWorth && !normalizedVisibility.assets && !normalizedVisibility.liabilities) {
      normalizedVisibility.netWorth = true;
    }
    return {
      seriesVisibility: normalizedVisibility,
      useLogScale: Boolean(parsed.useLogScale)
    };
  } catch (error) {
    console.error('Failed to read chart preferences', error);
    return null;
  }
}

function storePreferences(preferences: ChartPreferences) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(FAMILY_WEALTH_CHART_PREFS_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error('Failed to persist chart preferences', error);
  }
}

export default function ValuationScreen() {
  const companiesQuery = useCompanies();
  const [filter, setFilter] = useState<CompanyFilter>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateSnapshotForm>(INITIAL_FORM);
  const [snackbar, setSnackbar] = useState<SnackbarState>(INITIAL_SNACKBAR);

  const resolvedFilter = filter === 'all' ? undefined : filter;

  const snapshotsQuery = useValuationSnapshots(resolvedFilter);
  const historyQuery = useValuationHistory(resolvedFilter);
  const createSnapshot = useCreateValuationSnapshot();
  const deleteSnapshot = useDeleteValuationSnapshot();

  const familyWealthOverviewQuery = useFamilyWealthOverview();
  const familyWealthHistoryQuery = useFamilyWealthHistory();
  const runFamilyStressTest = useRunFamilyWealthStressTest();

  const showFamilyWealthPanel = filter === 'all';
  const storedPreferences = useMemo(() => readStoredPreferences(), []);
  const [seriesVisibility, setSeriesVisibility] = useState(storedPreferences?.seriesVisibility ?? {
    netWorth: true,
    assets: true,
    liabilities: true
  });
  const [useLogScale, setUseLogScale] = useState(storedPreferences?.useLogScale ?? false);
  const [stressForm, setStressForm] = useState<ValuationStressForm>({
    propertyValueShockPercent: -8,
    marketShockPercent: -6,
    interestRateShockPercent: 2,
    debtShockPercent: 5
  });
  const [valuationStressResult, setValuationStressResult] = useState<ValuationStressSummary | null>(null);
  const [companyStressResult, setCompanyStressResult] = useState<CompanyStressSummary | null>(null);

  const latestSnapshot = useMemo<ValuationSnapshotDto | null>(() => {
    return snapshotsQuery.data?.[0] ?? null;
  }, [snapshotsQuery.data]);

  useEffect(() => {
    if (filter !== 'all') {
      return;
    }

    if (companiesQuery.data && companiesQuery.data.length === 1) {
      setFilter(companiesQuery.data[0].id);
    }
  }, [companiesQuery.data, filter]);

  useEffect(() => {
    setCompanyStressResult(null);
  }, [filter, latestSnapshot?.id]);

  const handleFilterChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    if (value === 'all') {
      setFilter('all');
    } else {
      const parsed = Number(value);
      setFilter(Number.isFinite(parsed) ? parsed : 'all');
    }
  };

  const handleOpenCreateDialog = () => {
    setCreateDialogOpen(true);

    setCreateForm((prev) => {
      const defaultCompanyId =
        filter !== 'all'
          ? String(filter)
          : prev.companyId || (companiesQuery.data?.[0] ? String(companiesQuery.data[0].id) : '');
      return {
        companyId: defaultCompanyId,
        valuationDate: prev.valuationDate || new Date().toISOString().slice(0, 10),
        notes: prev.notes
      };
    });
  };

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
  };

  const handleFormChange = (field: keyof CreateSnapshotForm) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setCreateForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleStressFieldChange = (field: keyof ValuationStressForm) => (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const parsedValue = Number(event.target.value);
    setStressForm((prev) => ({
      ...prev,
      [field]: Number.isNaN(parsedValue) ? prev[field] : parsedValue
    }));
  };

  const resetSnackbar = () => setSnackbar(INITIAL_SNACKBAR);

  const handleCreateSnapshot = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!createForm.companyId) {
      setSnackbar({
        open: true,
        severity: 'warning',
        message: 'Choisissez une entreprise à valoriser.'
      });
      return;
    }

    const payload: CreateSnapshotPayload = {
      companyId: Number(createForm.companyId),
      valuationDate: createForm.valuationDate ? new Date(createForm.valuationDate) : undefined,
      notes: createForm.notes.trim() ? createForm.notes.trim() : null
    };

    createSnapshot.mutate(payload, {
      onSuccess: (snapshot) => {
        setSnackbar({
          open: true,
          severity: 'success',
          message: `Valorisation enregistrée pour ${snapshot.companyName ?? 'le portefeuille familial'}.`
        });
        setCreateDialogOpen(false);
        setCreateForm(INITIAL_FORM);
      },
      onError: (error) => {
        setSnackbar({
          open: true,
          severity: 'error',
          message: error instanceof Error ? error.message : 'Impossible de créer la valorisation.'
        });
      }
    });
  };

  const handleDownloadPdf = async (snapshot: ValuationSnapshotDto) => {
    try {
      const blob = await downloadValuationPdf(snapshot.id);
      const filename = `valorisation-${snapshot.companyName?.replace(/\s+/g, '-').toLowerCase() ?? 'familiale'}-${snapshot.id}.pdf`;
      downloadBlob(blob, filename);
      setSnackbar({
        open: true,
        severity: 'info',
        message: 'Rapport PDF prêt à être partagé avec la famille.'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        severity: 'error',
        message: error instanceof Error ? error.message : 'Échec de la génération du PDF.'
      });
    }
  };

  const handleDownloadCsv = async (snapshot: ValuationSnapshotDto) => {
    try {
      const blob = await downloadValuationCsv(snapshot.id);
      const filename = `valorisation-${snapshot.companyName?.replace(/\s+/g, '-').toLowerCase() ?? 'familiale'}-${snapshot.id}.csv`;
      downloadBlob(blob, filename);
      setSnackbar({
        open: true,
        severity: 'info',
        message: 'Extraction CSV générée pour vos analyses.'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        severity: 'error',
        message: error instanceof Error ? error.message : "Impossible de générer l'extraction CSV."
      });
    }
  };

  const handleDeleteSnapshot = (snapshot: ValuationSnapshotDto) => {
    deleteSnapshot.mutate(snapshot.id, {
      onSuccess: () => {
        setSnackbar({
          open: true,
          severity: 'success',
          message: 'Valorisation supprimée de l’historique.'
        });
      },
      onError: (error) => {
        setSnackbar({
          open: true,
          severity: 'error',
          message: error instanceof Error ? error.message : 'Impossible de supprimer la valorisation.'
        });
      }
    });
  };

  const busy = snapshotsQuery.isFetching || createSnapshot.isPending || deleteSnapshot.isPending;

  const familyMomentum = useMemo(() => {
    const timeline = historyQuery.data?.timeline ?? [];
    if (!timeline.length) {
      return null;
    }

    const first = timeline[0];
    const latest = timeline[timeline.length - 1];
    const delta = latest.netAssetValue - first.netAssetValue;

    return {
      delta,
      positive: delta >= 0,
      entries: timeline
    };
  }, [historyQuery.data?.timeline]);

  const shareholderCards = useMemo(() => {
    const snapshot = latestSnapshot;
    if (!snapshot) {
      return [] as ShareholderEquityEntry[];
    }

    return snapshot.shareholders;
  }, [latestSnapshot]);

  const latestFamilyNetWorth = useMemo(() => {
    const timeline = familyWealthHistoryQuery.data ?? [];
    if (!timeline.length) {
      return null;
    }
    return timeline[timeline.length - 1];
  }, [familyWealthHistoryQuery.data]);

  const recentFamilyVariation = useMemo(() => {
    const timeline = familyWealthHistoryQuery.data ?? [];
    if (timeline.length < 2) {
      return null;
    }
    const latest = timeline[timeline.length - 1];
    const previous = timeline[timeline.length - 2];
    const delta = latest.netWorth - previous.netWorth;
    const percent = previous.netWorth !== 0 ? delta / previous.netWorth : null;
    return {
      delta,
      percent
    };
  }, [familyWealthHistoryQuery.data]);

  const familyWealthSeries = useMemo(() => {
    const timeline = familyWealthHistoryQuery.data ?? [];
    return timeline.map((point) => ({
      label: new Date(point.snapshotDate).toLocaleDateString('fr-CA'),
      netWorth: point.netWorth,
      assets: point.assets,
      liabilities: point.liabilities
    }));
  }, [familyWealthHistoryQuery.data]);

  const comparativeEntries = useMemo(() => {
    const timeline = familyWealthHistoryQuery.data ?? [];
    if (!timeline.length) {
      return [] as Array<{
        id: string;
        label: string;
        netWorth: number;
        delta: number | null;
        percent: number | null;
      }>;
    }

    const entries: Array<{
      id: string;
      label: string;
      netWorth: number;
      delta: number | null;
      percent: number | null;
    }> = [];

    for (let index = timeline.length - 1; index >= 0 && entries.length < 6; index -= 1) {
      const current = timeline[index];
      const previous = timeline[index - 1];
      const delta = previous ? current.netWorth - previous.netWorth : null;
      const percent = previous && previous.netWorth !== 0 ? delta! / previous.netWorth : null;
      entries.push({
        id: current.snapshotDate,
        label: new Date(current.snapshotDate).toLocaleDateString('fr-CA'),
        netWorth: current.netWorth,
        delta,
        percent
      });
    }

    return entries;
  }, [familyWealthHistoryQuery.data]);

  const variationAlerts = useMemo(() => {
    const timeline = familyWealthHistoryQuery.data ?? [];
    if (timeline.length < 2) {
      return [] as Array<{
        id: string;
        from: string;
        to: string;
        delta: number;
        percent: number;
        severity: 'success' | 'warning' | 'error';
      }>;
    }

    const recentWindow = timeline.slice(-6);
    const alerts: Array<{
      id: string;
      from: string;
      to: string;
      delta: number;
      percent: number;
      severity: 'success' | 'warning' | 'error';
    }> = [];

    for (let index = 1; index < recentWindow.length; index += 1) {
      const previous = recentWindow[index - 1];
      const current = recentWindow[index];
      if (!previous || previous.netWorth === 0) {
        continue;
      }

      const delta = current.netWorth - previous.netWorth;
      const percent = delta / previous.netWorth;

      let severity: 'success' | 'warning' | 'error' | null = null;
      if (percent <= -0.1) {
        severity = 'error';
      } else if (percent <= -0.05) {
        severity = 'warning';
      } else if (percent >= 0.05) {
        severity = 'success';
      }

      if (!severity) {
        continue;
      }

      alerts.push({
        id: `${previous.snapshotDate}-${current.snapshotDate}`,
        from: previous.snapshotDate,
        to: current.snapshotDate,
        delta,
        percent,
        severity
      });
    }

    return alerts;
  }, [familyWealthHistoryQuery.data]);

  const valuationStressDelta = valuationStressResult
    ? valuationStressResult.adjustedNetWorth - valuationStressResult.baseNetWorth
    : null;

  const valuationStressPercent = valuationStressResult && valuationStressDelta !== null
    ? (valuationStressResult.baseNetWorth !== 0
        ? (valuationStressDelta / valuationStressResult.baseNetWorth) * 100
        : null)
    : null;

  const companyStressDelta = companyStressResult
    ? companyStressResult.stressedNetWorth - companyStressResult.baseNetWorth
    : null;

  const companyStressPercent = companyStressResult && companyStressDelta !== null
    ? (companyStressResult.baseNetWorth !== 0
        ? (companyStressDelta / companyStressResult.baseNetWorth) * 100
        : null)
    : null;

  const activeSeriesKeys = useMemo(
    () =>
      (Object.entries(seriesVisibility) as Array<[keyof typeof seriesVisibility, boolean]>)
        .filter(([, visible]) => visible)
        .map(([key]) => key),
    [seriesVisibility]
  );

  const canUseLogScale = useMemo(() => {
    if (activeSeriesKeys.length === 0 || familyWealthSeries.length === 0) {
      return false;
    }
    return familyWealthSeries.every((point) =>
      activeSeriesKeys.every((key) => (point as Record<string, number>)[key] > 0)
    );
  }, [activeSeriesKeys, familyWealthSeries]);

  useEffect(() => {
    if (!canUseLogScale && useLogScale) {
      setUseLogScale(false);
    }
  }, [canUseLogScale, useLogScale]);

  const handleSeriesToggle = (key: keyof typeof seriesVisibility) => (event: ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    if (!checked && activeSeriesKeys.length <= 1) {
      return;
    }
    setSeriesVisibility((prev) => ({ ...prev, [key]: checked }));
  };

  const handleLogScaleToggle = (event: ChangeEvent<HTMLInputElement>) => {
    setUseLogScale(event.target.checked);
  };

  const handleRunConsolidatedStress = () => {
    if (!showFamilyWealthPanel) {
      return;
    }

    setValuationStressResult(null);
    runFamilyStressTest.mutate(
      {
        propertyValueShockPercent: stressForm.propertyValueShockPercent,
        marketShockPercent: stressForm.marketShockPercent,
        interestRateShockPercent: stressForm.interestRateShockPercent
      },
      {
        onSuccess: (result) => {
          const baseLiabilities = familyWealthOverviewQuery.data?.totals.liabilities ?? 0;
          const debtDelta = baseLiabilities * (stressForm.debtShockPercent / 100);
          const adjustedNetWorth = result.stressedNetWorth - debtDelta;

          setValuationStressResult({
            baseNetWorth: result.baseNetWorth,
            apiStressedNetWorth: result.stressedNetWorth,
            adjustedNetWorth,
            debtDelta,
            deltas: result.deltas
          });

          setSnackbar({
            open: true,
            severity: 'info',
            message: 'Stress test consolidé appliqué aux valorisations.'
          });
        },
        onError: (error) => {
          setSnackbar({
            open: true,
            severity: 'error',
            message: error instanceof Error ? error.message : 'Impossible de simuler ce stress test.'
          });
        }
      }
    );
  };

  const handleResetConsolidatedStress = () => {
    setValuationStressResult(null);
  };

  const handleRunCompanyStress = () => {
    if (filter === 'all') {
      return;
    }

    if (!latestSnapshot) {
      setSnackbar({
        open: true,
        severity: 'warning',
        message: 'Aucun instantané disponible pour simuler ce stress test.'
      });
      return;
    }

    const propertyExposure = latestSnapshot.properties.reduce((total, property) => total + property.marketValue, 0);
    const otherExposure = Math.max(latestSnapshot.totals.totalMarketValue - propertyExposure, 0);
    const propertyDelta = propertyExposure * (stressForm.propertyValueShockPercent / 100);
    const marketDelta = otherExposure * (stressForm.marketShockPercent / 100);
    const interestDelta = latestSnapshot.totals.totalDebt * (stressForm.interestRateShockPercent / 100);
    const debtDelta = latestSnapshot.totals.totalDebt * (stressForm.debtShockPercent / 100);

    const stressedMarketValue = latestSnapshot.totals.totalMarketValue + propertyDelta + marketDelta;
    const stressedDebt = latestSnapshot.totals.totalDebt + interestDelta + debtDelta;
    const stressedNetWorth = stressedMarketValue - stressedDebt;

    setCompanyStressResult({
      baseMarketValue: latestSnapshot.totals.totalMarketValue,
      baseDebt: latestSnapshot.totals.totalDebt,
      baseNetWorth: latestSnapshot.totals.netAssetValue,
      propertyDelta,
      marketDelta,
      interestDelta,
      debtDelta,
      stressedMarketValue,
      stressedDebt,
      stressedNetWorth
    });

    setSnackbar({
      open: true,
      severity: 'info',
      message: 'Stress test appliqué sur la dernière valorisation de la société.'
    });
  };

  const handleResetCompanyStress = () => {
    setCompanyStressResult(null);
  };

  useEffect(() => {
    storePreferences({ seriesVisibility, useLogScale });
  }, [seriesVisibility, useLogScale]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h4">Valeur et rachats d’actions familiales</Typography>
        <Typography variant="body2" color="text.secondary">
          Suivez la valeur nette des sociétés familiales, préparez les rachats d’actions et partagez des rapports clairs avec chaque membre.
        </Typography>
      </Box>

      {showFamilyWealthPanel && (
        <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems={{ lg: 'center' }} justifyContent="space-between">
            <Box>
              <Typography variant="h6">Valeur nette consolidée</Typography>
              <Typography variant="body2" color="text.secondary">
                Dernier calcul au {latestFamilyNetWorth ? formatIsoDate(latestFamilyNetWorth.snapshotDate) : '—'}.
              </Typography>
            </Box>
            {recentFamilyVariation && (
              <Alert severity={recentFamilyVariation.delta >= 0 ? 'success' : 'warning'} sx={{ minWidth: { lg: 320 } }}>
                Variation récente : {formatCurrency(recentFamilyVariation.delta)}
                {typeof recentFamilyVariation.percent === 'number' &&
                  ` (${percentFormatter.format(recentFamilyVariation.percent * 100)} %)`}
              </Alert>
            )}
          </Stack>
          {variationAlerts.length > 0 && (
            <Stack spacing={1}>
              <Typography variant="subtitle2">Alertes de variation</Typography>
              {variationAlerts.map((alert) => (
                <Alert key={alert.id} severity={alert.severity} icon={false}>
                  Variation du {formatIsoDate(alert.from)} au {formatIsoDate(alert.to)} : {formatCurrency(alert.delta)}
                  {` (${percentFormatter.format(alert.percent * 100)} %)`}
                </Alert>
              ))}
            </Stack>
          )}
          {familyWealthOverviewQuery.isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : !familyWealthOverviewQuery.data ? (
            <Alert severity="info">Aucune consolidation disponible. Lance un calcul depuis la section Valeur nette familiale.</Alert>
          ) : (
            <>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Valeur nette
                    </Typography>
                    <Typography variant="h5">{formatCurrency(familyWealthOverviewQuery.data.totals.netWorth)}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Actifs {formatCurrency(familyWealthOverviewQuery.data.totals.assets)} · Dettes {formatCurrency(familyWealthOverviewQuery.data.totals.liabilities)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Actifs liquides
                    </Typography>
                    <Typography variant="h6">{formatCurrency(familyWealthOverviewQuery.data.breakdown.personalAssets.liquid)}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Immeubles personnels : {formatCurrency(familyWealthOverviewQuery.data.breakdown.personalProperty.netValue)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Fiducies & compagnies
                    </Typography>
                    <Typography variant="h6">{formatCurrency(familyWealthOverviewQuery.data.breakdown.trusts.total + familyWealthOverviewQuery.data.breakdown.companies.total)}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Prêts actionnaires : {formatCurrency(familyWealthOverviewQuery.data.breakdown.liabilities.shareholderLoans)}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
              {familyWealthOverviewQuery.data.observations.length > 0 && (
                <Stack spacing={1}>
                  <Typography variant="subtitle2">Observations IA</Typography>
                  {familyWealthOverviewQuery.data.observations.map((observation, index) => (
                    <Alert key={index} severity="warning" icon={false}>
                      {observation}
                    </Alert>
                  ))}
                </Stack>
              )}
              <Grid container spacing={3}>
                <Grid item xs={12} lg={8}>
                  <Paper
                    variant="outlined"
                    sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}
                  >
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={2}
                      justifyContent="space-between"
                      alignItems={{ md: 'center' }}
                    >
                      <Box>
                        <Typography variant="subtitle1">Évolution consolidée</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Net worth, actifs et dettes archivés.
                        </Typography>
                      </Box>
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <FormControlLabel
                            control={
                              <Checkbox
                                size="small"
                                checked={seriesVisibility.netWorth}
                                onChange={handleSeriesToggle('netWorth')}
                              />
                            }
                            label="Valeur nette"
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                size="small"
                                checked={seriesVisibility.assets}
                                onChange={handleSeriesToggle('assets')}
                              />
                            }
                            label="Actifs"
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                size="small"
                                checked={seriesVisibility.liabilities}
                                onChange={handleSeriesToggle('liabilities')}
                              />
                            }
                            label="Dettes"
                          />
                        </Stack>
                        <FormControlLabel
                          control={
                            <Switch
                              size="small"
                              checked={useLogScale}
                              onChange={handleLogScaleToggle}
                              disabled={!canUseLogScale}
                            />
                          }
                          label="Échelle logarithmique"
                        />
                      </Stack>
                    </Stack>
                    {familyWealthHistoryQuery.isLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : familyWealthHistoryQuery.isError ? (
                      <Alert severity="error">Impossible de récupérer l'historique consolidé pour le moment.</Alert>
                    ) : familyWealthSeries.length <= 1 ? (
                      <Alert severity="info">Archivage insuffisant pour tracer la tendance. Active la sauvegarde lors des calculs.</Alert>
                    ) : (
                      <Box sx={{ flexGrow: 1, minHeight: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={familyWealthSeries}>
                            <XAxis dataKey="label" hide={familyWealthSeries.length > 18} />
                            <YAxis
                              tickFormatter={(value: number) => `${(value / 1_000_000).toFixed(1)} M$`}
                              width={80}
                              scale={useLogScale ? 'log' : 'linear'}
                              domain={['auto', 'auto']}
                            />
                            <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="netWorth"
                              stroke="#1e88e5"
                              strokeWidth={2}
                              dot={false}
                              name="Valeur nette"
                              hide={!seriesVisibility.netWorth}
                            />
                            <Line
                              type="monotone"
                              dataKey="assets"
                              stroke="#43a047"
                              strokeWidth={1.5}
                              dot={false}
                              name="Actifs"
                              hide={!seriesVisibility.assets}
                            />
                            <Line
                              type="monotone"
                              dataKey="liabilities"
                              stroke="#fb8c00"
                              strokeWidth={1.5}
                              dot={false}
                              name="Dettes"
                              hide={!seriesVisibility.liabilities}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </Box>
                    )}
                    {!canUseLogScale && activeSeriesKeys.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        L’échelle logarithmique nécessite des valeurs strictement positives pour les séries sélectionnées.
                      </Typography>
                    )}
                  </Paper>
                </Grid>
                <Grid item xs={12} lg={4}>
                  <Paper
                    variant="outlined"
                    sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}
                  >
                    <Typography variant="subtitle1">Comparatif multi périodes</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Six derniers instantanés consolidés.
                    </Typography>
                    {familyWealthHistoryQuery.isLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress size={22} />
                      </Box>
                    ) : familyWealthHistoryQuery.isError ? (
                      <Alert severity="error">Impossible de comparer les périodes sans historique valide.</Alert>
                    ) : comparativeEntries.length === 0 ? (
                      <Alert severity="info">Aucune donnée historisée pour comparer les périodes.</Alert>
                    ) : (
                      <Stack spacing={1.5}>
                        {comparativeEntries.map((entry) => {
                          const deltaLabel =
                            entry.delta === null
                              ? 'Nouvelle base'
                              : `${entry.delta >= 0 ? '+' : ''}${formatCurrency(entry.delta)}${
                                  entry.percent !== null
                                    ? ` (${percentFormatter.format(entry.percent * 100)} %)`
                                    : ''
                                }`;

                          const deltaColor =
                            entry.delta === null
                              ? 'text.secondary'
                              : entry.delta < 0
                                ? 'error.main'
                                : 'success.main';

                          return (
                            <Paper key={entry.id} variant="outlined" sx={{ p: 1.5 }}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Box>
                                  <Typography variant="subtitle2">{entry.label}</Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    Valeur nette : {formatCurrency(entry.netWorth)}
                                  </Typography>
                                </Box>
                                <Typography variant="body2" color={deltaColor} sx={{ whiteSpace: 'nowrap' }}>
                                  {deltaLabel}
                                </Typography>
                              </Stack>
                            </Paper>
                          );
                        })}
                      </Stack>
                    )}
                  </Paper>
                </Grid>
              </Grid>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Paper
                    variant="outlined"
                    sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}
                  >
                    <Stack spacing={0.5}>
                      <Typography variant="subtitle1">Stress test consolidé</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Simule des chocs de valeur, de marché et de dettes sur la dernière consolidation pour anticiper les besoins de liquidité.
                      </Typography>
                    </Stack>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          label="Choc immobilier %"
                          type="number"
                          value={stressForm.propertyValueShockPercent}
                          onChange={handleStressFieldChange('propertyValueShockPercent')}
                          inputProps={{ step: 1, min: -100, max: 100 }}
                          helperText="Variation sur immeubles et fiducies immobilières"
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          label="Choc sociétés %"
                          type="number"
                          value={stressForm.marketShockPercent}
                          onChange={handleStressFieldChange('marketShockPercent')}
                          inputProps={{ step: 1, min: -100, max: 100 }}
                          helperText="Impact sur valorisation des compagnies"
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          label="Hausse taux %"
                          type="number"
                          value={stressForm.interestRateShockPercent}
                          onChange={handleStressFieldChange('interestRateShockPercent')}
                          inputProps={{ step: 0.5, min: -100, max: 100 }}
                          helperText="Variation des taux pour dettes à taux variable"
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          label="Variation dettes %"
                          type="number"
                          value={stressForm.debtShockPercent}
                          onChange={handleStressFieldChange('debtShockPercent')}
                          inputProps={{ step: 1, min: -100, max: 100 }}
                          helperText="Variation appliquée aux dettes consolidées"
                          fullWidth
                        />
                      </Grid>
                    </Grid>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Button
                        variant="contained"
                        onClick={handleRunConsolidatedStress}
                        disabled={runFamilyStressTest.isPending || !familyWealthOverviewQuery.data}
                      >
                        Appliquer le stress test
                      </Button>
                      <Button
                        variant="text"
                        onClick={handleResetConsolidatedStress}
                        disabled={!valuationStressResult}
                      >
                        Réinitialiser
                      </Button>
                      {runFamilyStressTest.isPending && <CircularProgress size={20} />}
                    </Stack>
                    {valuationStressResult && valuationStressDelta !== null && (
                      <Stack spacing={1.5}>
                        <Alert severity={valuationStressDelta >= 0 ? 'success' : 'warning'}>
                          Variation consolidée : {formatCurrency(valuationStressDelta)}
                          {typeof valuationStressPercent === 'number' &&
                            ` (${percentFormatter.format(valuationStressPercent)} %)`}
                        </Alert>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                              <Typography variant="caption" color="text.secondary">
                                Valeur nette de référence
                              </Typography>
                              <Typography variant="h6">{formatCurrency(valuationStressResult.baseNetWorth)}</Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                              <Typography variant="caption" color="text.secondary">
                                Stress API (sans dette)
                              </Typography>
                              <Typography variant="h6">{formatCurrency(valuationStressResult.apiStressedNetWorth)}</Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                              <Typography variant="caption" color="text.secondary">
                                Stress ajusté dettes
                              </Typography>
                              <Typography variant="h6">{formatCurrency(valuationStressResult.adjustedNetWorth)}</Typography>
                            </Paper>
                          </Grid>
                        </Grid>
                        <Stack spacing={0.75}>
                          <Typography variant="subtitle2">Décomposition</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Immobilier : {formatCurrency(valuationStressResult.deltas.property)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Compagnies : {formatCurrency(valuationStressResult.deltas.companies)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Fiducies : {formatCurrency(valuationStressResult.deltas.trusts)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Liquidités & prêts : {formatCurrency(valuationStressResult.deltas.liquidity)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Dettes (ajustement) : {formatCurrency(-valuationStressResult.debtDelta)}
                          </Typography>
                        </Stack>
                      </Stack>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            </>
          )}
        </Paper>
      )}

      <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <FormControl sx={{ minWidth: 220 }} size="small">
            <InputLabel id="valuation-filter-label">Portefeuille</InputLabel>
            <Select
              labelId="valuation-filter-label"
              label="Portefeuille"
              value={filter === 'all' ? 'all' : String(filter)}
              onChange={handleFilterChange}
            >
              <MenuItem value="all">Vue consolidée</MenuItem>
              {companiesQuery.data?.map((company) => (
                <MenuItem key={company.id} value={String(company.id)}>
                  {company.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ flexGrow: 1 }} />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateDialog}
            disabled={companiesQuery.isLoading || companiesQuery.data?.length === 0}
          >
            Nouvelle valorisation
          </Button>
        </Stack>
        {busy && <LinearProgress />}
        {snapshotsQuery.isError && (
          <Alert severity="error">Impossible de récupérer les valorisations. Réessayez plus tard.</Alert>
        )}
        {snapshotsQuery.isLoading && !snapshotsQuery.data && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}
        {!snapshotsQuery.isLoading && snapshotsQuery.data && !snapshotsQuery.data.length && (
          <Alert severity="info">Aucune valorisation enregistrée pour le moment.</Alert>
        )}
        {snapshotsQuery.data && snapshotsQuery.data.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Entreprise</TableCell>
                <TableCell align="right">Valeur nette</TableCell>
                <TableCell align="right">Valeur marchande</TableCell>
                <TableCell align="right">Dettes</TableCell>
                <TableCell align="center">Instantané</TableCell>
                <TableCell align="right">Actions</TableCell>
                <TableCell align="right">Actionnaires</TableCell>
                <TableCell align="center">Actions rapides</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {snapshotsQuery.data.map((snapshot) => (
                <TableRow key={snapshot.id} hover>
                  <TableCell>{formatIsoDate(snapshot.valuationDate)}</TableCell>
                  <TableCell>{snapshot.companyName ?? 'Consolidé'}</TableCell>
                  <TableCell align="right">{formatCurrency(snapshot.totals.netAssetValue)}</TableCell>
                  <TableCell align="right">{formatCurrency(snapshot.totals.totalMarketValue)}</TableCell>
                  <TableCell align="right">{formatCurrency(snapshot.totals.totalDebt)}</TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={`${snapshot.properties.length} immeuble${snapshot.properties.length > 1 ? 's' : ''}`}
                      color="primary"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">{snapshot.shareClasses.length}</TableCell>
                  <TableCell align="right">{snapshot.shareholders.length}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="Rapport PDF">
                      <IconButton onClick={() => handleDownloadPdf(snapshot)} size="small">
                        <PictureAsPdfIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Extraction CSV">
                      <IconButton onClick={() => handleDownloadCsv(snapshot)} size="small">
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Supprimer">
                      <IconButton
                        color="error"
                        onClick={() => handleDeleteSnapshot(snapshot)}
                        size="small"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {latestSnapshot && (
        <Grid container spacing={3}>
          {filter !== 'all' && (
            <Grid item xs={12}>
              <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Stack spacing={0.5}>
                  <Typography variant="h6">Stress test société</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Simulation sur l’instantané du {formatIsoDate(latestSnapshot.valuationDate)} pour {latestSnapshot.companyName ?? 'le portefeuille familial'}.
                  </Typography>
                </Stack>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      label="Choc immobilier %"
                      type="number"
                      value={stressForm.propertyValueShockPercent}
                      onChange={handleStressFieldChange('propertyValueShockPercent')}
                      inputProps={{ step: 1, min: -100, max: 100 }}
                      helperText="Appliqué aux immeubles de la société"
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      label="Choc activités %"
                      type="number"
                      value={stressForm.marketShockPercent}
                      onChange={handleStressFieldChange('marketShockPercent')}
                      inputProps={{ step: 1, min: -100, max: 100 }}
                      helperText="Appliqué aux autres actifs"
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      label="Hausse taux %"
                      type="number"
                      value={stressForm.interestRateShockPercent}
                      onChange={handleStressFieldChange('interestRateShockPercent')}
                      inputProps={{ step: 0.5, min: -100, max: 100 }}
                      helperText="Impact sur le service de la dette"
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      label="Variation dettes %"
                      type="number"
                      value={stressForm.debtShockPercent}
                      onChange={handleStressFieldChange('debtShockPercent')}
                      inputProps={{ step: 1, min: -100, max: 100 }}
                      helperText="Ajustement sur l’endettement"
                      fullWidth
                    />
                  </Grid>
                </Grid>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Button
                    variant="contained"
                    onClick={handleRunCompanyStress}
                    disabled={runFamilyStressTest.isPending || !latestSnapshot}
                  >
                    Appliquer le stress test
                  </Button>
                  <Button variant="text" onClick={handleResetCompanyStress} disabled={!companyStressResult}>
                    Réinitialiser
                  </Button>
                </Stack>
                {companyStressResult && companyStressDelta !== null && (
                  <Stack spacing={1.5}>
                    <Alert severity={companyStressDelta >= 0 ? 'success' : 'warning'}>
                      Variation nette : {formatCurrency(companyStressDelta)}
                      {typeof companyStressPercent === 'number' &&
                        ` (${percentFormatter.format(companyStressPercent)} %)`}
                    </Alert>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            Valeur marchande de base
                          </Typography>
                          <Typography variant="h6">{formatCurrency(companyStressResult.baseMarketValue)}</Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            Dette actuelle
                          </Typography>
                          <Typography variant="h6">{formatCurrency(companyStressResult.baseDebt)}</Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            Valeur nette stressée
                          </Typography>
                          <Typography variant="h6">{formatCurrency(companyStressResult.stressedNetWorth)}</Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                    <Stack spacing={0.75}>
                      <Typography variant="subtitle2">Décomposition</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Immobilier : {formatCurrency(companyStressResult.propertyDelta)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Autres actifs : {formatCurrency(companyStressResult.marketDelta)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Hausse de taux : {formatCurrency(-companyStressResult.interestDelta)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Ajustement dettes : {formatCurrency(-companyStressResult.debtDelta)}
                      </Typography>
                    </Stack>
                  </Stack>
                )}
              </Paper>
            </Grid>
          )}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h6">Répartition des actionnaires</Typography>
              <Typography variant="body2" color="text.secondary">
                Photographie au {formatIsoDate(latestSnapshot.valuationDate)}.
              </Typography>
              <Divider />
              <Stack spacing={2}>
                {shareholderCards.map((shareholder) => (
                  <Paper key={shareholder.shareholderId} variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="subtitle1">{shareholder.displayName}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatPercent(shareholder.ownershipPercent)} du capital participatif
                        </Typography>
                      </Box>
                      <Chip label={formatCurrency(shareholder.equityValue)} color="success" />
                    </Stack>
                    {shareholder.breakdown.length > 0 && (
                      <Stack direction="row" flexWrap="wrap" gap={1} mt={2}>
                        {shareholder.breakdown.map((detail) => (
                          <Chip
                            key={`${shareholder.shareholderId}-${detail.shareClassId}`}
                            label={`${detail.shareClassCode} · ${detail.participatesInGrowth ? 'participatif' : 'fixe'} · ${formatCurrency(detail.equityValue)}`}
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    )}
                  </Paper>
                ))}
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h6">Chronologie des valorisations</Typography>
              <Typography variant="body2" color="text.secondary">
                Historique des valorisations et variation nette du portefeuille.
              </Typography>
              <Divider />
              {historyQuery.isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              )}
              {!historyQuery.isLoading && (!historyQuery.data || !historyQuery.data.timeline.length) && (
                <Alert severity="info">Aucun historique disponible pour ce filtre.</Alert>
              )}
              {historyQuery.data && historyQuery.data.timeline.length > 0 && (
                <Stack spacing={1}>
                  {familyMomentum && (
                    <Alert severity={familyMomentum.positive ? 'success' : 'warning'}>
                      Variation cumulée : {formatCurrency(familyMomentum.delta)} depuis la première mesure.
                    </Alert>
                  )}
                  {historyQuery.data.timeline.map((entry) => (
                    <Paper key={entry.id} variant="outlined" sx={{ p: 2 }}>
                      <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="subtitle2">
                            {entry.companyName ?? 'Consolidé'} – {formatIsoDate(entry.valuationDate)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Valeur nette : {formatCurrency(entry.netAssetValue)}
                          </Typography>
                        </Box>
                        <Chip label={`Instantané #${entry.id}`} variant="outlined" />
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      <Dialog open={createDialogOpen} onClose={handleCloseCreateDialog} fullWidth maxWidth="sm">
        <DialogTitle>Nouvelle valorisation</DialogTitle>
        <Box component="form" onSubmit={handleCreateSnapshot}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="create-valuation-company-label">Entreprise</InputLabel>
              <Select
                labelId="create-valuation-company-label"
                label="Entreprise"
                value={createForm.companyId}
                onChange={(event: SelectChangeEvent<string>) =>
                  setCreateForm((prev) => ({ ...prev, companyId: event.target.value }))
                }
                disabled={companiesQuery.isLoading || companiesQuery.data?.length === 0}
                required
              >
                {companiesQuery.data?.map((company) => (
                  <MenuItem key={company.id} value={String(company.id)}>
                    {company.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Date d’évaluation"
              type="date"
              value={createForm.valuationDate}
              onChange={handleFormChange('valuationDate')}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Notes internes (facultatif)"
              multiline
              minRows={3}
              value={createForm.notes}
              onChange={handleFormChange('notes')}
              placeholder="Justifiez la méthode ou consignez les hypothèses utilisées."
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCreateDialog}>Annuler</Button>
            <Button type="submit" variant="contained" disabled={createSnapshot.isPending}>
              {createSnapshot.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={resetSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={resetSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
