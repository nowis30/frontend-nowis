import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

import {
  usePersonalIncomeShareholders,
  usePersonalIncomes,
  usePersonalIncomeSummary,
  useCreatePersonalIncome,
  useUpdatePersonalIncome,
  useDeletePersonalIncome,
  type PersonalIncomeDto,
  type PersonalIncomeCategory,
  type PersonalIncomePayload
} from '../api/personalIncome';
import { useComputePersonalTaxReturn } from '../api/tax';

interface PersonalIncomeFormState {
  shareholderId: number | null;
  taxYear: number;
  category: PersonalIncomeCategory;
  label: string;
  source: string;
  slipType: string;
  amount: number;
}

const categoryLabels: Record<PersonalIncomeCategory, string> = {
  EMPLOYMENT: 'Salaire (T4)',
  PENSION: 'Pension privée (T4A)',
  OAS: 'Pension de vieillesse (T4A(OAS))',
  CPP_QPP: 'RRQ/RPC (T4A(P))',
  RRIF_RRSP: 'Retrait REER/FERR',
  BUSINESS: "Revenu d'entreprise",
  ELIGIBLE_DIVIDEND: 'Dividende admissible (T5)',
  NON_ELIGIBLE_DIVIDEND: 'Dividende non admissible',
  CAPITAL_GAIN: 'Gain en capital imposable',
  OTHER: 'Autre revenu imposable'
};

const categoryOptions = (Object.keys(categoryLabels) as PersonalIncomeCategory[]).map((key) => ({
  value: key,
  label: categoryLabels[key]
}));

function createInitialForm(shareholderId: number | null, taxYear: number): PersonalIncomeFormState {
  return {
    shareholderId,
    taxYear,
    category: 'EMPLOYMENT',
    label: '',
    source: '',
    slipType: '',
    amount: 0
  };
}

function PersonalIncomeScreen() {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [selectedShareholderId, setSelectedShareholderId] = useState<number | null>(null);
  const [selectedTaxYear, setSelectedTaxYear] = useState<number>(currentYear);
  const [form, setForm] = useState<PersonalIncomeFormState>(createInitialForm(null, currentYear));
  const [formOpen, setFormOpen] = useState(false);
  const [editingIncomeId, setEditingIncomeId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deductions, setDeductions] = useState<number>(0);
  const [otherCredits, setOtherCredits] = useState<number>(0);
  const [province, setProvince] = useState<'QC' | 'OTHER'>('QC');
  const [calculationError, setCalculationError] = useState<string | null>(null);

  const { data: shareholders, isLoading: isLoadingShareholders } = usePersonalIncomeShareholders();

  useEffect(() => {
    if (!shareholders || shareholders.length === 0) {
      return;
    }

    if (!selectedShareholderId) {
      setSelectedShareholderId(shareholders[0].id);
      setForm((prev) => ({ ...prev, shareholderId: shareholders[0].id }));
      return;
    }

    if (!shareholders.some((shareholder) => shareholder.id === selectedShareholderId)) {
      setSelectedShareholderId(shareholders[0].id);
      setForm((prev) => ({ ...prev, shareholderId: shareholders[0].id }));
    }
  }, [shareholders, selectedShareholderId]);

  const { data: incomes, isLoading: isLoadingIncomes } = usePersonalIncomes(
    selectedShareholderId,
    selectedTaxYear
  );
  const { data: summary, isLoading: isLoadingSummary } = usePersonalIncomeSummary(
    selectedShareholderId,
    selectedTaxYear
  );

  const createIncome = useCreatePersonalIncome();
  const deleteIncome = useDeletePersonalIncome();
  const updateIncome = useUpdatePersonalIncome(editingIncomeId);
  const computePersonalTax = useComputePersonalTaxReturn();

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('fr-CA', {
        style: 'currency',
        currency: 'CAD'
      }),
    []
  );

  const handleOpenForm = () => {
    setFormError(null);
    setEditingIncomeId(null);
    setForm(createInitialForm(selectedShareholderId, selectedTaxYear));
    setFormOpen(true);
  };

  const handleEditIncome = (income: PersonalIncomeDto) => {
    setFormError(null);
    setEditingIncomeId(income.id);
    setForm({
      shareholderId: income.shareholderId,
      taxYear: income.taxYear,
      category: income.category,
      label: income.label,
      source: income.source ?? '',
      slipType: income.slipType ?? '',
      amount: income.amount
    });
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setForm(createInitialForm(selectedShareholderId, selectedTaxYear));
    setEditingIncomeId(null);
    setFormError(null);
  };

  const buildPayload = (): PersonalIncomePayload | null => {
    if (!form.shareholderId) {
      setFormError('Choisis un actionnaire.');
      return null;
    }

    if (!form.label.trim()) {
      setFormError('Ajoute un libellé.');
      return null;
    }

    if (!Number.isFinite(form.amount) || form.amount <= 0) {
      setFormError('Indique un montant supérieur à 0.');
      return null;
    }

    if (!Number.isInteger(form.taxYear) || form.taxYear < 2000) {
      setFormError('Choisis une année fiscale valide.');
      return null;
    }

    return {
      shareholderId: form.shareholderId,
      taxYear: form.taxYear,
      category: form.category,
      label: form.label.trim(),
      source: form.source.trim() ? form.source.trim() : null,
      slipType: form.slipType.trim() ? form.slipType.trim() : null,
      amount: Number(form.amount)
    };
  };

  const handleSubmitForm = () => {
    const payload = buildPayload();
    if (!payload) {
      return;
    }

    const onError = () => setFormError("Enregistrement impossible pour le moment.");

    if (editingIncomeId) {
      updateIncome.mutate(payload, {
        onSuccess: () => {
          handleCloseForm();
        },
        onError
      });
      return;
    }

    createIncome.mutate(payload, {
      onSuccess: () => {
        handleCloseForm();
      },
      onError
    });
  };

  const handleDeleteIncome = (income: PersonalIncomeDto) => {
    const confirmed = window.confirm(`Supprimer le revenu "${income.label}" ?`);
    if (!confirmed) {
      return;
    }

    deleteIncome.mutate(income.id);
  };

  const isSaving = createIncome.isPending || updateIncome.isPending;

  const handleCalculateTax = () => {
    setCalculationError(null);

    if (!selectedShareholderId) {
      setCalculationError('Sélectionne un actionnaire pour lancer le calcul.');
      return;
    }

    if (!summary) {
      setCalculationError('Aucune donnée de revenu disponible pour cette année.');
      return;
    }

    computePersonalTax.mutate({
      shareholderId: selectedShareholderId,
      taxYear: selectedTaxYear,
      employmentIncome: summary.taxInputs.employmentIncome,
      businessIncome: summary.taxInputs.businessIncome,
      eligibleDividends: summary.taxInputs.eligibleDividends,
      nonEligibleDividends: summary.taxInputs.nonEligibleDividends,
      capitalGains: summary.taxInputs.capitalGains,
      deductions,
      otherCredits,
      province: province === 'QC' ? 'QC' : 'OTHER'
    });
  };

  useEffect(() => {
    if (computePersonalTax.isError) {
      setCalculationError('Le calcul est impossible pour le moment.');
    }
  }, [computePersonalTax.isError]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4">Revenus personnels imposables</Typography>
          <Typography variant="body2" color="text.secondary">
            Saisis ici les feuillets T4, pensions et autres revenus à intégrer dans le calcul de l&apos;impôt.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField
            select
            size="small"
            label="Actionnaire"
            value={selectedShareholderId ?? ''}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) {
                setSelectedShareholderId(value);
                setForm((prev) => ({ ...prev, shareholderId: value }));
              }
            }}
            sx={{ minWidth: 220 }}
            disabled={isLoadingShareholders || !shareholders || shareholders.length === 0}
          >
            {shareholders?.map((shareholder) => (
              <MenuItem key={shareholder.id} value={shareholder.id}>
                {shareholder.displayName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Année fiscale"
            size="small"
            type="number"
            value={selectedTaxYear}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) {
                const sanitized = Math.trunc(value);
                setSelectedTaxYear(sanitized);
                setForm((prev) => ({ ...prev, taxYear: sanitized }));
              }
            }}
            sx={{ width: 140 }}
            inputProps={{ min: 2000, max: currentYear + 1 }}
          />
          <Button variant="contained" onClick={handleOpenForm} disabled={!selectedShareholderId}>
            Ajouter un revenu
          </Button>
        </Stack>
      </Stack>

      {isLoadingIncomes ? (
        <Typography>Chargement des revenus...</Typography>
      ) : !incomes || incomes.length === 0 ? (
        <Paper sx={{ p: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            Aucun revenu enregistré pour cette sélection.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Clique sur « Ajouter un revenu » pour saisir tes feuillets T4/T5 ou pensions.
          </Typography>
        </Paper>
      ) : (
        <Table component={Paper} size="small">
          <TableHead>
            <TableRow>
              <TableCell>Catégorie</TableCell>
              <TableCell>Libellé</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Feuillet</TableCell>
              <TableCell align="right">Montant</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {incomes.map((income) => (
              <TableRow key={income.id} hover>
                <TableCell>{categoryLabels[income.category]}</TableCell>
                <TableCell>{income.label}</TableCell>
                <TableCell>{income.source ?? '—'}</TableCell>
                <TableCell>{income.slipType ?? '—'}</TableCell>
                <TableCell align="right">{currencyFormatter.format(income.amount)}</TableCell>
                <TableCell align="right">
                  <IconButton aria-label="modifier" onClick={() => handleEditIncome(income)} sx={{ mr: 0.5 }}>
                    <EditIcon />
                  </IconButton>
                  <IconButton aria-label="supprimer" onClick={() => handleDeleteIncome(income)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Grid container spacing={3} mt={0} sx={{ mt: 0, pt: 4 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Résumé par catégorie
            </Typography>
            {isLoadingSummary ? (
              <Typography>Calcul du résumé...</Typography>
            ) : summary ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Catégorie</TableCell>
                    <TableCell align="right">Montant</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(summary.categories)
                    .filter(([, value]) => value > 0)
                    .map(([category, value]) => (
                      <TableRow key={category}>
                        <TableCell>
                          {categoryLabels[category as PersonalIncomeCategory] ?? category}
                        </TableCell>
                        <TableCell align="right">{currencyFormatter.format(value)}</TableCell>
                      </TableRow>
                    ))}
                  <TableRow>
                    <TableCell>
                      <strong>Total</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{currencyFormatter.format(summary.totalIncome)}</strong>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Aucun revenu saisi pour calculer un résumé.
              </Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Montants pour le calcul de l&apos;impôt
            </Typography>
            {summary ? (
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography>Revenus d&apos;emploi et pensions</Typography>
                  <Typography fontWeight={600}>
                    {currencyFormatter.format(summary.taxInputs.employmentIncome)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography>Revenus d&apos;entreprise</Typography>
                  <Typography fontWeight={600}>
                    {currencyFormatter.format(summary.taxInputs.businessIncome)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography>Dividendes admissibles</Typography>
                  <Typography fontWeight={600}>
                    {currencyFormatter.format(summary.taxInputs.eligibleDividends)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography>Dividendes non admissibles</Typography>
                  <Typography fontWeight={600}>
                    {currencyFormatter.format(summary.taxInputs.nonEligibleDividends)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography>Gains en capital imposables</Typography>
                  <Typography fontWeight={600}>
                    {currencyFormatter.format(summary.taxInputs.capitalGains)}
                  </Typography>
                </Stack>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Aucun montant disponible. Ajoute des revenus pour obtenir un calcul.
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3, mt: 4 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">Calcul du rapport d&apos;impôt</Typography>
            <Typography variant="body2" color="text.secondary">
              Ajoute les déductions et crédits applicables puis lance le calcul IA. Le résultat est conservé
              dans tes rapports annuels.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Déductions"
              type="number"
              value={deductions}
              inputProps={{ min: 0, step: 0.01 }}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setDeductions(Number(event.target.value) || 0)
              }
            />
            <TextField
              label="Autres crédits"
              type="number"
              value={otherCredits}
              inputProps={{ min: 0, step: 0.01 }}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setOtherCredits(Number(event.target.value) || 0)
              }
            />
            <TextField
              select
              label="Province pour le calcul"
              value={province}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setProvince(event.target.value === 'OTHER' ? 'OTHER' : 'QC')
              }
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="QC">Québec</MenuItem>
              <MenuItem value="OTHER">Autre province</MenuItem>
            </TextField>
          </Stack>
          {calculationError && <Alert severity="error">{calculationError}</Alert>}
          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              variant="contained"
              onClick={handleCalculateTax}
              disabled={computePersonalTax.isPending || !summary || !selectedShareholderId}
            >
              Calculer l&apos;impôt
            </Button>
            {computePersonalTax.isPending && <Typography>Calcul en cours...</Typography>}
          </Stack>
          {computePersonalTax.data && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1">Résultats</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Revenu imposable
                    </Typography>
                    <Typography variant="h6">
                      {currencyFormatter.format(computePersonalTax.data.taxableIncome)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Impôt fédéral
                    </Typography>
                    <Typography variant="h6">
                      {currencyFormatter.format(computePersonalTax.data.federalTax)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Impôt provincial
                    </Typography>
                    <Typography variant="h6">
                      {currencyFormatter.format(computePersonalTax.data.provincialTax)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Crédits totaux
                    </Typography>
                    <Typography variant="h6">
                      {currencyFormatter.format(computePersonalTax.data.totalCredits)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Solde à payer
                    </Typography>
                    <Typography variant="h6">
                      {currencyFormatter.format(computePersonalTax.data.balanceDue)}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </>
          )}
        </Stack>
      </Paper>

      <Dialog open={formOpen} onClose={handleCloseForm} fullWidth>
        <DialogTitle>{editingIncomeId ? 'Modifier un revenu' : 'Nouveau revenu'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}
          <Stack spacing={2}>
            <TextField
              select
              label="Catégorie"
              value={form.category}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, category: event.target.value as PersonalIncomeCategory }))
              }
              required
            >
              {categoryOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Libellé"
              value={form.label}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, label: event.target.value }))
              }
              required
            />
            <TextField
              label="Source (employeur, institution)"
              value={form.source}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, source: event.target.value }))
              }
            />
            <TextField
              label="Feuillet (T4, T5, etc.)"
              value={form.slipType}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, slipType: event.target.value }))
              }
            />
            <TextField
              label="Montant"
              type="number"
              value={form.amount}
              inputProps={{ min: 0, step: 0.01 }}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, amount: Number(event.target.value) }))
              }
              required
            />
            <TextField
              label="Année fiscale"
              type="number"
              value={form.taxYear}
              inputProps={{ min: 2000, max: currentYear + 1 }}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const value = Number(event.target.value);
                setForm((prev) => ({
                  ...prev,
                  taxYear: Number.isFinite(value) ? Math.trunc(value) : prev.taxYear
                }));
              }}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseForm}>Annuler</Button>
          <Button variant="contained" onClick={handleSubmitForm} disabled={isSaving}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PersonalIncomeScreen;
