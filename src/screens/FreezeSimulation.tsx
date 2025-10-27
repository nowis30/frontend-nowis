import { ChangeEvent, useMemo, useState } from 'react';
import type { ChipProps } from '@mui/material';
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
  FormControlLabel,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

import {
  useFreezeAssets,
  useFreezeScenarios,
  useCreateFreezeScenario,
  useDeleteFreezeScenario,
  useRunFreezeSimulation,
  useSuccessionProgress,
  type FreezeScenarioPayload,
  type FreezeSimulationInputs,
  type FreezeSimulationResult,
  type SuccessionStepStatus
} from '../api/freeze';

type ScenarioFormState = FreezeScenarioPayload;

interface SimulationFormState {
  scenarioId: number | null;
  assetIds: number[];
  targetFreezeYear: number;
  generations: number;
  reinvestmentRatePercent: number;
  marginalTaxRatePercent: number;
  dividendRetentionPercent: number;
}

const CURRENT_YEAR = new Date().getFullYear();

function createInitialScenarioForm(): ScenarioFormState {
  return {
    label: '',
    baseYear: CURRENT_YEAR,
    freezeRatePercent: 2,
    preferredDividendRatePercent: 4,
    redemptionYears: 20,
    notes: null
  } as const;
}

function createInitialSimulationForm(): SimulationFormState {
  return {
    scenarioId: null,
    assetIds: [],
    targetFreezeYear: CURRENT_YEAR,
    generations: 2,
    reinvestmentRatePercent: 3,
    marginalTaxRatePercent: 47,
    dividendRetentionPercent: 50
  };
}

const moneyFormatter = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' });

function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

function humanizeMetricKey(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatMetricValue(value: unknown): string {
  if (typeof value === 'number') {
    return formatMoney(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (value === null || value === undefined) {
    return 'N/A';
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function FreezeSimulationScreen() {
  const assetsQuery = useFreezeAssets();
  const scenariosQuery = useFreezeScenarios();
  const progressQuery = useSuccessionProgress();

  const createScenario = useCreateFreezeScenario();
  const deleteScenario = useDeleteFreezeScenario();
  const runSimulation = useRunFreezeSimulation();

  const [scenarioDialogOpen, setScenarioDialogOpen] = useState(false);
  const [scenarioForm, setScenarioForm] = useState<ScenarioFormState>(createInitialScenarioForm());
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  const [simulationForm, setSimulationForm] = useState<SimulationFormState>(createInitialSimulationForm());
  const [simulationResult, setSimulationResult] = useState<FreezeSimulationResult | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  const statusConfig = useMemo<Record<SuccessionStepStatus, { label: string; color: ChipProps['color'] }>>(
    () => ({
      todo: { label: 'À faire', color: 'default' },
      in_progress: { label: 'En cours', color: 'warning' },
      done: { label: 'Terminé', color: 'success' }
    }),
    []
  );

  const progressData = progressQuery.data;

  const handleOpenScenarioDialog = () => {
    setScenarioForm(createInitialScenarioForm());
    setScenarioError(null);
    setScenarioDialogOpen(true);
  };

  const handleCloseScenarioDialog = () => {
    setScenarioDialogOpen(false);
  };

  const handleScenarioFieldChange = (field: keyof ScenarioFormState) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = event.target.value;
    setScenarioForm((prev) => ({
      ...prev,
      [field]: event.target.type === 'number' ? Number(value) : value
    }));
  };

  const handleScenarioSubmit = () => {
    if (!scenarioForm.label.trim()) {
      setScenarioError('Ajoute un libellé à ton scénario.');
      return;
    }

    const payload: FreezeScenarioPayload = {
      ...scenarioForm,
      label: scenarioForm.label.trim(),
      notes: scenarioForm.notes?.trim() ? scenarioForm.notes.trim() : null
    };

    createScenario.mutate(payload, {
      onSuccess: () => {
        setScenarioDialogOpen(false);
        setScenarioForm(createInitialScenarioForm());
        setScenarioError(null);
        scenariosQuery.refetch();
      },
      onError: () => {
        setScenarioError("Impossible d'enregistrer le scénario pour le moment.");
      }
    });
  };

  const handleDeleteScenario = (scenarioId: number) => {
    deleteScenario.mutate(scenarioId, {
      onSuccess: () => {
        scenariosQuery.refetch();
        if (simulationForm.scenarioId === scenarioId) {
          setSimulationForm((prev) => ({ ...prev, scenarioId: null }));
        }
      }
    });
  };

  const handleSimulationFieldChange = (field: keyof SimulationFormState) => (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.type === 'number' ? Number(event.target.value) : event.target.value;
    setSimulationForm((prev) => ({
      ...prev,
      [field]: typeof value === 'number' && Number.isNaN(value) ? prev[field] : value
    }));
  };

  const handleToggleAsset = (assetId: number) => {
    setSimulationForm((prev) => {
      const exists = prev.assetIds.includes(assetId);
      return {
        ...prev,
        assetIds: exists ? prev.assetIds.filter((id) => id !== assetId) : [...prev.assetIds, assetId]
      };
    });
  };

  const handleRunSimulation = () => {
    setSimulationError(null);
    setSimulationResult(null);

    if (!simulationForm.scenarioId) {
  setSimulationError('Choisis un scénario de gel avant de lancer la simulation.');
      return;
    }

    if (simulationForm.assetIds.length === 0) {
  setSimulationError('Sélectionne au moins un actif à geler.');
      return;
    }

    const payload: FreezeSimulationInputs = {
      scenarioId: simulationForm.scenarioId,
      assetIds: simulationForm.assetIds,
      targetFreezeYear: simulationForm.targetFreezeYear,
      generations: simulationForm.generations,
      reinvestmentRatePercent: simulationForm.reinvestmentRatePercent,
      marginalTaxRatePercent: simulationForm.marginalTaxRatePercent,
      dividendRetentionPercent: simulationForm.dividendRetentionPercent
    };

    runSimulation.mutate(payload, {
      onSuccess: (result) => {
        setSimulationResult(result);
      },
      onError: () => {
  setSimulationError('La simulation ne peut pas être calculée pour le moment.');
      }
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ md: 'center' }}>
          <Stack spacing={0.5}>
            <Typography variant="h5">Parcours succession</Typography>
            <Typography variant="body2" color="text.secondary">
              Suis l’avancement des données, scénarios et simulations pour livrer un plan professionnel.
            </Typography>
          </Stack>
          {progressData && (
            <Chip
              label={`${Math.round(progressData.completionRatio * 100)} % complété`}
              color={progressData.completionRatio >= 1 ? 'success' : 'primary'}
            />
          )}
        </Stack>

        {progressQuery.isLoading ? (
          <Skeleton variant="rectangular" height={12} sx={{ borderRadius: 999 }} />
        ) : progressData ? (
          <LinearProgress
            variant="determinate"
            value={Math.min(progressData.completionRatio * 100, 100)}
            sx={{ height: 10, borderRadius: 999 }}
          />
        ) : (
          <Alert severity="warning">Impossible de récupérer le suivi pour le moment.</Alert>
        )}

        {progressData && (
          <Stack spacing={2}>
            <Alert severity={progressData.completionRatio >= 1 ? 'success' : 'info'}>
              <strong>{progressData.nextAction.label}</strong>
              <br />
              {progressData.nextAction.suggestion}
            </Alert>

            <Grid container spacing={2}>
              {progressData.steps.map((step) => {
                const config = statusConfig[step.status];
                return (
                  <Grid item xs={12} md={6} key={step.id}>
                    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                      <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                          <Typography variant="subtitle1">{step.label}</Typography>
                          <Chip label={config.label} color={config.color} size="small" />
                        </Stack>
                        {step.summary && (
                          <Typography variant="body2" color="text.secondary">
                            {step.summary}
                          </Typography>
                        )}
                        {step.blockers && step.blockers.length > 0 && (
                          <Alert severity="warning" variant="outlined">
                            <Typography variant="subtitle2" gutterBottom>
                              Bloqueurs à lever
                            </Typography>
                            <List dense disablePadding>
                              {step.blockers.map((blocker, index) => (
                                <ListItem key={`${step.id}-blocker-${index}`} disableGutters sx={{ py: 0 }}>
                                  <ListItemText primary={blocker} primaryTypographyProps={{ variant: 'body2' }} />
                                </ListItem>
                              ))}
                            </List>
                          </Alert>
                        )}
                      </Stack>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>

            {progressData.latestSimulation && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle1">Dernière simulation</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Générée le {new Date(progressData.latestSimulation.generatedAt).toLocaleDateString('fr-CA')} - Horizon {progressData.latestSimulation.inputs.targetFreezeYear}
                  </Typography>
                  {progressData.latestSimulation.metrics ? (
                    <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                      {Object.entries(progressData.latestSimulation.metrics).map(([key, value]) => (
                        <Chip key={key} label={`${humanizeMetricKey(key)}: ${formatMetricValue(value)}`} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Les métriques détaillées seront disponibles après la prochaine simulation.
                    </Typography>
                  )}
                </Stack>
              </Paper>
            )}
          </Stack>
        )}
      </Paper>

      <Stack spacing={0.5}>
        <Typography variant="h4">Simulateur de gel successoral</Typography>
        <Typography variant="body2" color="text.secondary">
          Évalue la valeur des actions privilégiées, l’impôt déclenché et les flux de dividendes pour ton gel.
        </Typography>
      </Stack>

      <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
          <Typography variant="h6">Scénarios enregistrés</Typography>
          <Button variant="contained" onClick={handleOpenScenarioDialog} disabled={createScenario.isPending}>
            Nouveau scénario
          </Button>
        </Stack>

        {scenariosQuery.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : !scenariosQuery.data || scenariosQuery.data.length === 0 ? (
          <Alert severity="info">Aucun scénario disponible. Crée un scénario pour démarrer tes simulations.</Alert>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nom</TableCell>
                <TableCell>Année de base</TableCell>
                <TableCell align="right">Taux de gel</TableCell>
                <TableCell align="right">Dividende privilégié</TableCell>
                <TableCell align="right">Horizon de rachat</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {scenariosQuery.data.map((scenario) => (
                <TableRow key={scenario.id} hover selected={scenario.id === simulationForm.scenarioId}>
                  <TableCell>{scenario.label}</TableCell>
                  <TableCell>{scenario.baseYear}</TableCell>
                  <TableCell align="right">{scenario.freezeRatePercent.toFixed(1)} %</TableCell>
                  <TableCell align="right">{scenario.preferredDividendRatePercent.toFixed(1)} %</TableCell>
                  <TableCell align="right">{scenario.redemptionYears} ans</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" variant="outlined" onClick={() => setSimulationForm((prev) => ({ ...prev, scenarioId: scenario.id }))}>
                        Sélectionner
                      </Button>
                      <IconButton color="error" onClick={() => handleDeleteScenario(scenario.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
  <Typography variant="h6">Paramètres de simulation</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              select
              label="Scénario"
              value={simulationForm.scenarioId ?? ''}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setSimulationForm((prev) => ({
                  ...prev,
                  scenarioId: event.target.value ? Number(event.target.value) : null
                }))
              }
              fullWidth
              helperText="Choisis le scénario sur lequel appliquer le gel"
            >
              <MenuItem value="">
                <em>—</em>
              </MenuItem>
              {scenariosQuery.data?.map((scenario) => (
                <MenuItem key={scenario.id} value={scenario.id}>
                  {scenario.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="Année de gel"
              type="number"
              value={simulationForm.targetFreezeYear}
              onChange={handleSimulationFieldChange('targetFreezeYear')}
              inputProps={{ min: CURRENT_YEAR, max: CURRENT_YEAR + 40 }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="Générations"
              type="number"
              value={simulationForm.generations}
              onChange={handleSimulationFieldChange('generations')}
              inputProps={{ min: 1, max: 4 }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="Taux de réinvestissement %"
              type="number"
              value={simulationForm.reinvestmentRatePercent}
              onChange={handleSimulationFieldChange('reinvestmentRatePercent')}
              inputProps={{ step: 0.5, min: 0, max: 20 }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="Taux marginal d’impôt %"
              type="number"
              value={simulationForm.marginalTaxRatePercent}
              onChange={handleSimulationFieldChange('marginalTaxRatePercent')}
              inputProps={{ step: 0.5, min: 0, max: 60 }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="Rétention des dividendes %"
              type="number"
              value={simulationForm.dividendRetentionPercent}
              onChange={handleSimulationFieldChange('dividendRetentionPercent')}
              inputProps={{ step: 0.5, min: 0, max: 100 }}
              fullWidth
            />
          </Grid>
        </Grid>

        <Box>
          <Typography variant="subtitle1">Actifs à geler</Typography>
          {assetsQuery.isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={22} />
            </Box>
          ) : !assetsQuery.data || assetsQuery.data.length === 0 ? (
            <Alert severity="info">Aucun actif disponible pour le gel. Ajoute des actifs via le back-office.</Alert>
          ) : (
            <Grid container spacing={1.5}>
              {assetsQuery.data.map((asset) => (
                <Grid item xs={12} sm={6} md={4} key={asset.id}>
                  <Paper
                    variant={simulationForm.assetIds.includes(asset.id) ? 'elevation' : 'outlined'}
                    sx={{
                      p: 2,
                      borderColor: simulationForm.assetIds.includes(asset.id) ? 'primary.main' : undefined
                    }}
                  >
                    <Stack spacing={1}>
                      <Typography variant="subtitle2">{asset.label}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Valeur actuelle : {formatMoney(asset.fairMarketValue)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Croissance : {asset.annualGrowthPercent.toFixed(1)} % - Rendement : {asset.distributionYieldPercent.toFixed(1)} %
                      </Typography>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={simulationForm.assetIds.includes(asset.id)}
                            onChange={() => handleToggleAsset(asset.id)}
                          />
                        }
                        label="Inclure dans le gel"
                      />
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>

        {simulationError && <Alert severity="error">{simulationError}</Alert>}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <Button variant="contained" onClick={handleRunSimulation} disabled={runSimulation.isPending}>
            Lancer la simulation
          </Button>
          {runSimulation.isPending && <CircularProgress size={20} />}
        </Stack>
      </Paper>

      {simulationResult && (
        <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h6">Resultats de la simulation</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Valeur des actions privilegiees
                </Typography>
                <Typography variant="h6">{formatMoney(simulationResult.preferredShareValue)}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Gain en capital declenche
                </Typography>
                <Typography variant="h6">{formatMoney(simulationResult.capitalGainTriggered)}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Impot immediat
                </Typography>
                <Typography variant="h6">{formatMoney(simulationResult.capitalGainTax)}</Typography>
              </Paper>
            </Grid>
          </Grid>

          <Divider />

          <Typography variant="subtitle1">Flux de dividendes projetes</Typography>
          {simulationResult.dividendStream.length === 0 ? (
            <Alert severity="info">Aucun dividende privilegie projete pour ce scenario.</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Annee</TableCell>
                  <TableCell align="right">Flux brut</TableCell>
                  <TableCell align="right">Montant imposable</TableCell>
                  <TableCell align="right">Retenu apres impots</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {simulationResult.dividendStream.map((entry) => (
                  <TableRow key={entry.year}>
                    <TableCell>{entry.year}</TableCell>
                    <TableCell align="right">{formatMoney(entry.amount)}</TableCell>
                    <TableCell align="right">{formatMoney(entry.taxableAmount)}</TableCell>
                    <TableCell align="right">{formatMoney(entry.afterTaxRetained)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Typography variant="subtitle1">Calendrier de rachat</Typography>
          {simulationResult.redemptionSchedule.length === 0 ? (
            <Alert severity="info">Aucun rachat privilegie planifie.</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Annee</TableCell>
                  <TableCell align="right">Solde</TableCell>
                  <TableCell align="right">Rachete</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {simulationResult.redemptionSchedule.map((entry) => (
                  <TableRow key={entry.year}>
                    <TableCell>{entry.year}</TableCell>
                    <TableCell align="right">{formatMoney(entry.outstanding)}</TableCell>
                    <TableCell align="right">{formatMoney(entry.redeemed)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Typography variant="subtitle1">Allocation a la fiducie familiale</Typography>
          {simulationResult.familyTrustAllocation.length === 0 ? (
            <Alert severity="info">Aucune repartition dans la fiducie pour ce scenario.</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Beneficiaire</TableCell>
                  <TableCell align="right">Valeur cumulee</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {simulationResult.familyTrustAllocation.map((entry, index) => (
                  <TableRow key={entry.beneficiaryId ?? `${entry.beneficiaryName}-${index}`}>
                    <TableCell>{entry.beneficiaryName}</TableCell>
                    <TableCell align="right">{formatMoney(entry.cumulativeValue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {simulationResult.notes.length > 0 && (
            <Stack spacing={1}>
              <Typography variant="subtitle1">Annotations</Typography>
              {simulationResult.notes.map((note, index) => (
                <Alert key={`${note.label}-${index}`} severity="info" icon={false}>
                  <strong>{note.label}</strong>: {note.value}
                </Alert>
              ))}
            </Stack>
          )}
        </Paper>
      )}

      <Dialog open={scenarioDialogOpen} onClose={handleCloseScenarioDialog} fullWidth maxWidth="sm">
        <DialogTitle>Nouveau scenario de gel</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {scenarioError && <Alert severity="error">{scenarioError}</Alert>}
          <TextField label="Nom du scenario" value={scenarioForm.label} onChange={handleScenarioFieldChange('label')} required />
          <TextField
            label="Annee de base"
            type="number"
            value={scenarioForm.baseYear}
            onChange={handleScenarioFieldChange('baseYear')}
            inputProps={{ min: CURRENT_YEAR - 10, max: CURRENT_YEAR }}
            required
          />
          <TextField
            label="Taux de gel %"
            type="number"
            value={scenarioForm.freezeRatePercent}
            onChange={handleScenarioFieldChange('freezeRatePercent')}
            inputProps={{ step: 0.5, min: 0, max: 15 }}
            required
          />
          <TextField
            label="Dividende privilegie %"
            type="number"
            value={scenarioForm.preferredDividendRatePercent}
            onChange={handleScenarioFieldChange('preferredDividendRatePercent')}
            inputProps={{ step: 0.25, min: 0, max: 15 }}
            required
          />
          <TextField
            label="Horizon de rachat (annees)"
            type="number"
            value={scenarioForm.redemptionYears}
            onChange={handleScenarioFieldChange('redemptionYears')}
            inputProps={{ min: 5, max: 40 }}
            required
          />
          <TextField
            label="Notes internes"
            multiline
            minRows={3}
            value={scenarioForm.notes ?? ''}
            onChange={handleScenarioFieldChange('notes')}
            placeholder="Hypotheses utilisees, fiducies impliquees, etc."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseScenarioDialog}>Annuler</Button>
          <Button variant="contained" onClick={handleScenarioSubmit} disabled={createScenario.isPending}>
            {createScenario.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
