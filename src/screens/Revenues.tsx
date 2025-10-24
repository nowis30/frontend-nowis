import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
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
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import dayjs from 'dayjs';

import {
  useCreateRevenue,
  useDeleteRevenue,
  useRevenues,
  useUpdateRevenue,
  useImportRevenues,
  type RevenueDto,
  type RevenueFrequency,
  type RevenuePayload,
  type RevenueImportResult
} from '../api/revenues';
import { usePropertyOptions } from '../api/properties';

const frequencyOptions: Array<{ value: RevenueFrequency; label: string }> = [
  { value: 'PONCTUEL', label: 'Ponctuel' },
  { value: 'HEBDOMADAIRE', label: 'Hebdomadaire' },
  { value: 'MENSUEL', label: 'Mensuel' },
  { value: 'TRIMESTRIEL', label: 'Trimestriel' },
  { value: 'ANNUEL', label: 'Annuel' }
];

interface RevenueFormState {
  propertyId: number;
  label: string;
  amount: number;
  frequency: RevenueFrequency;
  startDate: string;
  endDate?: string;
}

const createInitialForm = (propertyId = 0): RevenueFormState => ({
  propertyId,
  label: '',
  amount: 0,
  frequency: 'MENSUEL',
  startDate: dayjs().format('YYYY-MM-DD'),
  endDate: ''
});

function RevenuesScreen() {
  const [selectedPropertyId, setSelectedPropertyId] = useState<number>(0);
  const propertyIdForQuery = selectedPropertyId === 0 ? null : selectedPropertyId;
  const { data: revenues, isLoading } = useRevenues(propertyIdForQuery);
  const { data: properties } = usePropertyOptions();
  const createRevenue = useCreateRevenue();
  const deleteRevenue = useDeleteRevenue();
  const [editingRevenueId, setEditingRevenueId] = useState<number | null>(null);
  const updateRevenue = useUpdateRevenue(editingRevenueId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RevenueFormState>(createInitialForm());
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [showAmountHelper, setShowAmountHelper] = useState(false);
  const importRevenues = useImportRevenues();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<RevenueImportResult | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('fr-CA', {
        style: 'currency',
        currency: 'CAD'
      }),
    []
  );

  useEffect(() => {
    if (!open || editingRevenueId || !properties || properties.length === 0) {
      return;
    }

    setForm((prev) => {
      if (prev.propertyId) {
        return prev;
      }

      const preferredId =
        (selectedPropertyId && properties.some((property) => property.id === selectedPropertyId)
          ? selectedPropertyId
          : undefined) ?? properties[0].id;

      return { ...prev, propertyId: preferredId };
    });
  }, [editingRevenueId, open, properties, selectedPropertyId]);

  const resetForm = () => {
    setEditingRevenueId(null);
    setMutationError(null);
    setShowAmountHelper(false);
    setForm(createInitialForm(selectedPropertyId));
  };

  const handleCloseDialog = () => {
    setOpen(false);
    resetForm();
  };

  const handleCloseImportDialog = () => {
    setImportDialogOpen(false);
    setImportFile(null);
    setImportError(null);
    setImportResult(null);
    setFileInputKey((prev) => prev + 1);
  };

  const handleSubmit = () => {
    if (!form.propertyId) {
      setMutationError('Sélectionne un immeuble.');
      return;
    }

    if (!form.label.trim()) {
      setMutationError('Ajoute un libellé (ex: Loyers 4½, Stationnement).');
      return;
    }

    if (!Number.isFinite(form.amount) || form.amount <= 0) {
      setMutationError('Indique un montant supérieur à 0.');
      return;
    }

    const payload: RevenuePayload = {
      propertyId: form.propertyId,
      label: form.label.trim(),
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

    if (editingRevenueId) {
      updateRevenue.mutate(payload, {
        onSuccess: () => {
          setOpen(false);
          resetForm();
        },
        onError
      });
    } else {
      createRevenue.mutate(payload, {
        onSuccess: () => {
          setOpen(false);
          resetForm();
        },
        onError
      });
    }
  };

  const handleEdit = (revenue: RevenueDto) => {
    setEditingRevenueId(revenue.id);
    setMutationError(null);
    setForm({
      propertyId: revenue.propertyId,
      label: revenue.label,
      amount: revenue.amount,
      frequency: revenue.frequency,
      startDate: revenue.startDate.slice(0, 10),
      endDate: revenue.endDate ? revenue.endDate.slice(0, 10) : ''
    });
    setShowAmountHelper(false);
    setOpen(true);
  };

  const handleDelete = (revenue: RevenueDto) => {
    const confirmed = window.confirm(`Supprimer le revenu "${revenue.label}" ?`);
    if (!confirmed) {
      return;
    }

    deleteRevenue.mutate(revenue.id);
  };

  const handleImportFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setImportFile(file);
    setImportError(null);
    setImportResult(null);

    if (event.target) {
      event.target.value = '';
    }
  };

  const handleImportSubmit = () => {
    if (!importFile) {
      setImportError('Choisis un fichier CSV.');
      return;
    }

    importRevenues.mutate(importFile, {
      onSuccess: (data) => {
        setImportResult(data);
        setImportError(null);
        setImportFile(null);
        setFileInputKey((prev) => prev + 1);
      },
      onError: (error) => {
        const message =
          error && typeof error === 'object' && 'response' in error && error.response
            ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
            : null;

        setImportError(message ?? 'Import impossible pour le moment.');
      }
    });
  };

  const isSaving = createRevenue.isPending || updateRevenue.isPending;
  const isImporting = importRevenues.isPending;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4">Revenus locatifs</Typography>
          <Typography variant="body2" color="text.secondary">
            Inscris ici les loyers et autres revenus imposables rattachés à tes immeubles.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
          <TextField
            select
            size="small"
            label="Filtrer par immeuble"
            value={selectedPropertyId}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setSelectedPropertyId(Number(event.target.value))
            }
            sx={{ minWidth: 180 }}
          >
            <MenuItem value={0}>Tous les immeubles</MenuItem>
            {properties?.map((property) => (
              <MenuItem key={property.id} value={property.id}>
                {property.name}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            onClick={() => {
              setImportDialogOpen(true);
              setImportError(null);
              setImportResult(null);
            }}
          >
            Importer CSV
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              const defaultPropertyId =
                selectedPropertyId || (properties && properties.length > 0 ? properties[0].id : 0);
              setOpen(true);
              setMutationError(null);
              setEditingRevenueId(null);
              setForm(createInitialForm(defaultPropertyId));
              setShowAmountHelper(false);
            }}
          >
            Ajouter un revenu
          </Button>
        </Stack>
      </Stack>

      {isLoading ? (
        <Typography>Chargement...</Typography>
      ) : revenues && revenues.length > 0 ? (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Immeuble</TableCell>
                <TableCell>Libellé</TableCell>
                <TableCell>Fréquence</TableCell>
                <TableCell align="right">Montant</TableCell>
                <TableCell>Début</TableCell>
                <TableCell>Fin</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {revenues.map((revenue) => (
                <TableRow key={revenue.id} hover>
                  <TableCell>{revenue.property?.name ?? '—'}</TableCell>
                  <TableCell>{revenue.label}</TableCell>
                  <TableCell>
                    {frequencyOptions.find((option) => option.value === revenue.frequency)?.label ??
                      revenue.frequency}
                  </TableCell>
                  <TableCell align="right">{currencyFormatter.format(revenue.amount)}</TableCell>
                  <TableCell>{dayjs(revenue.startDate).format('DD MMM YYYY')}</TableCell>
                  <TableCell>
                    {revenue.endDate ? dayjs(revenue.endDate).format('DD MMM YYYY') : '—'}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton aria-label="modifier" onClick={() => handleEdit(revenue)} sx={{ mr: 0.5 }}>
                      <EditIcon />
                    </IconButton>
                    <IconButton aria-label="supprimer" onClick={() => handleDelete(revenue)}>
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
            {selectedPropertyId
              ? 'Aucun revenu enregistré pour cet immeuble.'
              : 'Aucun revenu enregistré pour le moment.'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ajoute les loyers, stationnements ou revenus auxiliaires pour suivre tes déclarations d&apos;impôts.
          </Typography>
        </Paper>
      )}

      <Dialog open={open} onClose={handleCloseDialog} fullWidth>
        <DialogTitle>{editingRevenueId ? 'Modifier un revenu' : 'Nouveau revenu'}</DialogTitle>
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
              placeholder="Ex: Loyer unité 201"
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, label: event.target.value }))
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
                Indique le montant par occurrence. Pour un loyer mensuel, inscris le montant du mois; pour un
                revenu ponctuel, inscris le montant total.
              </Alert>
            )}
            <TextField
              select
              label="Fréquence"
              value={form.frequency}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, frequency: event.target.value as RevenueFrequency }))
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

      <Dialog open={importDialogOpen} onClose={handleCloseImportDialog} fullWidth>
        <DialogTitle>Importer des revenus</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Alert severity="info">
              Le fichier doit contenir les colonnes : propertyId ou propertyName, label, amount, frequency,
              startDate, endDate.
            </Alert>
            {importError && <Alert severity="error">{importError}</Alert>}
            {importResult && (
              <Stack spacing={2}>
                <Alert severity="success">{importResult.inserted} revenu(s) importé(s).</Alert>
                {importResult.errors.length > 0 && (
                  <Alert severity="warning">
                    {importResult.errors.length} ligne(s) ignorée(s).
                    <Box component="ul" sx={{ mt: 1, pl: 3 }}>
                      {importResult.errors.slice(0, 5).map((error) => (
                        <li key={error.line}>
                          <Typography variant="body2">
                            Ligne {error.line}: {error.message}
                          </Typography>
                        </li>
                      ))}
                    </Box>
                    {importResult.errors.length > 5 && (
                      <Typography variant="caption" color="text.secondary">
                        ... {importResult.errors.length - 5} ligne(s) supplémentaire(s).
                      </Typography>
                    )}
                  </Alert>
                )}
              </Stack>
            )}
            <Box>
              <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
                Choisir un fichier CSV
                <input
                  key={fileInputKey}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={handleImportFileChange}
                />
              </Button>
              {importFile && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Fichier sélectionné : {importFile.name}
                </Typography>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseImportDialog} disabled={isImporting}>
            Fermer
          </Button>
          <Button onClick={handleImportSubmit} variant="contained" disabled={isImporting}>
            Importer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default RevenuesScreen;
