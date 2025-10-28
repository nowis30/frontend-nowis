import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useNotification } from '../components/NotificationProvider';
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
import LaunchIcon from '@mui/icons-material/Launch';

import {
  usePersonalIncomeShareholders,
  usePersonalIncomes,
  usePersonalIncomeSummary,
  useCreatePersonalIncome,
  useUpdatePersonalIncome,
  useDeletePersonalIncome,
  useImportPersonalTaxReturn,
  usePersonalProfile,
  useUpdatePersonalProfile,
  type PersonalIncomeDto,
  type PersonalIncomeCategory,
  type PersonalIncomePayload
} from '../api/personalIncome';
import { useComputePersonalTaxReturn } from '../api/tax';
import { buildDocumentDownloadUrl, useDeleteDocument, useDocuments, useUpdateDocument } from '../api/documents';

interface PersonalIncomeFormState {
  shareholderId: number | null;
  taxYear: number;
  category: PersonalIncomeCategory;
  label: string;
  source: string;
  slipType: string;
  amount: number;
}

type PersonalIncomeFieldError = Partial<Record<keyof PersonalIncomeFormState, string>>;

const parseLocaleNumber = (raw: string): number => {
  const normalized = raw
    .replace(/\s+/g, '')
    .replace(/\$/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.+-]/g, '');
  if (!normalized) {
    return Number.NaN;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

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
  const { notify } = useNotification();
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [selectedShareholderId, setSelectedShareholderId] = useState<number | null>(null);
  const [selectedTaxYear, setSelectedTaxYear] = useState<number>(currentYear);
  const [form, setForm] = useState<PersonalIncomeFormState>(createInitialForm(null, currentYear));
  const [formOpen, setFormOpen] = useState(false);
  const [editingIncomeId, setEditingIncomeId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<PersonalIncomeFieldError>({});
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
  const importTax = useImportPersonalTaxReturn();
  const computePersonalTax = useComputePersonalTaxReturn();
  const { data: profile } = usePersonalProfile();
  const updateProfile = useUpdatePersonalProfile();
  // Documents importés (personnel)
  const [showAllDocs, setShowAllDocs] = useState(false);
  const { data: documents } = useDocuments({ domain: 'personal-income', taxYear: showAllDocs ? undefined as any : selectedTaxYear });
  const updateDocument = useUpdateDocument();
  const deleteDocument = useDeleteDocument();
  const [renameDocId, setRenameDocId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');

  const openRename = (id: number, current: string) => {
    setRenameDocId(id);
    setRenameValue(current);
  };
  const closeRename = () => {
    setRenameDocId(null);
    setRenameValue('');
  };
  const confirmRename = () => {
    if (!renameDocId) return;
    updateDocument.mutate(
      { id: renameDocId, label: renameValue },
      { onSuccess: () => { notify('Document renommé.', 'success'); closeRename(); }, onError: () => notify('Renommage impossible.', 'error') }
    );
  };

  const [profileForm, setProfileForm] = useState({
    displayName: '',
    gender: '' as '' | 'MALE' | 'FEMALE' | 'OTHER',
    birthDate: '' as string,
    address: ''
  });

  useEffect(() => {
    if (profile) {
      setProfileForm({
        displayName: profile.displayName ?? '',
        gender: (profile.gender ?? '') as '' | 'MALE' | 'FEMALE' | 'OTHER',
        birthDate: profile.birthDate ?? '',
        address: profile.address ?? ''
      });
    }
  }, [profile]);

  const profileAge = useMemo(() => {
    if (!profileForm.birthDate) return '';
    const d = new Date(profileForm.birthDate);
    if (Number.isNaN(d.getTime())) return '';
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    return String(Math.max(0, age));
  }, [profileForm.birthDate]);

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
    setFieldErrors({});
    setEditingIncomeId(null);
    setForm(createInitialForm(selectedShareholderId, selectedTaxYear));
    setFormOpen(true);
  };

  const handleEditIncome = (income: PersonalIncomeDto) => {
    setFormError(null);
    setFieldErrors({});
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
    setFieldErrors({});
  };

  const buildPayload = (): PersonalIncomePayload | null => {
    const errors: PersonalIncomeFieldError = {};

    if (!form.shareholderId) {
      errors.shareholderId = 'Choisis un actionnaire.';
    }

    const trimmedLabel = form.label.trim();
    if (!trimmedLabel) {
      errors.label = 'Ajoute un libellé.';
    }

    if (!Number.isFinite(form.amount) || form.amount <= 0) {
      errors.amount = 'Indique un montant supérieur à 0.';
    }

    if (!Number.isInteger(form.taxYear) || form.taxYear < 2000) {
      errors.taxYear = 'Choisis une année fiscale valide.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError('Corrige les champs en surbrillance.');
      return null;
    }

    setFieldErrors({});
    setFormError(null);

    return {
      shareholderId: form.shareholderId as number,
      taxYear: form.taxYear,
      category: form.category,
      label: trimmedLabel,
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

    const onError = () => {
      setFormError("Enregistrement impossible pour le moment.");
      notify("Erreur lors de l'enregistrement du revenu.", 'error');
    };

    if (editingIncomeId) {
      updateIncome.mutate(payload, {
        onSuccess: () => {
          notify('Revenu modifié avec succès.', 'success');
          handleCloseForm();
        },
        onError
      });
      return;
    }

    createIncome.mutate(payload, {
      onSuccess: () => {
        notify('Revenu ajouté avec succès.', 'success');
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
    deleteIncome.mutate(income.id, {
      onSuccess: () => notify('Revenu supprimé.', 'success'),
      onError: () => notify('Erreur lors de la suppression.', 'error')
    });
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
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Informations personnelles
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Nom complet"
              value={profileForm.displayName}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setProfileForm((p) => ({ ...p, displayName: e.target.value }))
              }
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              select
              fullWidth
              label="Sexe"
              value={profileForm.gender || ''}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setProfileForm((p) => ({ ...p, gender: (e.target.value as any) || '' }))
              }
            >
              <MenuItem value="">—</MenuItem>
              <MenuItem value="MALE">Homme</MenuItem>
              <MenuItem value="FEMALE">Femme</MenuItem>
              <MenuItem value="OTHER">Autre</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Date de naissance"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={profileForm.birthDate ? profileForm.birthDate.substring(0, 10) : ''}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const v = e.target.value;
                setProfileForm((p) => ({ ...p, birthDate: v ? new Date(v).toISOString() : '' }));
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField fullWidth label="Âge" value={profileAge} InputProps={{ readOnly: true }} />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Adresse"
              value={profileForm.address}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setProfileForm((p) => ({ ...p, address: e.target.value }))
              }
            />
          </Grid>
          <Grid item xs={12} md="auto">
            <Button
              variant="contained"
              onClick={() =>
                updateProfile.mutate({
                  displayName: profileForm.displayName || undefined,
                  gender: (profileForm.gender || undefined) as any,
                  birthDate: profileForm.birthDate || undefined,
                  address: profileForm.address || null
                })
              }
              disabled={updateProfile.isPending}
            >
              Enregistrer le profil
            </Button>
          </Grid>
          {profile?.latestTaxableIncome != null && (
            <Grid item xs={12} md={4}>
              <Alert severity="info">
                Revenu imposable {profile.latestTaxYear}: {currencyFormatter.format(profile.latestTaxableIncome)}
              </Alert>
            </Grid>
          )}
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6">Documents importés</Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2">Tous</Typography>
            <TextField select size="small" label="Filtre année" value={showAllDocs ? '' : String(selectedTaxYear)} onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const v = e.target.value;
              if (!v) { setShowAllDocs(true); } else { setShowAllDocs(false); setSelectedTaxYear(Number(v)); }
            }} sx={{ minWidth: 140 }}>
              <MenuItem value="">Toutes</MenuItem>
              <MenuItem value={String(selectedTaxYear)}>{selectedTaxYear}</MenuItem>
              <MenuItem value={String(selectedTaxYear - 1)}>{selectedTaxYear - 1}</MenuItem>
              <MenuItem value={String(selectedTaxYear - 2)}>{selectedTaxYear - 2}</MenuItem>
            </TextField>
          </Stack>
        </Stack>
        {(!documents || documents.length === 0) ? (
          <Typography variant="body2" color="text.secondary">Aucun document pour {selectedTaxYear}.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nom</TableCell>
                <TableCell>Taille</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.map((d) => (
                <TableRow key={d.id} hover>
                  <TableCell>{d.label}</TableCell>
                  <TableCell>{(d.size / 1024).toFixed(1)} Ko</TableCell>
                  <TableCell>{new Date(d.createdAt).toLocaleString()}</TableCell>
                  <TableCell align="right">
                    <IconButton aria-label="ouvrir" href={buildDocumentDownloadUrl(d.id)} target="_blank" rel="noopener">
                      <LaunchIcon />
                    </IconButton>
                    <IconButton aria-label="renommer" onClick={() => openRename(d.id, d.label)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton aria-label="supprimer" onClick={() => {
                      const ok = window.confirm(`Supprimer le document "${d.label}" ?`);
                      if (!ok) return;
                      deleteDocument.mutate(d.id, { onSuccess: () => notify('Document supprimé.', 'success'), onError: () => notify('Suppression impossible.', 'error') });
                    }}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
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
                setFieldErrors((prev) => {
                  if (!prev.shareholderId) {
                    return prev;
                  }
                  const next = { ...prev };
                  delete next.shareholderId;
                  return next;
                });
              }
            }}
            sx={{ minWidth: 220 }}
            disabled={isLoadingShareholders || !shareholders || shareholders.length === 0}
            error={Boolean(fieldErrors.shareholderId)}
            helperText={fieldErrors.shareholderId}
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
          <Button
            variant="outlined"
            component="label"
            disabled={!selectedShareholderId}
          >
            Importer un rapport d'impôt
            <input
              hidden
              type="file"
              accept="application/pdf,image/*"
              onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (!file || !selectedShareholderId) return;
                try {
                  const { taxYear, createdIds, extracted } = await importTax.mutateAsync({
                    file,
                    shareholderId: selectedShareholderId,
                    taxYear: selectedTaxYear,
                    autoCreate: true
                  });
                  // Aligne l'année affichée avec l'année extraite/cible
                  if (Number.isFinite(taxYear)) {
                    setSelectedTaxYear(taxYear);
                  }
                  const createdCount = Array.isArray(createdIds) ? createdIds.length : 0;
                  const extractedCount = Array.isArray(extracted) ? extracted.length : 0;
                  if (createdCount > 0) {
                    notify(`Import terminé (${taxYear}). ${createdCount} revenu(x) ajouté(s).`, 'success');
                  } else if (extractedCount > 0 && createdCount === 0) {
                    notify(`Import analysé (${taxYear}) mais aucun revenu n'a été créé automatiquement. Vérifie les montants extraits.`, 'warning');
                  } else {
                    notify("Aucun revenu identifiable dans le document. Vérifie le PDF ou essaie un autre feuillet.", 'warning');
                  }
                } catch (err: any) {
                  // Afficher des messages plus précis côté UI
                  const status = err?.response?.status as number | undefined;
                  const serverMsg = (err?.response?.data?.error as string | undefined) || '';
                  if (status === 501) {
                    notify("Import indisponible pour le moment: le serveur n'est pas configuré pour l'extraction (clé OpenAI manquante).", 'warning');
                  } else if (status === 413 || /trop volumineux|too large/i.test(serverMsg)) {
                    notify('Fichier trop volumineux (max 20 Mo).', 'error');
                  } else if (/non supporté|unsupported/i.test(serverMsg)) {
                    notify('Type de fichier non supporté. Utilise un PDF ou une image (PNG/JPG/WEBP/HEIC).', 'error');
                  } else if (status === 400 && serverMsg) {
                    notify(serverMsg, 'error');
                  } else {
                    notify("Import impossible. Vérifie le fichier PDF ou image.", 'error');
                  }
                } finally {
                  e.target.value = '';
                }
              }}
            />
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
              error={Boolean(fieldErrors.category)}
              helperText={fieldErrors.category}
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
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const { value } = event.target;
                setForm((prev) => ({ ...prev, label: value }));
                setFieldErrors((prev) => {
                  if (!prev.label) {
                    return prev;
                  }
                  const next = { ...prev };
                  delete next.label;
                  return next;
                });
              }}
              required
              error={Boolean(fieldErrors.label)}
              helperText={fieldErrors.label}
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
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const parsed = parseLocaleNumber(event.target.value);
                setForm((prev) => ({ ...prev, amount: Number.isNaN(parsed) ? prev.amount : parsed }));
                setFieldErrors((prev) => {
                  if (!prev.amount) {
                    return prev;
                  }
                  const next = { ...prev };
                  delete next.amount;
                  return next;
                });
              }}
              required
              error={Boolean(fieldErrors.amount)}
              helperText={fieldErrors.amount}
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
                setFieldErrors((prev) => {
                  if (!prev.taxYear) {
                    return prev;
                  }
                  const next = { ...prev };
                  delete next.taxYear;
                  return next;
                });
              }}
              required
              error={Boolean(fieldErrors.taxYear)}
              helperText={fieldErrors.taxYear}
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

      <Dialog open={renameDocId != null} onClose={closeRename} fullWidth>
        <DialogTitle>Renommer le document</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Nom" value={renameValue} onChange={(e: ChangeEvent<HTMLInputElement>) => setRenameValue(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRename}>Annuler</Button>
          <Button variant="contained" onClick={confirmRename} disabled={updateDocument.isPending}>Enregistrer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PersonalIncomeScreen;
