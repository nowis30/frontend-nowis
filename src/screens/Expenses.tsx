import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import dayjs from 'dayjs';

import {
  useCreateExpense,
  useDeleteExpense,
  useExpenses,
  useUpdateExpense,
  useExportFiscalExpenses,
  type ExpenseDto,
  type ExpenseFrequency,
  type ExpensePayload
} from '../api/expenses';
import { usePropertyOptions } from '../api/properties';

const frequencyOptions: Array<{ value: ExpenseFrequency; label: string }> = [
  { value: 'PONCTUEL', label: 'Ponctuel' },
  { value: 'HEBDOMADAIRE', label: 'Hebdomadaire' },
  { value: 'MENSUEL', label: 'Mensuel' },
  { value: 'TRIMESTRIEL', label: 'Trimestriel' },
  { value: 'ANNUEL', label: 'Annuel' }
];

const expenseCategoryHints = [
  'Taxes municipales',
  'Assurances',
  'Énergie',
  'Entretien et réparations',
  'Gestion',
  'Services professionnels',
  'Publicité',
  'Déplacements'
];

interface ExpenseFormState {
  propertyId: number;
  label: string;
  category: string;
  amount: number;
  frequency: ExpenseFrequency;
  startDate: string;
  endDate?: string;
}

const createInitialForm = (): ExpenseFormState => ({
  propertyId: 0,
  label: '',
  category: '',
  amount: 0,
  frequency: 'MENSUEL',
  startDate: dayjs().format('YYYY-MM-DD'),
  endDate: ''
});

function ExpensesScreen() {
  const { data: expenses, isLoading } = useExpenses();
  const { data: properties } = usePropertyOptions();
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const updateExpense = useUpdateExpense(editingExpenseId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ExpenseFormState>(createInitialForm());
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [showAmountHelper, setShowAmountHelper] = useState(false);
  const exportFiscalExpenses = useExportFiscalExpenses();
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('fr-CA', {
        style: 'currency',
        currency: 'CAD'
      }),
    []
  );

  useEffect(() => {
    if (!open || editingExpenseId || !properties || properties.length === 0) {
      return;
    }

    setForm((prev) => ({ ...prev, propertyId: prev.propertyId || properties[0].id }));
  }, [editingExpenseId, open, properties]);

  useEffect(() => {
    if (!exportMessage && !exportError) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setExportMessage(null);
      setExportError(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [exportError, exportMessage]);

  const resetForm = () => {
    setEditingExpenseId(null);
    setForm(createInitialForm());
    setMutationError(null);
    setShowAmountHelper(false);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    resetForm();
  };

  const handleSubmit = () => {
    if (!form.propertyId) {
      setMutationError('Sélectionne un immeuble.');
      return;
    }

    if (!form.label.trim()) {
      setMutationError('Ajoute un libellé descriptif.');
      return;
    }

    if (!form.category.trim()) {
      setMutationError('Spécifie une catégorie (ex: Taxes, Assurance, Entretien).');
      return;
    }

    if (!Number.isFinite(form.amount) || form.amount <= 0) {
      setMutationError('Indique un montant supérieur à 0.');
      return;
    }

    const payload: ExpensePayload = {
      propertyId: form.propertyId,
      label: form.label.trim(),
      category: form.category.trim(),
      amount: Number(form.amount),
      frequency: form.frequency,
      startDate: form.startDate,
      endDate: form.endDate ? form.endDate : undefined
    };

    const onError = (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'response' in error && error.response
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;

      setMutationError(message ?? 'Enregistrement impossible pour le moment.');
    };

    if (editingExpenseId) {
      updateExpense.mutate(payload, {
        onSuccess: () => {
          setOpen(false);
          resetForm();
        },
        onError
      });
    } else {
      createExpense.mutate(payload, {
        onSuccess: () => {
          setOpen(false);
          resetForm();
        },
        onError
      });
    }
  };

  const handleEdit = (expense: ExpenseDto) => {
    setEditingExpenseId(expense.id);
    setMutationError(null);
    setForm({
      propertyId: expense.propertyId,
      label: expense.label,
      category: expense.category,
      amount: expense.amount,
      frequency: expense.frequency,
      startDate: expense.startDate.slice(0, 10),
      endDate: expense.endDate ? expense.endDate.slice(0, 10) : ''
    });
    setShowAmountHelper(false);
    setOpen(true);
  };

  const handleDelete = (expense: ExpenseDto) => {
    const confirmed = window.confirm(`Supprimer la dépense "${expense.label}" ?`);
    if (!confirmed) {
      return;
    }

    deleteExpense.mutate(expense.id);
  };

  const handleExportFiscal = useCallback(() => {
    setExportMessage(null);
    setExportError(null);

    exportFiscalExpenses.mutate(
      { year: fiscalYear },
      {
        onSuccess: (blob: Blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `nowis-depenses-fiscales-${fiscalYear}.csv`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          setExportMessage(`Export fiscal ${fiscalYear} téléchargé.`);
        },
        onError: (error) => {
          const message =
            error && typeof error === 'object' && 'response' in error && error.response
              ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
              : null;

          console.error('Erreur export fiscal', error);
          setExportError(message ?? 'Export impossible pour le moment.');
        }
      }
    );
  }, [exportFiscalExpenses, fiscalYear]);

  const isSaving = createExpense.isPending || updateExpense.isPending;
  const isExporting = exportFiscalExpenses.isPending;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4">Dépenses déductibles</Typography>
          <Typography variant="body2" color="text.secondary">
            Saisis ici les charges récurrentes (taxes, assurances, services) pour préparer les rapports fiscaux.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
          <TextField
            label="Année fiscale"
            type="number"
            size="small"
            value={fiscalYear}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const rawValue = event.target.value;
              if (rawValue.trim() === '') {
                setFiscalYear(currentYear);
                return;
              }

              const parsed = Number.parseInt(rawValue, 10);
              setFiscalYear(Number.isNaN(parsed) ? currentYear : parsed);
            }}
            inputProps={{ min: 2000, max: 2100 }}
            helperText="Définis l'année visée par ton export CSV"
            sx={{ maxWidth: 150 }}
          />
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportFiscal}
            disabled={isExporting}
          >
            {isExporting ? 'Export...' : 'Export fiscal'}
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setOpen(true);
              setMutationError(null);
              setEditingExpenseId(null);
              setForm((prev) => ({ ...createInitialForm(), propertyId: prev.propertyId }));
              setShowAmountHelper(false);
            }}
          >
            Ajouter une dépense
          </Button>
        </Stack>
      </Stack>

      {exportMessage && (
        <Alert severity="success" onClose={() => setExportMessage(null)} sx={{ mb: 2 }}>
          {exportMessage}
        </Alert>
      )}

      {exportError && (
        <Alert severity="error" onClose={() => setExportError(null)} sx={{ mb: 2 }}>
          {exportError}
        </Alert>
      )}

      {isLoading ? (
        <Typography>Chargement...</Typography>
      ) : expenses && expenses.length > 0 ? (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Immeuble</TableCell>
                <TableCell>Libellé</TableCell>
                <TableCell>Catégorie</TableCell>
                <TableCell>Fréquence</TableCell>
                <TableCell align="right">Montant</TableCell>
                <TableCell>Début</TableCell>
                <TableCell>Fin</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id} hover>
                  <TableCell>{expense.property?.name ?? '—'}</TableCell>
                  <TableCell>{expense.label}</TableCell>
                  <TableCell>{expense.category}</TableCell>
                  <TableCell>
                    {frequencyOptions.find((option) => option.value === expense.frequency)?.label ??
                      expense.frequency}
                  </TableCell>
                  <TableCell align="right">{currencyFormatter.format(expense.amount)}</TableCell>
                  <TableCell>{dayjs(expense.startDate).format('DD MMM YYYY')}</TableCell>
                  <TableCell>
                    {expense.endDate ? dayjs(expense.endDate).format('DD MMM YYYY') : '—'}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton aria-label="modifier" onClick={() => handleEdit(expense)} sx={{ mr: 0.5 }}>
                      <EditIcon />
                    </IconButton>
                    <IconButton aria-label="supprimer" onClick={() => handleDelete(expense)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="subtitle1" gutterBottom>
            Aucune dépense enregistrée pour le moment.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ajoute tes charges courantes pour suivre la rentabilité et préparer les déclarations d&apos;impôts.
          </Typography>
        </Paper>
      )}

      <Dialog open={open} onClose={handleCloseDialog} fullWidth>
        <DialogTitle>{editingExpenseId ? 'Modifier une dépense' : 'Nouvelle dépense'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {mutationError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {mutationError}
            </Alert>
          )}
          <Stack spacing={2}>
            <TextField
              select
              label="Immeuble"
              value={form.propertyId}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, propertyId: Number(event.target.value) }))
              }
              required
            >
              <MenuItem value={0} disabled>
                Sélectionner
              </MenuItem>
              {properties?.map((property) => (
                <MenuItem key={property.id} value={property.id}>
                  {property.name}
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
              label="Catégorie"
              value={form.category}
              helperText={`Exemples : ${expenseCategoryHints.slice(0, 3).join(', ')}...`}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, category: event.target.value }))
              }
              required
            />
            <TextField
              label="Montant"
              type="number"
              value={form.amount}
              inputProps={{ min: 0, step: 0.01 }}
              onFocus={() => setShowAmountHelper(true)}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, amount: Number(event.target.value) }))
              }
              required
            />
            {showAmountHelper && (
              <Alert severity="info">
                Saisis le montant par occurrence. Pour une taxe annuelle, inscris le total annuel; pour une
                dépense mensuelle, inscris le montant du mois.
              </Alert>
            )}
            <TextField
              select
              label="Fréquence"
              value={form.frequency}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, frequency: event.target.value as ExpenseFrequency }))
            }
              required
            >
              {frequencyOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Date de début"
                type="date"
                fullWidth
                value={form.startDate}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setForm((prev) => ({ ...prev, startDate: event.target.value }))
                }
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Date de fin"
                type="date"
                fullWidth
                value={form.endDate ?? ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setForm((prev) => ({ ...prev, endDate: event.target.value }))
                }
                InputLabelProps={{ shrink: true }}
                helperText="Optionnel"
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Annuler</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={isSaving}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ExpensesScreen;
