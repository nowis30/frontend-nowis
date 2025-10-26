import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
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
  Snackbar
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import type { SelectChangeEvent } from '@mui/material/Select';

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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h4">Valeur et rachats d’actions familiales</Typography>
        <Typography variant="body2" color="text.secondary">
          Suivez la valeur nette des sociétés familiales, préparez les rachats d’actions et partagez des rapports clairs avec chaque membre.
        </Typography>
      </Box>

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
