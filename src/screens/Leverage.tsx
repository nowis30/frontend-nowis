import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SavingsIcon from '@mui/icons-material/Savings';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import dayjs from 'dayjs';

import {
  type LeverageConversationResponse,
  type LeverageSimulationPayload,
  useLeverageConversation,
  useLeverageScenarios
} from '../api/leverage';

type FormState = {
  label: string;
  sourceType: string;
  principal: string;
  annualRate: string;
  termMonths: string;
  amortizationMonths: string;
  startDate: string;
  investmentVehicle: string;
  expectedReturnAnnual: string;
  expectedVolatility: string;
  planHorizonYears: string;
  interestDeductible: boolean;
  marginalTaxRate: string;
  companyId: string;
  save: boolean;
};

function formatCurrency(value: number, options?: { maximumFractionDigits?: number }) {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: options?.maximumFractionDigits ?? 0
  }).format(value);
}

function formatPercent(value: number, options?: { maximumFractionDigits?: number }) {
  return new Intl.NumberFormat('fr-CA', {
    style: 'percent',
    maximumFractionDigits: options?.maximumFractionDigits ?? 1
  }).format(value);
}

function normalizeRate(value: number): number {
  if (!Number.isFinite(value)) {
    return value;
  }
  return value > 1 ? value / 100 : value;
}

function buildPayload(form: FormState): {
  payload?: LeverageSimulationPayload;
  error?: string;
} {
  if (!form.label.trim()) {
    return { error: 'Ajoutez un libellé pour distinguer votre scénario.' };
  }

  type NumericFieldKey = 'principal' | 'annualRate' | 'termMonths' | 'expectedReturnAnnual' | 'planHorizonYears';

  const requiredNumberFields: Array<{ key: NumericFieldKey; label: string }> = [
    { key: 'principal', label: 'Montant du prêt' },
    { key: 'annualRate', label: 'Taux annuel' },
    { key: 'termMonths', label: 'Durée du prêt (mois)' },
    { key: 'expectedReturnAnnual', label: 'Rendement attendu' },
    { key: 'planHorizonYears', label: 'Horizon (années)' }
  ];

  for (const field of requiredNumberFields) {
  if (!form[field.key].trim()) {
      return { error: `${field.label} est requis.` };
    }
  }

  const parsedPrincipal = Number.parseFloat(form.principal);
  const parsedAnnualRate = normalizeRate(Number.parseFloat(form.annualRate));
  const parsedTerm = Number.parseInt(form.termMonths, 10);
  const parsedExpectedReturn = normalizeRate(Number.parseFloat(form.expectedReturnAnnual));
  const parsedPlanHorizon = Number.parseInt(form.planHorizonYears, 10);

  if (![parsedPrincipal, parsedAnnualRate, parsedTerm, parsedExpectedReturn, parsedPlanHorizon].every(Number.isFinite)) {
    return { error: 'Vérifiez vos valeurs numériques : un des champs requis n’est pas valide.' };
  }

  if (parsedPrincipal <= 0) {
    return { error: 'Le montant du prêt doit être supérieur à 0.' };
  }

  if (parsedAnnualRate < 0) {
    return { error: 'Le taux annuel doit être positif ou nul.' };
  }

  if (parsedTerm <= 0) {
    return { error: 'La durée doit être supérieure à 0 mois.' };
  }

  const parsedAmortization = form.amortizationMonths.trim()
    ? Number.parseInt(form.amortizationMonths, 10)
    : undefined;
  if (parsedAmortization !== undefined && (!Number.isFinite(parsedAmortization) || parsedAmortization <= 0)) {
    return { error: "L'amortissement doit être un entier positif." };
  }

  const parsedVolatility = form.expectedVolatility.trim()
    ? normalizeRate(Number.parseFloat(form.expectedVolatility))
    : undefined;
  if (parsedVolatility !== undefined && !Number.isFinite(parsedVolatility)) {
    return { error: 'Volatilité attendue invalide.' };
  }

  const parsedMarginalTaxRate = form.marginalTaxRate.trim()
    ? normalizeRate(Number.parseFloat(form.marginalTaxRate))
    : undefined;
  if (parsedMarginalTaxRate !== undefined && (!Number.isFinite(parsedMarginalTaxRate) || parsedMarginalTaxRate < 0)) {
    return { error: 'Le taux marginal est invalide.' };
  }

  const parsedCompanyId = form.companyId.trim() ? Number.parseInt(form.companyId, 10) : undefined;
  if (parsedCompanyId !== undefined && (!Number.isFinite(parsedCompanyId) || parsedCompanyId <= 0)) {
    return { error: "L'identifiant d'entreprise doit être supérieur à 0." };
  }

  if (!form.startDate.trim() || Number.isNaN(Date.parse(form.startDate))) {
    return { error: 'Date de début invalide.' };
  }

  const payload: LeverageSimulationPayload = {
    label: form.label.trim(),
    sourceType: form.sourceType as LeverageSimulationPayload['sourceType'],
    principal: parsedPrincipal,
    annualRate: parsedAnnualRate,
    termMonths: parsedTerm,
    amortizationMonths: parsedAmortization,
    startDate: new Date(form.startDate).toISOString(),
    investmentVehicle: form.investmentVehicle as LeverageSimulationPayload['investmentVehicle'],
    expectedReturnAnnual: parsedExpectedReturn,
    expectedVolatility: parsedVolatility,
    planHorizonYears: parsedPlanHorizon,
    interestDeductible: form.interestDeductible,
    marginalTaxRate: parsedMarginalTaxRate,
    companyId: parsedCompanyId,
    save: form.save
  };

  return { payload };
}

function extractMetrics(data: LeverageConversationResponse | null) {
  if (!data) {
    return [] as Array<{ id: string; label: string; value: string; icon: JSX.Element }>;
  }

  return [
    {
      id: 'annual-debt-service',
      label: 'Service annuel de la dette',
      value: formatCurrency(data.summary.annualDebtService, { maximumFractionDigits: 0 }),
      icon: <SavingsIcon color="primary" />
    },
    {
      id: 'net-delta',
      label: 'Gain net attendu',
      value: formatCurrency(data.summary.netExpectedDelta, { maximumFractionDigits: 0 }),
      icon: <TrendingUpIcon color={data.summary.netExpectedDelta >= 0 ? 'success' : 'warning'} />
    },
    {
      id: 'break-even',
      label: 'Rendement seuil',
      value: formatPercent(data.summary.breakEvenReturn, { maximumFractionDigits: 2 }),
      icon: <TaskAltIcon color="secondary" />
    },
    {
      id: 'monthly-payment',
      label: 'Paiement mensuel',
      value: formatCurrency(data.summary.details.monthlyPayment, { maximumFractionDigits: 0 }),
      icon: <CalendarMonthIcon color="action" />
    }
  ];
}

const SOURCE_OPTIONS = [
  { value: 'HOME_EQUITY', label: 'Valeur domiciliaire' },
  { value: 'RENTAL_PROPERTY', label: 'Immeuble locatif' },
  { value: 'HELOC', label: 'Marge de crédit (HELOC)' },
  { value: 'CORPORATE_LOAN', label: 'Prêt corporatif' }
];

const VEHICLE_OPTIONS = [
  { value: 'ETF', label: 'ETF' },
  { value: 'STOCK', label: 'Actions individuelles' },
  { value: 'REALESTATE', label: 'Immobilier' },
  { value: 'BUSINESS', label: 'Entreprise' },
  { value: 'FUND', label: 'Fonds privés' }
];

export default function LeverageScreen() {
  const [form, setForm] = useState<FormState>({
    label: '',
    sourceType: 'HOME_EQUITY',
    principal: '',
    annualRate: '0.05',
    termMonths: '60',
    amortizationMonths: '300',
    startDate: dayjs().format('YYYY-MM-DD'),
    investmentVehicle: 'ETF',
    expectedReturnAnnual: '0.07',
    expectedVolatility: '',
    planHorizonYears: '10',
    interestDeductible: true,
    marginalTaxRate: '0.47',
    companyId: '',
    save: true
  });
  const [formError, setFormError] = useState<string | null>(null);

  const leverageConversation = useLeverageConversation();
  const scenariosQuery = useLeverageScenarios();

  const metrics = useMemo(() => extractMetrics(leverageConversation.data ?? null), [leverageConversation.data]);

  function handleChange(key: keyof FormState) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      setForm((previous) => ({ ...previous, [key]: value }));
    };
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const { payload, error } = buildPayload(form);
    if (error || !payload) {
      setFormError(error ?? 'Champs invalides.');
      return;
    }
    leverageConversation.mutate(payload);
  }

  const summary = leverageConversation.data?.summary ?? null;

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h4" gutterBottom>
          Effet de levier intelligent
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Simulez un emprunt, comparez le coût réel après impôt et obtenez une narration prête à partager avec votre
          comité IA.
        </Typography>
      </Box>

      <Paper elevation={3} sx={{ p: 3 }}>
        <Stack component="form" spacing={3} onSubmit={handleSubmit}>
          <Typography variant="h6">Paramètres du scénario</Typography>

          {formError && <Alert severity="warning">{formError}</Alert>}
          {leverageConversation.isError && (
            <Alert severity="error">
              {(leverageConversation.error as Error)?.message ?? 'Impossible de lancer la simulation pour le moment.'}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Libellé du scénario"
                value={form.label}
                onChange={handleChange('label')}
                required
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                label="Source des fonds"
                value={form.sourceType}
                onChange={handleChange('sourceType')}
                fullWidth
              >
                {SOURCE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                label="Véhicule d'investissement"
                value={form.investmentVehicle}
                onChange={handleChange('investmentVehicle')}
                fullWidth
              >
                {VEHICLE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                label="Montant emprunté"
                type="number"
                value={form.principal}
                onChange={handleChange('principal')}
                required
                fullWidth
                inputProps={{ min: 0, step: '1000' }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Taux annuel (ex. 5 ou 0.05)"
                type="number"
                value={form.annualRate}
                onChange={handleChange('annualRate')}
                required
                fullWidth
                inputProps={{ step: '0.01' }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Durée (mois)"
                type="number"
                value={form.termMonths}
                onChange={handleChange('termMonths')}
                required
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Amortissement (mois)"
                type="number"
                value={form.amortizationMonths}
                onChange={handleChange('amortizationMonths')}
                helperText="Optionnel – laisser vide pour intérêt seulement"
                fullWidth
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                label="Date de début"
                type="date"
                value={form.startDate}
                onChange={handleChange('startDate')}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Rendement attendu (ex. 0.07)"
                type="number"
                value={form.expectedReturnAnnual}
                onChange={handleChange('expectedReturnAnnual')}
                required
                fullWidth
                inputProps={{ step: '0.01' }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Volatilité attendue (optionnel)"
                type="number"
                value={form.expectedVolatility}
                onChange={handleChange('expectedVolatility')}
                fullWidth
                inputProps={{ step: '0.01' }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Horizon (années)"
                type="number"
                value={form.planHorizonYears}
                onChange={handleChange('planHorizonYears')}
                required
                fullWidth
                inputProps={{ min: 1, max: 40 }}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                label="Taux marginal (ex. 0.47)"
                type="number"
                value={form.marginalTaxRate}
                onChange={handleChange('marginalTaxRate')}
                helperText="Optionnel – sera normalisé si > 1"
                fullWidth
                inputProps={{ step: '0.01' }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Entreprise (ID)"
                type="number"
                value={form.companyId}
                onChange={handleChange('companyId')}
                helperText="Optionnel"
                fullWidth
              />
            </Grid>
          </Grid>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <FormControlLabel
              control={<Switch checked={form.interestDeductible} onChange={handleChange('interestDeductible')} />}
              label="Intérêts déductibles"
            />
            <FormControlLabel
              control={<Switch checked={form.save} onChange={handleChange('save')} />}
              label="Enregistrer le scénario"
            />
            <Box flexGrow={1} />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={leverageConversation.isPending}
            >
              {leverageConversation.isPending ? 'Calcul en cours…' : 'Générer la narration'}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {leverageConversation.data && (
        <Stack spacing={3}>
          <Typography variant="h5">Résultats</Typography>

          <Grid container spacing={2}>
            {metrics.map((metric) => (
              <Grid item key={metric.id} xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {metric.icon}
                        <Typography variant="subtitle2" color="text.secondary">
                          {metric.label}
                        </Typography>
                      </Stack>
                      <Typography variant="h5">{metric.value}</Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Paper elevation={1} sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Narration pour l'IA
            </Typography>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
              {leverageConversation.data.narrative}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Points à mettre de l'avant
            </Typography>
            <List>
              {leverageConversation.data.highlights.map((item, index) => (
                <ListItem key={index} disableGutters>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <TaskAltIcon color="success" />
                  </ListItemIcon>
                  <ListItemText primary={item} />
                </ListItem>
              ))}
            </List>
            {leverageConversation.data.savedScenarioId && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Scénario enregistré (ID {leverageConversation.data.savedScenarioId}). Consultez-le dans la liste ci-dessous.
              </Alert>
            )}
          </Paper>
        </Stack>
      )}

      <Paper elevation={3} sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Historique des scénarios enregistrés</Typography>
          {scenariosQuery.isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={32} />
            </Box>
          ) : scenariosQuery.isError ? (
            <Alert severity="warning">Impossible de charger les scénarios enregistrés.</Alert>
          ) : scenariosQuery.data && scenariosQuery.data.length > 0 ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Libellé</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell align="right">Montant</TableCell>
                  <TableCell align="right">Taux</TableCell>
                  <TableCell align="right">Rendement attendu</TableCell>
                  <TableCell align="right">Date de début</TableCell>
                  <TableCell>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {scenariosQuery.data.map((scenario) => (
                  <TableRow key={scenario.id} hover>
                    <TableCell>{scenario.label}</TableCell>
                    <TableCell>
                      <Chip size="small" label={scenario.sourceType.replace(/_/g, ' ')} />
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(Number.parseFloat(scenario.principal), { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell align="right">
                      {formatPercent(Number.parseFloat(scenario.rateAnnual), { maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell align="right">
                      {formatPercent(Number.parseFloat(scenario.expectedReturnAnnual), {
                        maximumFractionDigits: 2
                      })}
                    </TableCell>
                    <TableCell align="right">
                      {new Date(scenario.startDate).toLocaleDateString('fr-CA')}
                    </TableCell>
                    <TableCell>{scenario.notes ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Typography color="text.secondary">
              Aucun scénario enregistré pour le moment. Activez l'option « Enregistrer le scénario » pour conserver vos calculs.
            </Typography>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
