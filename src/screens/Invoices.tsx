import { useMemo, useState, type ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  IconButton
} from '@mui/material';
import dayjs from 'dayjs';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

import { apiClient } from '../api/client';
import { usePropertyOptions, type PropertyOption } from '../api/properties';

interface InvoicePayload {
  propertyId: number;
  invoiceDate: string;
  supplier: string;
  amount: number;
  category: string;
  gst?: number | null;
  qst?: number | null;
  description?: string;
}

interface InvoiceDto extends InvoicePayload {
  id: number;
  property: { name: string };
}

function useInvoiceData() {
  return useQuery<InvoiceDto[]>({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data } = await apiClient.get<InvoiceDto[]>('/invoices');
      return data;
    }
  });
}

const initialFormState = (): InvoicePayload => ({
  propertyId: 0,
  invoiceDate: dayjs().format('YYYY-MM-DD'),
  supplier: '',
  amount: 0,
  category: '',
  gst: null,
  qst: null,
  description: ''
});

function InvoicesScreen() {
  const queryClient = useQueryClient();
  const { data: invoices, isLoading } = useInvoiceData();
  const { data: properties } = usePropertyOptions();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<InvoicePayload>(initialFormState());
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<number | null>(null);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat('fr-CA', {
        style: 'currency',
        currency: 'CAD'
      }),
    []
  );

  const createMutation = useMutation({
    mutationFn: (payload: InvoicePayload) => apiClient.post('/invoices', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      setOpen(false);
      setMutationError(null);
      setTableError(null);
      setEditingInvoiceId(null);
      setForm(initialFormState());
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'response' in error && error.response
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setMutationError(message ?? "Impossible d'enregistrer la facture. Réessaie.");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: InvoicePayload }) =>
      apiClient.put(`/invoices/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      setOpen(false);
      setMutationError(null);
      setTableError(null);
      setEditingInvoiceId(null);
      setForm(initialFormState());
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'response' in error && error.response
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setMutationError(message ?? "Impossible de mettre à jour la facture.");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      setTableError(null);
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'response' in error && error.response
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setTableError(message ?? 'Impossible de supprimer la facture pour le moment.');
    },
    onSettled: () => {
      setDeletingInvoiceId(null);
    }
  });

  const totalTtc = useMemo(() => {
    const gst = form.gst ?? 0;
    const qst = form.qst ?? 0;
    return form.amount + gst + qst;
  }, [form.amount, form.gst, form.qst]);

  const handleOpenCreate = () => {
    setForm(initialFormState());
    setEditingInvoiceId(null);
    setMutationError(null);
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setMutationError(null);
    setEditingInvoiceId(null);
    setForm(initialFormState());
  };

  const handleEditInvoice = (invoice: InvoiceDto) => {
    setTableError(null);
    setMutationError(null);
    setEditingInvoiceId(invoice.id);
    setForm({
      propertyId: invoice.propertyId,
      invoiceDate: dayjs(invoice.invoiceDate).format('YYYY-MM-DD'),
      supplier: invoice.supplier,
      amount: invoice.amount,
      category: invoice.category,
      gst: invoice.gst ?? null,
      qst: invoice.qst ?? null,
      description: invoice.description ?? ''
    });
    setOpen(true);
  };

  const handleDeleteInvoice = (invoice: InvoiceDto) => {
    setTableError(null);
    const confirmed = window.confirm('Supprimer cette facture définitivement ?');
    if (!confirmed) {
      return;
    }
    setDeletingInvoiceId(invoice.id);
    deleteMutation.mutate(invoice.id);
  };

  const handleSubmit = () => {
    if (!form.propertyId) {
      setMutationError('Sélectionnez un immeuble.');
      return;
    }

    if (!form.supplier.trim()) {
      setMutationError('Le fournisseur est requis.');
      return;
    }

    if (!form.category.trim()) {
      setMutationError('La catégorie est requise.');
      return;
    }

    if (!Number.isFinite(form.amount) || form.amount <= 0) {
      setMutationError('Indiquez un montant valide.');
      return;
    }

    const payload: InvoicePayload = {
      ...form,
      gst: form.gst ?? undefined,
      qst: form.qst ?? undefined,
      description: form.description?.trim() ? form.description.trim() : undefined
    };

    if (editingInvoiceId) {
      updateMutation.mutate({ id: editingInvoiceId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Factures</Typography>
        <Button variant="contained" onClick={handleOpenCreate}>
          Ajouter une facture
        </Button>
      </Stack>

      {tableError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {tableError}
        </Alert>
      )}

      {isLoading ? (
        <Typography>Chargement...</Typography>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Immeuble</TableCell>
              <TableCell>Fournisseur</TableCell>
              <TableCell>Catégorie</TableCell>
              <TableCell align="right">Montant (HT)</TableCell>
              <TableCell align="right">Taxes</TableCell>
              <TableCell align="right">Total TTC</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices?.map((invoice: InvoiceDto) => (
              <TableRow key={invoice.id}>
                <TableCell>{dayjs(invoice.invoiceDate).format('DD MMM YYYY')}</TableCell>
                <TableCell>{invoice.property?.name ?? '—'}</TableCell>
                <TableCell>{invoice.supplier}</TableCell>
                <TableCell>{invoice.category}</TableCell>
                <TableCell align="right">{formatter.format(invoice.amount)}</TableCell>
                <TableCell align="right">
                  {formatter.format((invoice.gst ?? 0) + (invoice.qst ?? 0))}
                </TableCell>
                <TableCell align="right">
                  {formatter.format(invoice.amount + (invoice.gst ?? 0) + (invoice.qst ?? 0))}
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <IconButton
                      aria-label="modifier"
                      size="small"
                      onClick={() => handleEditInvoice(invoice)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      aria-label="supprimer"
                      size="small"
                      color="error"
                      onClick={() => handleDeleteInvoice(invoice)}
                      disabled={deleteMutation.isPending && deletingInvoiceId === invoice.id}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onClose={handleCloseDialog} fullWidth>
        <DialogTitle>{editingInvoiceId ? 'Modifier la facture' : 'Nouvelle facture'}</DialogTitle>
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
                setForm((prev: InvoicePayload) => ({
                  ...prev,
                  propertyId: Number(event.target.value)
                }))
              }
              required
            >
              <MenuItem value={0} disabled>
                Sélectionner
              </MenuItem>
              {properties?.map((property: PropertyOption) => (
                <MenuItem key={property.id} value={property.id}>
                  {property.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Date"
              type="date"
              value={form.invoiceDate}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((prev: InvoicePayload) => ({ ...prev, invoiceDate: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Fournisseur"
              value={form.supplier}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((prev: InvoicePayload) => ({ ...prev, supplier: event.target.value }))
              }
              required
            />
            <TextField
              label="Catégorie"
              value={form.category}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((prev: InvoicePayload) => ({ ...prev, category: event.target.value }))
              }
              required
            />
            <TextField
              label="Montant"
              type="number"
              value={form.amount}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((prev: InvoicePayload) => ({
                  ...prev,
                  amount: Number(event.target.value)
                }))
              }
              required
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="TPS (5 %)"
                type="number"
                fullWidth
                value={form.gst ?? ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setForm((prev: InvoicePayload) => ({
                    ...prev,
                    gst: event.target.value === '' ? null : Number(event.target.value)
                  }))
                }
                helperText="Optionnel"
              />
              <TextField
                label="TVQ (9,975 %)"
                type="number"
                fullWidth
                value={form.qst ?? ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setForm((prev: InvoicePayload) => ({
                    ...prev,
                    qst: event.target.value === '' ? null : Number(event.target.value)
                  }))
                }
                helperText="Optionnel"
              />
            </Stack>
            <TextField
              label="Total TTC"
              value={formatter.format(totalTtc)}
              InputProps={{ readOnly: true }}
            />
            <TextField
              label="Description"
              multiline
              minRows={3}
              value={form.description ?? ''}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setForm((prev: InvoicePayload) => ({ ...prev, description: event.target.value }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={isSaving}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} variant="contained" disabled={isSaving}>
            {editingInvoiceId ? 'Mettre à jour' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default InvoicesScreen;
