import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import SaveIcon from '@mui/icons-material/Save';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

import { useCompanies } from '../api/companies';
import {
  downloadLeveragedBuybackPdfById,
  downloadLeveragedBuybackSnapshotPdf,
  simulateLeveragedBuyback,
  useCreateLeveragedBuybackScenario,
  useLeveragedBuybackScenarios,
  type LeveragedBuybackMetrics,
  type LeveragedBuybackPayload,
  type LeveragedBuybackScenarioDto,
  type LeveragedBuybackSimulationPayload,
  type LeveragedBuybackSimulationResponse
} from '../api/leveragedBuyback';
import { downloadBlob } from '../utils/download';

interface FormState {
  loanAmount: string;
  interestRatePercent: string;
  taxRatePercent: string;
  expectedGrowthPercent: string;
  termYears: string;
  label: string;
  notes: string;
}

type SnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error';
};

const INITIAL_FORM: FormState = {
  loanAmount: '350000',
  interestRatePercent: '4.75',
  taxRatePercent: '47',
  expectedGrowthPercent: '8',
  termYears: '5',
  label: '',
  notes: ''
};

function parseNumber(value: string): number | null {
  const normalized = value
    .replace(/\s+/g, '')
    .replace(/\$/g, '')
    .replace(/%/g, '')
    .replace(/,/g, '.')
    .trim();

  if (!normalized) {
    return null;
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function buildPayload(form: FormState): LeveragedBuybackSimulationPayload | null {
  const loanAmount = parseNumber(form.loanAmount);
  const interestRatePercent = parseNumber(form.interestRatePercent);
  const taxRatePercent = parseNumber(form.taxRatePercent);
  const expectedGrowthPercent = parseNumber(form.expectedGrowthPercent);
  const termYears = parseNumber(form.termYears);

  if (
    loanAmount === null ||
    interestRatePercent === null ||
    taxRatePercent === null ||
    expectedGrowthPercent === null ||
    termYears === null ||
    loanAmount <= 0 ||
    interestRatePercent < 0 ||
    taxRatePercent < 0 ||
    termYears <= 0
  ) {
    return null;
  }

  return {
    loanAmount,
    interestRatePercent,
    taxRatePercent,
    expectedGrowthPercent,
    termYears
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}

function formatDecimal(value: number, digits = 2): string {
  return value.toLocaleString('fr-CA', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Une erreur est survenue lors du calcul.';
}

function determineOutcome(metrics: LeveragedBuybackMetrics | null) {
  if (!metrics) {
    return null;
  }

  if (metrics.netGain > 0) {
    return {
      severity: 'success' as const,
      title: 'Rachat rentable',
      message: 'Le gain net projeté est positif après impôt. Le levier semble créer de la valeur.'
    };
  }

  if (metrics.netGain === 0) {
    return {
      severity: 'info' as const,
      title: 'Point mort',
      message: 'Le scénario atteint l’équilibre : aucun gain ni perte projeté. Une validation plus fine est recommandée.'
    };
  }

  return {
    severity: 'warning' as const,
    title: 'Scénario à surveiller',
    message:
      'Le coût net dépasse le rendement anticipé. Revoyez les hypothèses ou envisagez un ticket plus modeste.'
  };
}

export default function LeveragedBuybackScreen() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [approved, setApproved] = useState<boolean>(false);
  const [simulation, setSimulation] = useState<LeveragedBuybackSimulationResponse | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [simulationLoading, setSimulationLoading] = useState<boolean>(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success'
  });

  const companiesQuery = useCompanies();
  const scenariosQuery = useLeveragedBuybackScenarios();
  const createScenario = useCreateLeveragedBuybackScenario();

  const requestRef = useRef(0);

  useEffect(() => {
    if (!selectedCompanyId && approved) {
      setApproved(false);
    }
  }, [selectedCompanyId, approved]);

  useEffect(() => {
    const payload = buildPayload(form);
    if (!payload) {
      setSimulation(null);
      setSimulationError('Renseignez les paramètres pour voir la simulation.');
      setSimulationLoading(false);
      return;
    }

    setSimulationError(null);
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    const timer = window.setTimeout(() => {
      setSimulationLoading(true);
      simulateLeveragedBuyback(payload)
        .then((data) => {
          if (requestRef.current === requestId) {
            setSimulation(data);
            setSimulationError(null);
          }
        })
        .catch((error) => {
          if (requestRef.current === requestId) {
            setSimulation(null);
            setSimulationError(extractErrorMessage(error));
          }
        })
        .finally(() => {
          if (requestRef.current === requestId) {
            setSimulationLoading(false);
          }
        });
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [form]);

  const selectedCompanyName = useMemo(() => {
    if (!selectedCompanyId) {
      return null;
    }
    const id = Number(selectedCompanyId);
    if (!Number.isFinite(id)) {
      return null;
    }
    return companiesQuery.data?.find((company) => company.id === id)?.name ?? null;
  }, [companiesQuery.data, selectedCompanyId]);

  const outcome = useMemo(() => determineOutcome(simulation?.metrics ?? null), [simulation]);

  const handleFieldChange = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const closeSnackbar = () => setSnackbar((prev) => ({ ...prev, open: false }));

  const handleSaveScenario = () => {
    const basePayload = buildPayload(form);
    if (!basePayload) {
      setSnackbar({
        open: true,
        severity: 'warning',
        message: 'Complétez les paramètres avant d’enregistrer.'
      });
      return;
    }

    const payload: LeveragedBuybackPayload = {
      ...basePayload,
      label: form.label.trim() ? form.label.trim() : null,
      notes: form.notes.trim() ? form.notes.trim() : null,
      approved,
      companyId: selectedCompanyId ? Number(selectedCompanyId) : null
    };

    createScenario.mutate(payload, {
      onSuccess: (data: LeveragedBuybackScenarioDto) => {
        setSnackbar({
          open: true,
          severity: 'success',
          message: data.approved
            ? 'Scénario validé et journalisé dans la compagnie.'
            : 'Simulation enregistrée dans l’historique.'
        });
      },
      onError: (error) => {
        setSnackbar({
          open: true,
          severity: 'error',
          message: extractErrorMessage(error)
        });
      }
    });
  };

  const handleDownloadSnapshot = async () => {
    const basePayload = buildPayload(form);
    if (!basePayload) {
      setSnackbar({
        open: true,
        severity: 'warning',
        message: 'Complétez les paramètres pour générer le PDF.'
      });
      return;
    }

    const payload: LeveragedBuybackPayload = {
      ...basePayload,
      label: form.label.trim() ? form.label.trim() : null,
      notes: form.notes.trim() ? form.notes.trim() : null,
      approved,
      companyId: selectedCompanyId ? Number(selectedCompanyId) : null,
      companyName: selectedCompanyName ?? undefined
    };

    try {
      const blob = await downloadLeveragedBuybackSnapshotPdf(payload);
      const filename = payload.label
        ? `simulation-rachat-actions-${payload.label.replace(/\s+/g, '-').toLowerCase()}.pdf`
        : 'simulation-rachat-actions.pdf';
      downloadBlob(blob, filename);
      setSnackbar({
        open: true,
        severity: 'success',
        message: 'PDF généré avec succès.'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        severity: 'error',
        message: extractErrorMessage(error)
      });
    }
  };

  const handleDownloadStoredPdf = async (scenarioId: number, label?: string | null) => {
    try {
      const blob = await downloadLeveragedBuybackPdfById(scenarioId);
      const filename = label
        ? `simulation-rachat-actions-${label.replace(/\s+/g, '-').toLowerCase()}.pdf`
        : `simulation-rachat-actions-${scenarioId}.pdf`;
      downloadBlob(blob, filename);
    } catch (error) {
      setSnackbar({
        open: true,
        severity: 'error',
        message: extractErrorMessage(error)
      });
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h4">Simulation de rachat d’actions avec effet de levier</Typography>
        <Typography variant="body2" color="text.secondary">
          Compare le coût net du refinancement hypothécaire et le rendement projeté des actions.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle1">Paramètres financiers</Typography>
            <TextField
              label="Montant refinancé"
              value={form.loanAmount}
              onChange={handleFieldChange('loanAmount')}
              InputProps={{ endAdornment: <span>$</span> }}
              fullWidth
            />
            <TextField
              label="Taux hypothécaire (%)"
              value={form.interestRatePercent}
              onChange={handleFieldChange('interestRatePercent')}
              fullWidth
            />
            <TextField
              label="Durée analysée (années)"
              value={form.termYears}
              onChange={handleFieldChange('termYears')}
              fullWidth
            />
            <TextField
              label="Taux d’impôt marginal (%)"
              value={form.taxRatePercent}
              onChange={handleFieldChange('taxRatePercent')}
              fullWidth
            />
            <TextField
              label="Croissance attendue des actions (%)"
              value={form.expectedGrowthPercent}
              onChange={handleFieldChange('expectedGrowthPercent')}
              fullWidth
            />

            <Typography variant="subtitle1" sx={{ mt: 2 }}>
              Contexte & intégration
            </Typography>
            <TextField
              select
              label="Compagnie cible"
              value={selectedCompanyId}
              onChange={(event) => setSelectedCompanyId(event.target.value)}
              helperText="Optionnel – permet de lier la simulation à une société"
              fullWidth
            >
              <MenuItem value="">Aucune (simulation personnelle)</MenuItem>
              {companiesQuery.data?.map((company) => (
                <MenuItem key={company.id} value={company.id.toString()}>
                  {company.name}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={
                <Switch
                  checked={approved}
                  onChange={(event) => setApproved(event.target.checked)}
                  disabled={!selectedCompanyId}
                />
              }
              label="Valider immédiatement ce scénario dans la compagnie"
            />
            <TextField
              label="Nom du scénario"
              placeholder="Ex. Rachat parts Tremblay"
              value={form.label}
              onChange={handleFieldChange('label')}
              fullWidth
            />
            <TextField
              label="Notes internes"
              value={form.notes}
              onChange={handleFieldChange('notes')}
              multiline
              minRows={3}
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSaveScenario}
                disabled={createScenario.isPending}
              >
                Enregistrer le scénario
              </Button>
              <Button
                variant="outlined"
                startIcon={<PictureAsPdfIcon />}
                onClick={handleDownloadSnapshot}
              >
                Générer le PDF
              </Button>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, minHeight: 420, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1">Analyse automatique</Typography>
              {simulationLoading && <CircularProgress size={20} />}
            </Stack>

            {simulationError && (
              <Alert severity="warning" variant="outlined">
                {simulationError}
              </Alert>
            )}

            {!simulationError && simulation && outcome && (
              <Alert severity={outcome.severity} variant="outlined">
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {outcome.title}
                </Typography>
                <Typography variant="body2">{outcome.message}</Typography>
              </Alert>
            )}

            {simulation && (
              <>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.100' }}>
                      <Typography variant="overline" color="text.secondary">
                        Paiement hypothécaire
                      </Typography>
                      <Typography variant="h5">{formatCurrency(simulation.metrics.monthlyPayment)}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Versement mensuel sur {formatDecimal(simulation.inputs.termYears, 2)} ans
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.100' }}>
                      <Typography variant="overline" color="text.secondary">
                        Coût net après impôt
                      </Typography>
                      <Typography variant="h5">{formatCurrency(simulation.metrics.afterTaxInterest)}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Intérêts payés {formatCurrency(simulation.metrics.totalInterest)} · économie fiscale {formatCurrency(simulation.metrics.taxShield)}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.100' }}>
                      <Typography variant="overline" color="text.secondary">
                        Valeur projetée des actions
                      </Typography>
                      <Typography variant="h5">{formatCurrency(simulation.metrics.projectedShareValue)}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Gain brut anticipé {formatCurrency(simulation.metrics.projectedShareGain)}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.100' }}>
                      <Typography variant="overline" color="text.secondary">
                        Gain net global
                      </Typography>
                      <Typography
                        variant="h5"
                        color={simulation.metrics.netGain >= 0 ? 'success.main' : 'warning.main'}
                      >
                        {formatCurrency(simulation.metrics.netGain)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        ROI projeté {formatPercent(simulation.metrics.returnOnInvestmentPercent)} · Point mort {formatPercent(simulation.metrics.breakEvenGrowthPercent)}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                <Box>
                  <Typography variant="subtitle2" sx={{ mt: 2 }}>
                    Hypothèses clés
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Taux d’impôt de {formatPercent(simulation.inputs.taxRatePercent)} · croissance attendue de {formatPercent(simulation.inputs.expectedGrowthPercent)} · durée {formatDecimal(simulation.inputs.termYears, 2)} années.
                  </Typography>
                  {typeof simulation.metrics.paybackYears === 'number' && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Le coût net est couvert après environ {formatDecimal(simulation.metrics.paybackYears, 1)} années de rendement.
                    </Typography>
                  )}
                </Box>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
          <Typography variant="h6">Historique des simulations</Typography>
          <Typography variant="body2" color="text.secondary">
            Les scénarios validés créent automatiquement une résolution interne.
          </Typography>
        </Stack>

        {scenariosQuery.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : scenariosQuery.error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            Impossible de charger l’historique pour le moment.
          </Alert>
        ) : scenariosQuery.data && scenariosQuery.data.length > 0 ? (
          <Table size="small" sx={{ mt: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>Créé le</TableCell>
                <TableCell>Société</TableCell>
                <TableCell>Montant</TableCell>
                <TableCell>Taux</TableCell>
                <TableCell>Durée (ans)</TableCell>
                <TableCell>Gain net</TableCell>
                <TableCell>ROI</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {scenariosQuery.data.map((scenario) => (
                <TableRow key={scenario.id} hover>
                  <TableCell>{new Date(scenario.createdAt).toLocaleDateString('fr-CA')}</TableCell>
                  <TableCell>{scenario.companyName ?? '—'}</TableCell>
                  <TableCell>{formatCurrency(scenario.inputs.loanAmount)}</TableCell>
                  <TableCell>{formatPercent(scenario.inputs.interestRatePercent)}</TableCell>
                  <TableCell>{formatDecimal(scenario.inputs.termYears, 1)}</TableCell>
                  <TableCell>
                    <Typography color={scenario.metrics.netGain >= 0 ? 'success.main' : 'warning.main'}>
                      {formatCurrency(scenario.metrics.netGain)}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatPercent(scenario.metrics.returnOnInvestmentPercent)}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Télécharger le rapport PDF">
                      <IconButton onClick={() => handleDownloadStoredPdf(scenario.id, scenario.label)}>
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Aucun scénario enregistré pour l’instant.
          </Typography>
        )}
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
