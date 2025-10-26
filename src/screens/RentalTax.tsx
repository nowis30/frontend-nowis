import { ChangeEvent, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
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
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  InputAdornment
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { useMutation } from '@tanstack/react-query';
import type { SelectChangeEvent } from '@mui/material/Select';

import { usePropertyOptions } from '../api/properties';
import {
  downloadRentalTaxPdf,
  prepareRentalTaxStatement,
  useCreateRentalTaxStatement,
  useRentalTaxStatements,
  type RentalTaxCreatePayload,
  type RentalTaxCcaLine,
  type RentalTaxFormPayload,
  type RentalTaxFormType,
  type RentalTaxPreparePayload,
  type RentalTaxStatementDto,
  type RentalTaxMetadataField,
  type RentalTaxMetadataFieldType
} from '../api/rentalTax';
import { downloadBlob } from '../utils/download';

function getInitialPreparePayload(): RentalTaxPreparePayload {
  const now = new Date();
  return {
    taxYear: now.getFullYear() - 1,
    formType: 'T776',
    propertyId: null
  } satisfies RentalTaxPreparePayload;
}

function normalizeNumber(value: string | number): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function recalculatePayload(payload: RentalTaxFormPayload): RentalTaxFormPayload {
  const grossRents = normalizeNumber(payload.income.grossRents);
  const otherIncome = normalizeNumber(payload.income.otherIncome);
  const totalIncome = grossRents + otherIncome;

  const expenses = payload.expenses.map((line) => ({
    ...line,
    amount: normalizeNumber(line.amount)
  }));
  const totalExpenses = expenses.reduce((sum, line) => sum + line.amount, 0);
  const netIncome = totalIncome - totalExpenses;

  return {
    income: {
      grossRents,
      otherIncome,
      totalIncome
    },
    expenses,
    totals: {
      totalExpenses,
      netIncome
    }
  } satisfies RentalTaxFormPayload;
}

function RentalTaxScreen() {
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('fr-CA', {
        style: 'currency',
        currency: 'CAD'
      }),
    []
  );
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat('fr-CA'), []);

  const { data: propertyOptions } = usePropertyOptions();
  const { data: statements, isLoading } = useRentalTaxStatements();

  const prepareMutation = useMutation({
    mutationFn: prepareRentalTaxStatement
  });
  const createMutation = useCreateRentalTaxStatement();
  const downloadMutation = useMutation({
    mutationFn: async (statement: RentalTaxStatementDto) => {
      const blob = await downloadRentalTaxPdf(statement.id);
      const filename = `${statement.formType}-${statement.taxYear}.pdf`;
      downloadBlob(blob, filename);
    }
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [preparePayload, setPreparePayload] = useState<RentalTaxPreparePayload>(getInitialPreparePayload);
  const [preparedNotes, setPreparedNotes] = useState('');
  const [preparedPayload, setPreparedPayload] = useState<RentalTaxFormPayload | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const preparedResponse = prepareMutation.data ?? null;

  const handleOpenDialog = () => {
    setDialogOpen(true);
    setPreparePayload(getInitialPreparePayload());
    setPreparedPayload(null);
    setPreparedNotes('');
    setFormError(null);
    prepareMutation.reset();
  };

  const handleCloseDialog = () => {
    if (createMutation.isPending || prepareMutation.isPending) {
      return;
    }
    setDialogOpen(false);
  };

  const handlePrepare = () => {
    setFormError(null);
    setPreparedPayload(null);
    setPreparedNotes('');
    prepareMutation.mutate(preparePayload, {
      onSuccess: (result) => {
        setFormError(null);
        setPreparedPayload(recalculatePayload(result.payloadTemplate));
        setPreparedNotes(result.previous?.notes ?? '');
      },
      onError: (error: unknown) => {
        setPreparedPayload(null);
        setPreparedNotes('');
        const message =
          error && typeof error === 'object' && 'response' in error && error.response
            ? ((error as { response?: { data?: { error?: string } } }).response?.data?.error ?? null)
            : null;
        setFormError(message ?? 'Impossible de préparer le formulaire pour le moment.');
      }
    });
  };

  const handleSave = () => {
    if (!preparedResponse || !preparedPayload) {
      setFormError('Prépare d\'abord le formulaire avant de l\'enregistrer.');
      return;
    }

    const payload: RentalTaxCreatePayload = {
      taxYear: preparePayload.taxYear,
      formType: preparePayload.formType,
      propertyId: preparePayload.propertyId ?? null,
      payload: preparedPayload,
      notes: preparedNotes.trim().length > 0 ? preparedNotes.trim() : undefined
    };

    setFormError(null);
    createMutation.mutate(payload, {
      onSuccess: () => {
        setDialogOpen(false);
      },
      onError: (error: unknown) => {
        const message =
          error && typeof error === 'object' && 'response' in error && error.response
            ? ((error as { response?: { data?: { error?: string } } }).response?.data?.error ?? null)
            : null;
        setFormError(message ?? "Impossible d'enregistrer le formulaire.");
      }
    });
  };

  const handleIncomeChange = (field: 'grossRents' | 'otherIncome') =>
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!preparedPayload) {
        return;
      }
      const value = normalizeNumber(event.target.value);
      const updated = recalculatePayload({
        ...preparedPayload,
        income: {
          ...preparedPayload.income,
          [field]: value
        }
      });
      setPreparedPayload(updated);
    };

  const handleExpenseChange = (index: number) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!preparedPayload) {
        return;
      }
      const value = normalizeNumber(event.target.value);
      const updated = recalculatePayload({
        ...preparedPayload,
        expenses: preparedPayload.expenses.map((line, lineIndex) =>
          lineIndex === index
            ? {
                ...line,
                amount: value
              }
            : line
        )
      });
      setPreparedPayload(updated);
    };

  const handleExpenseDescriptionChange = (index: number) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!preparedPayload) {
        return;
      }
      const value = event.target.value;
      setPreparedPayload((prev) => {
        if (!prev) {
          return prev;
        }
        const updated = recalculatePayload({
          ...prev,
          expenses: prev.expenses.map((line, lineIndex) =>
            lineIndex === index
              ? {
                  ...line,
                  description: value.trim().length === 0 ? null : value
                }
              : line
          )
        });
        return updated;
      });
    };

  const handleMetadataChange = (key: string, fieldType?: RentalTaxMetadataFieldType) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!preparedPayload?.metadata) {
        return;
      }
      const rawValue = event.target.value;
      let value: string | number | null = rawValue;

      if (fieldType === 'number' || fieldType === 'percentage') {
        const trimmed = rawValue.trim();
        if (trimmed === '') {
          value = null;
        } else {
          const parsed = Number(trimmed);
          value = Number.isFinite(parsed) ? parsed : null;
        }
      }

      setPreparedPayload((prev) => {
        if (!prev?.metadata) {
          return prev;
        }
        return {
          ...prev,
          metadata: prev.metadata.map((field) =>
            field.key === key
              ? {
                  ...field,
                  value
                }
              : field
          )
        };
      });
    };

  const handleCcaNumberChange = (index: number, field: keyof Pick<RentalTaxCcaLine, 'ccaRate' | 'openingBalance' | 'additions' | 'dispositions' | 'baseForCca' | 'ccaAmount' | 'closingBalance'>) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const rawValue = event.target.value;
      setPreparedPayload((prev) => {
        if (!prev?.cca) {
          return prev;
        }
        const trimmed = rawValue.trim();
        const parsed = trimmed === '' ? null : Number(trimmed);
        const value = parsed === null ? null : Number.isFinite(parsed) ? parsed : prev.cca[index]?.[field] ?? null;
        const updatedCca = prev.cca.map((line, lineIndex) =>
          lineIndex === index
            ? {
                ...line,
                [field]: value
              }
            : line
        );
        return {
          ...prev,
          cca: updatedCca
        };
      });
    };

  const handleCcaTextChange = (index: number, field: keyof Pick<RentalTaxCcaLine, 'classNumber' | 'description'>) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setPreparedPayload((prev) => {
        if (!prev?.cca) {
          return prev;
        }
        const updatedCca = prev.cca.map((line, lineIndex) =>
          lineIndex === index
            ? {
                ...line,
                [field]: value.trim().length === 0 ? null : value
              }
            : line
        );
        return {
          ...prev,
          cca: updatedCca
        };
      });
    };

  const formatCurrency = (value?: number | null) =>
    typeof value === 'number' && Number.isFinite(value) ? currencyFormatter.format(value) : '—';

  const formatDate = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
  };

  const handlePropertyChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    setPreparePayload((prev) => ({
      ...prev,
      propertyId: value === '' ? null : Number(value)
    }));
  };

  const handleTaxYearChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(event.target.value);
    setPreparePayload((prev) => ({
      ...prev,
      taxYear: Number.isFinite(parsed) ? parsed : prev.taxYear
    }));
  };

  const handleFormTypeChange = (event: SelectChangeEvent<RentalTaxFormType>) => {
    setPreparePayload((prev) => ({
      ...prev,
      formType: event.target.value as RentalTaxFormType
    }));
  };

  const previousStatement = preparedResponse?.previous ?? null;
  const isPreparing = prepareMutation.isPending;
  const isSaving = createMutation.isPending;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Fiscalité locative</Typography>
        <Button variant="contained" onClick={handleOpenDialog}>
          Préparer un formulaire
        </Button>
      </Box>
      <Paper sx={{ p: 2 }}>
        {isLoading ? (
          <LinearProgress />
        ) : (statements?.length ?? 0) === 0 ? (
          <Typography>Aucun formulaire enregistré pour l'instant.</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Année</TableCell>
                  <TableCell>Formulaire</TableCell>
                  <TableCell>Immeuble</TableCell>
                  <TableCell align="right">Revenu net</TableCell>
                  <TableCell align="right">Créé le</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {statements?.map((statement) => (
                  <TableRow key={statement.id} hover>
                    <TableCell>{statement.taxYear}</TableCell>
                    <TableCell>{statement.formType}</TableCell>
                    <TableCell>{statement.propertyName ?? 'Portefeuille complet'}</TableCell>
                    <TableCell align="right">{formatCurrency(statement.computed.netIncome)}</TableCell>
                    <TableCell align="right">{formatDate(statement.createdAt)}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        edge="end"
                        aria-label="Télécharger"
                        onClick={() => downloadMutation.mutate(statement)}
                        disabled={downloadMutation.isPending}
                      >
                        <DownloadIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {downloadMutation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Impossible de télécharger le PDF pour le moment.
          </Alert>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="md">
        <DialogTitle>Préparer un formulaire locatif</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            {formError && (
              <Alert severity="error">{formError}</Alert>
            )}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Année fiscale"
                  type="number"
                  fullWidth
                  value={preparePayload.taxYear}
                  onChange={handleTaxYearChange}
                  disabled={isPreparing || isSaving}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth disabled={isPreparing || isSaving}>
                  <InputLabel id="rental-tax-form-type-label">Formulaire</InputLabel>
                  <Select
                    labelId="rental-tax-form-type-label"
                    label="Formulaire"
                    value={preparePayload.formType}
                    onChange={handleFormTypeChange}
                  >
                    <MenuItem value="T776">T776 – Activités de location</MenuItem>
                    <MenuItem value="TP128">TP-128 – Revenus de location</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth disabled={isPreparing || isSaving}>
                  <InputLabel id="rental-tax-property-label">Immeuble</InputLabel>
                  <Select
                    labelId="rental-tax-property-label"
                    label="Immeuble"
                    value={
                      preparePayload.propertyId !== null && preparePayload.propertyId !== undefined
                        ? String(preparePayload.propertyId)
                        : ''
                    }
                    onChange={handlePropertyChange}
                  >
                    <MenuItem value="">Portefeuille complet</MenuItem>
                    {propertyOptions?.map((property) => (
                      <MenuItem key={property.id} value={String(property.id)}>
                        {property.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Box>
              <Button
                variant="outlined"
                onClick={handlePrepare}
                disabled={isPreparing || isSaving}
              >
                Préparer automatiquement
              </Button>
              {isPreparing && <LinearProgress sx={{ mt: 1 }} />}
            </Box>

            {preparedResponse && preparedPayload && (
              <Stack spacing={2}>
                <Alert severity="info">
                  Calcul net estimé : <strong>{formatCurrency(preparedPayload.totals.netIncome)}</strong>
                </Alert>
                {previousStatement && (
                  <Alert severity="warning">
                    Un formulaire {previousStatement.formType} existe déjà pour {previousStatement.taxYear}.
                  </Alert>
                )}
                {preparedPayload.metadata?.length ? (
                  <>
                    <Divider textAlign="left">Informations du formulaire</Divider>
                    <Grid container spacing={2}>
                      {preparedPayload.metadata.map((field: RentalTaxMetadataField) => {
                        const helperParts = [] as string[];
                        if (field.lineNumber) {
                          helperParts.push(`Ligne ${field.lineNumber}`);
                        }
                        if (field.hint) {
                          helperParts.push(field.hint);
                        }
                        const helperText = helperParts.length > 0 ? helperParts.join(' · ') : undefined;
                        const isTextArea = field.type === 'textarea';
                        const isNumber = field.type === 'number' || field.type === 'percentage';
                        const isDate = field.type === 'date';
                        const value = field.value ?? '';
                        return (
                          <Grid item xs={12} sm={isTextArea ? 12 : 6} key={field.key}>
                            <TextField
                              label={field.label}
                              fullWidth
                              value={value}
                              onChange={handleMetadataChange(field.key, field.type)}
                              disabled={isSaving}
                              type={isNumber ? 'number' : isDate ? 'date' : 'text'}
                              multiline={isTextArea}
                              minRows={isTextArea ? 3 : undefined}
                              helperText={helperText}
                              InputLabelProps={isDate ? { shrink: true } : undefined}
                              InputProps={
                                field.type === 'percentage'
                                  ? {
                                      endAdornment: <InputAdornment position="end">%</InputAdornment>
                                    }
                                  : undefined
                              }
                            />
                          </Grid>
                        );
                      })}
                    </Grid>
                  </>
                ) : null}
                <Divider textAlign="left">Revenus</Divider>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label={preparedPayload.incomeLabels?.grossRents ?? 'Loyers bruts'}
                      type="number"
                      fullWidth
                      value={preparedPayload.income.grossRents}
                      onChange={handleIncomeChange('grossRents')}
                      disabled={isSaving}
                      helperText={
                        preparedPayload.incomeLabels?.grossRentsLine
                          ? `Ligne ${preparedPayload.incomeLabels.grossRentsLine}`
                          : undefined
                      }
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label={preparedPayload.incomeLabels?.otherIncome ?? 'Autres revenus'}
                      type="number"
                      fullWidth
                      value={preparedPayload.income.otherIncome}
                      onChange={handleIncomeChange('otherIncome')}
                      disabled={isSaving}
                      helperText={
                        preparedPayload.incomeLabels?.otherIncomeLine
                          ? `Ligne ${preparedPayload.incomeLabels.otherIncomeLine}`
                          : undefined
                      }
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label={preparedPayload.incomeLabels?.totalIncome ?? 'Revenus totaux'}
                      type="number"
                      fullWidth
                      value={preparedPayload.income.totalIncome}
                      disabled
                      helperText={
                        preparedPayload.incomeLabels?.totalIncomeLine
                          ? `Ligne ${preparedPayload.incomeLabels.totalIncomeLine}`
                          : undefined
                      }
                    />
                  </Grid>
                </Grid>
                <Divider textAlign="left">Dépenses</Divider>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Poste</TableCell>
                        <TableCell align="right">Montant</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {preparedPayload.expenses.map((expense, index) => (
                        <TableRow key={expense.key}>
                          <TableCell>
                            <Stack spacing={0.5}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {expense.label}
                              </Typography>
                              {expense.lineNumber && (
                                <Typography variant="caption" color="text.secondary">
                                  Ligne {expense.lineNumber}
                                </Typography>
                              )}
                              {expense.category && (
                                <Typography variant="caption" color="text.secondary">
                                  {expense.category}
                                </Typography>
                              )}
                              {expense.hint && (
                                <Typography variant="caption" color="text.secondary">
                                  {expense.hint}
                                </Typography>
                              )}
                            </Stack>
                            {(expense.key === 'other' || (expense.description ?? '') !== '') && (
                              <TextField
                                value={expense.description ?? ''}
                                onChange={handleExpenseDescriptionChange(index)}
                                placeholder="Détail / ventilation"
                                size="small"
                                multiline
                                minRows={1}
                                disabled={isSaving}
                                sx={{ mt: 1, maxWidth: 360 }}
                              />
                            )}
                          </TableCell>
                          <TableCell align="right" width={160}>
                            <TextField
                              type="number"
                              value={expense.amount}
                              onChange={handleExpenseChange(index)}
                              size="small"
                              disabled={isSaving}
                              inputProps={{ min: 0, step: 0.01 }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Total des dépenses</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {formatCurrency(preparedPayload.totals.totalExpenses)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
                {preparedPayload.cca?.length ? (
                  <>
                    <Divider textAlign="left">Amortissement (CCA)</Divider>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Classe</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell align="right">Taux (%)</TableCell>
                            <TableCell align="right">Solde ouverture</TableCell>
                            <TableCell align="right">Additions</TableCell>
                            <TableCell align="right">Dispositions</TableCell>
                            <TableCell align="right">Base admissible</TableCell>
                            <TableCell align="right">CCA</TableCell>
                            <TableCell align="right">Solde clôture</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {preparedPayload.cca.map((line: RentalTaxCcaLine, index: number) => (
                            <TableRow key={line.key}>
                              <TableCell width={140}>
                                <TextField
                                  value={line.classNumber ?? ''}
                                  onChange={handleCcaTextChange(index, 'classNumber')}
                                  size="small"
                                  disabled={isSaving}
                                />
                              </TableCell>
                              <TableCell>
                                <TextField
                                  value={line.description ?? ''}
                                  onChange={handleCcaTextChange(index, 'description')}
                                  size="small"
                                  fullWidth
                                  disabled={isSaving}
                                />
                              </TableCell>
                              <TableCell align="right" width={140}>
                                <TextField
                                  type="number"
                                  size="small"
                                  value={line.ccaRate ?? ''}
                                  onChange={handleCcaNumberChange(index, 'ccaRate')}
                                  disabled={isSaving}
                                  inputProps={{ step: 0.01 }}
                                />
                              </TableCell>
                              <TableCell align="right" width={160}>
                                <TextField
                                  type="number"
                                  size="small"
                                  value={line.openingBalance ?? ''}
                                  onChange={handleCcaNumberChange(index, 'openingBalance')}
                                  disabled={isSaving}
                                  inputProps={{ step: 0.01 }}
                                />
                              </TableCell>
                              <TableCell align="right" width={160}>
                                <TextField
                                  type="number"
                                  size="small"
                                  value={line.additions ?? ''}
                                  onChange={handleCcaNumberChange(index, 'additions')}
                                  disabled={isSaving}
                                  inputProps={{ step: 0.01 }}
                                />
                              </TableCell>
                              <TableCell align="right" width={160}>
                                <TextField
                                  type="number"
                                  size="small"
                                  value={line.dispositions ?? ''}
                                  onChange={handleCcaNumberChange(index, 'dispositions')}
                                  disabled={isSaving}
                                  inputProps={{ step: 0.01 }}
                                />
                              </TableCell>
                              <TableCell align="right" width={180}>
                                <TextField
                                  type="number"
                                  size="small"
                                  value={line.baseForCca ?? ''}
                                  onChange={handleCcaNumberChange(index, 'baseForCca')}
                                  disabled={isSaving}
                                  inputProps={{ step: 0.01 }}
                                />
                              </TableCell>
                              <TableCell align="right" width={160}>
                                <TextField
                                  type="number"
                                  size="small"
                                  value={line.ccaAmount ?? ''}
                                  onChange={handleCcaNumberChange(index, 'ccaAmount')}
                                  disabled={isSaving}
                                  inputProps={{ step: 0.01 }}
                                />
                              </TableCell>
                              <TableCell align="right" width={160}>
                                <TextField
                                  type="number"
                                  size="small"
                                  value={line.closingBalance ?? ''}
                                  onChange={handleCcaNumberChange(index, 'closingBalance')}
                                  disabled={isSaving}
                                  inputProps={{ step: 0.01 }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                ) : null}
                <Divider textAlign="left">Notes</Divider>
                <TextField
                  label="Notes"
                  multiline
                  minRows={3}
                  value={preparedNotes}
                  onChange={(event) => setPreparedNotes(event.target.value)}
                  disabled={isSaving}
                />
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={isSaving || isPreparing}>
            Fermer
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!preparedPayload || isSaving}
          >
            Enregistrer le formulaire
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default RentalTaxScreen;
