import { ChangeEvent, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

import {
  useFamilyWealthOverview,
  useFamilyWealthHistory,
  useFamilyWealthScenarios,
  useCreateFamilyWealthScenario,
  useDeleteFamilyWealthScenario,
  useRunFamilyWealthStressTest,
  type CreateFamilyWealthScenarioPayload,
  type FamilyWealthScenarioDto,
  type StressTestPayload,
  type StressTestResultDto
} from '../api/wealth';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD'
  }).format(Number.isFinite(value) ? value : 0);
}

const YEAR_RANGE = Array.from({ length: 6 }).map((_, index) => new Date().getFullYear() - index);

type ScenarioFormState = Required<
  Pick<
    CreateFamilyWealthScenarioPayload,
    | 'label'
    | 'scenarioType'
    | 'horizonYears'
    | 'growthRatePercent'
    | 'drawdownPercent'
    | 'annualContribution'
    | 'annualWithdrawal'
    | 'persist'
  >
>;

type StressFormState = Required<
  Pick<StressTestPayload, 'propertyValueShockPercent' | 'marketShockPercent' | 'interestRateShockPercent'>
>;

function FamilyWealthScreen() {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [persistSnapshot, setPersistSnapshot] = useState<boolean>(false);

  const { data: overview, isLoading: isLoadingOverview } = useFamilyWealthOverview({
    year: selectedYear,
    persist: persistSnapshot
  });
  const { data: history, isLoading: isLoadingHistory } = useFamilyWealthHistory();
  const { data: scenarios, isLoading: isLoadingScenarios } = useFamilyWealthScenarios();

  const createScenario = useCreateFamilyWealthScenario();
  const deleteScenario = useDeleteFamilyWealthScenario();
  const runStressTest = useRunFamilyWealthStressTest();

  const [scenarioForm, setScenarioForm] = useState<ScenarioFormState>({
    label: 'Croissance 6 %',
    scenarioType: 'GROWTH',
    horizonYears: 10,
    growthRatePercent: 6,
    drawdownPercent: 0,
    annualContribution: 0,
    annualWithdrawal: 0,
    persist: true
  });

  const [stressForm, setStressForm] = useState<StressFormState>({
    propertyValueShockPercent: -10,
    marketShockPercent: -8,
    interestRateShockPercent: 2
  });

  const [stressResult, setStressResult] = useState<StressTestResultDto | null>(null);

  const structureTotal = useMemo(() => {
    if (!overview) {
      return 0;
    }
    return overview.comparisons.structure.reduce((total, entry) => total + Math.max(entry.value, 0), 0);
  }, [overview]);

  const incomeTotal = useMemo(() => {
    if (!overview) {
      return 0;
    }
    return overview.comparisons.incomeMix.reduce((total, entry) => total + Math.max(entry.value, 0), 0);
  }, [overview]);

  const handleScenarioInputChange = <Field extends keyof ScenarioFormState>(field: Field) => (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const { type, value } = event.target;
    const nextValue = type === 'number' ? Number(value) : value;
    setScenarioForm((prev) => ({
      ...prev,
      [field]: (Number.isNaN(nextValue) ? prev[field] : nextValue) as ScenarioFormState[Field]
    }));
  };

  const handleScenarioTypeChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value as ScenarioFormState['scenarioType'];
    setScenarioForm((prev) => ({ ...prev, scenarioType: value }));
  };

  const handleScenarioPersistChange = (event: ChangeEvent<HTMLInputElement>) => {
    setScenarioForm((prev) => ({ ...prev, persist: event.target.checked }));
  };

  const handleStressInputChange = <Field extends keyof StressFormState>(field: Field) => (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const numericValue = Number(event.target.value);
    setStressForm((prev) => ({ ...prev, [field]: Number.isNaN(numericValue) ? prev[field] : numericValue }));
  };

  const handleCreateScenario = () => {
    createScenario.mutate(scenarioForm);
  };

  const handleDeleteScenario = (scenarioId?: number) => {
    if (!scenarioId) {
      return;
    }
    deleteScenario.mutate(scenarioId);
  };

  const handleRunStressTest = () => {
    setStressResult(null);
    runStressTest.mutate(stressForm, {
      onSuccess: (result) => {
        setStressResult(result);
      }
    });
  };

  if (isLoadingOverview) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!overview) {
    return (
      <Stack spacing={3}>
        <Typography variant="h5">Valeur nette familiale</Typography>
        <Alert severity="info">Aucune donnée disponible pour le moment. Ajoute tes actifs et relance un calcul.</Alert>
      </Stack>
    );
  }

  const wealthHistoryData = (history ?? []).map((point) => ({
    date: new Date(point.snapshotDate).toLocaleDateString('fr-CA'),
    netWorth: point.netWorth,
    assets: point.assets,
    liabilities: point.liabilities
  }));

  const structureEntries = overview.comparisons.structure.map((entry) => ({
    label: entry.label,
    value: entry.value,
    ratio: structureTotal > 0 ? Math.min(Math.max((entry.value / structureTotal) * 100, 0), 100) : 0
  }));

  const incomeEntries = overview.comparisons.incomeMix.map((entry) => ({
    label: entry.label,
    value: entry.value,
    ratio: incomeTotal > 0 ? Math.min(Math.max((entry.value / incomeTotal) * 100, 0), 100) : 0
  }));

  const riskCards = [
    {
      label: 'Ratio dettes / actifs',
      value: `${(overview.riskIndicators.debtToAsset * 100).toFixed(1)} %`
    },
    {
      label: 'Couverture de liquidités',
      value: `${(overview.riskIndicators.liquidityCoverage * 100).toFixed(1)} %`
    },
    {
      label: 'Indice de diversification',
      value: `${(overview.riskIndicators.diversificationScore * 100).toFixed(1)} %`
    }
  ];

  return (
    <Stack spacing={4}>
      <Stack spacing={1} direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }}>
        <Stack spacing={0.5}>
          <Typography variant="h4">Valeur nette familiale</Typography>
          <Typography variant="body2" color="text.secondary">
            Synthèse consolidée des immeubles, compagnies, liquidités et fiducies avec suivi historique.
          </Typography>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <TextField
            select
            size="small"
            label="Année fiscale"
            value={selectedYear}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSelectedYear(Number(event.target.value))}
            sx={{ minWidth: 160 }}
          >
            {YEAR_RANGE.map((year) => (
              <MenuItem key={year} value={year}>
                {year}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={
              <Checkbox
                checked={persistSnapshot}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setPersistSnapshot(event.target.checked)}
              />
            }
            label="Archiver ce calcul"
          />
        </Stack>
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Valeur nette
            </Typography>
            <Typography variant="h4">{formatCurrency(overview.totals.netWorth)}</Typography>
            <Typography variant="body2" color="text.secondary">
              Mise à jour le {new Date(overview.asOf).toLocaleString('fr-CA')}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Actifs consolidés
            </Typography>
            <Typography variant="h5">{formatCurrency(overview.totals.assets)}</Typography>
            <Typography variant="body2" color="text.secondary">
              Immeubles, compagnies, liquidités, fiducies
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Dettes & prêts
            </Typography>
            <Typography variant="h5">{formatCurrency(overview.totals.liabilities)}</Typography>
            <Typography variant="body2" color="text.secondary">
              Hypothèques personnelles, dettes, prêts actionnaires
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Stack>
              <Typography variant="h6">Évolution de la valeur nette</Typography>
              <Typography variant="body2" color="text.secondary">
                Historique des actifs, dettes et valeur nette consolidée.
              </Typography>
            </Stack>
            <Box sx={{ flexGrow: 1, minHeight: 260 }}>
              {isLoadingHistory ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <CircularProgress size={24} />
                </Box>
              ) : wealthHistoryData.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Aucun historique enregistré. Active l'archivage pour conserver chaque calcul.
                </Typography>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={wealthHistoryData}>
                    <XAxis dataKey="date" hide={wealthHistoryData.length > 12} />
                    <YAxis tickFormatter={(value) => `${(value / 1_000_000).toFixed(1)} M$`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Line type="monotone" dataKey="netWorth" stroke="#1e88e5" strokeWidth={2} dot={false} name="Valeur nette" />
                    <Line type="monotone" dataKey="assets" stroke="#43a047" strokeWidth={1} dot={false} name="Actifs" />
                    <Line type="monotone" dataKey="liabilities" stroke="#fb8c00" strokeWidth={1} dot={false} name="Dettes" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">Indicateurs de risque</Typography>
            <Divider />
            <Stack spacing={1.5}>
              {riskCards.map((card) => (
                <Box key={card.label}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {card.label}
                  </Typography>
                  <Typography variant="h6">{card.value}</Typography>
                </Box>
              ))}
            </Stack>
            {overview.observations.length > 0 && (
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">Observations IA</Typography>
                {overview.observations.map((note, index) => (
                  <Alert key={index} severity="warning" icon={false}>
                    {note}
                  </Alert>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">Répartition du patrimoine</Typography>
            <Stack spacing={2}>
              {structureEntries.map((entry) => (
                <Box key={entry.label}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2">{entry.label}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatCurrency(entry.value)} · {entry.ratio.toFixed(1)} %
                    </Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={entry.ratio} sx={{ height: 8, borderRadius: 4 }} />
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">Mix de revenus</Typography>
            <Stack spacing={2}>
              {incomeEntries.map((entry) => (
                <Box key={entry.label}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2">{entry.label}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatCurrency(entry.value)} · {entry.ratio.toFixed(1)} %
                    </Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={entry.ratio} sx={{ height: 8, borderRadius: 4 }} />
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">Scénarios de croissance / crise</Typography>
            <Typography variant="body2" color="text.secondary">
              Modélise la trajectoire de la valeur nette selon des hypothèses de rendement, contributions et retraits.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Nom du scénario"
                  value={scenarioForm.label}
                  onChange={handleScenarioInputChange('label')}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField
                  select
                  label="Type"
                  value={scenarioForm.scenarioType}
                  onChange={handleScenarioTypeChange}
                  fullWidth
                >
                  <MenuItem value="GROWTH">Croissance</MenuItem>
                  <MenuItem value="CONSERVATIVE">Conservateur</MenuItem>
                  <MenuItem value="STRESS">Stress</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField
                  label="Horizon (années)"
                  type="number"
                  value={scenarioForm.horizonYears}
                  onChange={handleScenarioInputChange('horizonYears')}
                  inputProps={{ min: 1, max: 50 }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField
                  label="Rendement %"
                  type="number"
                  value={scenarioForm.growthRatePercent}
                  onChange={handleScenarioInputChange('growthRatePercent')}
                  inputProps={{ step: 0.5, min: -100, max: 100 }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField
                  label="Choc initial %"
                  type="number"
                  value={scenarioForm.drawdownPercent}
                  onChange={handleScenarioInputChange('drawdownPercent')}
                  inputProps={{ step: 1, min: 0, max: 100 }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField
                  label="Contrib. annuelle"
                  type="number"
                  value={scenarioForm.annualContribution}
                  onChange={handleScenarioInputChange('annualContribution')}
                  inputProps={{ step: 1000 }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField
                  label="Retrait annuel"
                  type="number"
                  value={scenarioForm.annualWithdrawal}
                  onChange={handleScenarioInputChange('annualWithdrawal')}
                  inputProps={{ step: 1000 }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControlLabel
                  control={<Checkbox checked={scenarioForm.persist} onChange={handleScenarioPersistChange} />}
                  label="Sauvegarder"
                />
              </Grid>
            </Grid>
            <Stack direction="row" spacing={2} alignItems="center">
              <Button
                variant="contained"
                onClick={handleCreateScenario}
                disabled={createScenario.isPending}
              >
                Lancer le scénario
              </Button>
              {createScenario.isPending && <CircularProgress size={20} />}
            </Stack>
            <Divider sx={{ my: 2 }} />
            {isLoadingScenarios ? (
              <CircularProgress size={24} />
            ) : !scenarios || scenarios.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Aucun scénario enregistré pour le moment.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {scenarios.map((scenario: FamilyWealthScenarioDto) => {
                  const timeline = scenario.timeline ?? [];
                  return (
                    <Paper key={scenario.id ?? scenario.label} variant="outlined" sx={{ p: 2 }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5}>
                        <Stack>
                          <Typography variant="subtitle1">{scenario.label}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {scenario.scenarioType} · Rendement {scenario.assumptions.growthRatePercent}% · Choc {scenario.assumptions.drawdownPercent}%
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {scenario.id && (
                            <Button size="small" color="error" onClick={() => handleDeleteScenario(scenario.id)}>
                              Supprimer
                            </Button>
                          )}
                        </Stack>
                      </Stack>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={timeline.map((point) => ({ ...point, label: `Année ${point.year}` }))}>
                          <XAxis dataKey="label" hide={timeline.length > 8} />
                          <YAxis hide tickFormatter={(value) => `${(value / 1_000_000).toFixed(1)} M$`} />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Line type="monotone" dataKey="projectedNetWorth" stroke="#3949ab" strokeWidth={2} dot={false} name="Projection" />
                        </LineChart>
                      </ResponsiveContainer>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">Stress test instantané</Typography>
            <Typography variant="body2" color="text.secondary">
              Évalue l’impact d’une baisse de loyers ou d’une hausse de taux sur ta valeur nette.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Choc valeur propriétés %"
                  type="number"
                  value={stressForm.propertyValueShockPercent}
                  onChange={handleStressInputChange('propertyValueShockPercent')}
                  inputProps={{ step: 1, min: -100, max: 100 }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Choc marché corporatif %"
                  type="number"
                  value={stressForm.marketShockPercent}
                  onChange={handleStressInputChange('marketShockPercent')}
                  inputProps={{ step: 1, min: -100, max: 100 }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Hausse taux dettes %"
                  type="number"
                  value={stressForm.interestRateShockPercent}
                  onChange={handleStressInputChange('interestRateShockPercent')}
                  inputProps={{ step: 0.5, min: -100, max: 100 }}
                  fullWidth
                />
              </Grid>
            </Grid>
            <Stack direction="row" spacing={2} alignItems="center">
              <Button variant="contained" onClick={handleRunStressTest} disabled={runStressTest.isPending}>
                Appliquer le stress test
              </Button>
              {runStressTest.isPending && <CircularProgress size={20} />}
            </Stack>
            {stressResult && (
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">Impact simulé</Typography>
                <Typography variant="h6">Nouvelle valeur nette : {formatCurrency(stressResult.stressedNetWorth)}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Variation totale : {formatCurrency(stressResult.deltas.netWorth)}
                </Typography>
                <Divider />
                <Stack spacing={0.5}>
                  <Typography variant="body2">Propriétés : {formatCurrency(stressResult.deltas.property)}</Typography>
                  <Typography variant="body2">Compagnies : {formatCurrency(stressResult.deltas.companies)}</Typography>
                  <Typography variant="body2">Fiducies : {formatCurrency(stressResult.deltas.trusts)}</Typography>
                  <Typography variant="body2">Liquidités & dettes : {formatCurrency(stressResult.deltas.liquidity)}</Typography>
                </Stack>
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
}

export default FamilyWealthScreen;
