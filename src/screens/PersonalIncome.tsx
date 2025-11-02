import { ChangeEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
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
  Step,
  StepLabel,
  Stepper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import LinearProgress from '@mui/material/LinearProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LaunchIcon from '@mui/icons-material/Launch';
import ReplayIcon from '@mui/icons-material/Replay';

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
  usePersonalTaxReturn,
  useWhyPersonalIncome,
  type PersonalIncomeDto,
  type PersonalIncomeCategory,
  type PersonalIncomePayload
} from '../api/personalIncome';
import { useGraphNodes, useGraphRecalc, useRecentEvents, useGraphOutputs } from '../api/diagnostics';
import { useComputePersonalTaxReturn } from '../api/tax';
import { buildDocumentDownloadUrl, reingestDocument, useDeleteDocument, useDocuments, useUpdateDocument } from '../api/documents';
import { useMutateReturnLines, useMutateSlipLines, useMutateSlips } from '../api/personalReturns';
import { diffProfileEntries } from './personalIncomeDiff';

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
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
  const { data: fullReturn, isLoading: isLoadingReturn } = usePersonalTaxReturn(
    selectedShareholderId,
    selectedTaxYear
  );

  const createIncome = useCreatePersonalIncome();
  const deleteIncome = useDeletePersonalIncome();
  const updateIncome = useUpdatePersonalIncome(editingIncomeId);
  const importTax = useImportPersonalTaxReturn();
  const whyQuery = useWhyPersonalIncome(selectedShareholderId, selectedTaxYear);
  const computePersonalTax = useComputePersonalTaxReturn();
  const { data: profile } = usePersonalProfile();
  const updateProfile = useUpdatePersonalProfile();
  // Confirmation avant sauvegarde du profil
  const [confirmProfileOpen, setConfirmProfileOpen] = useState(false);
  // Onboarding wizard
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const wizardFileInputRef = useRef<HTMLInputElement | null>(null);
  const [wizardUploading, setWizardUploading] = useState(false);
  // Documents importés (personnel)
  const [showAllDocs, setShowAllDocs] = useState(false);
  const { data: documents } = useDocuments({ domain: 'personal-income', taxYear: showAllDocs ? undefined as any : selectedTaxYear });
  const updateDocument = useUpdateDocument();
  const deleteDocument = useDeleteDocument();
  const [renameDocId, setRenameDocId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [postToLedger, setPostToLedger] = useState<boolean>(false);
  const [whyOpen, setWhyOpen] = useState(false);
  // Diagnostics
  const { data: recentEvents } = useRecentEvents(15);
  const { data: graph } = useGraphNodes();
  const { data: graphOutputs } = useGraphOutputs();
  const graphRecalc = useGraphRecalc();
  const handleRefreshAll = () => {
    // Lance un recalcul déterministe côté serveur (sans IA) puis invalide les caches clés
    graphRecalc.mutate(
      { source: 'Compta', year: selectedTaxYear },
      {
        onSettled: () => {
          // Invalidate data caches so UI reflects latest state derived from existing info
          queryClient.invalidateQueries({ queryKey: ['personal-profile'] });
          queryClient.invalidateQueries({ queryKey: ['personal-income-shareholders'] });
          queryClient.invalidateQueries({ queryKey: ['personal-incomes'] });
          queryClient.invalidateQueries({ queryKey: ['personal-income-summary'] });
          queryClient.invalidateQueries({ queryKey: ['personal-tax-return'] });
          queryClient.invalidateQueries({ queryKey: ['why-personal-income'] });
          queryClient.invalidateQueries({ queryKey: ['documents'] });
          queryClient.invalidateQueries({ queryKey: ['rental-tax'] });
          queryClient.invalidateQueries({ queryKey: ['summary'] });
          queryClient.invalidateQueries({ queryKey: ['graph-outputs'] });
          queryClient.invalidateQueries({ queryKey: ['graph-nodes'] });
          notify('Données rafraîchies à partir des informations existantes.', 'success');
        }
      }
    );
  };

  const blurEventTarget = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.blur();
    }
  };

  const preventDialogTriggerFocus = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
  };

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

  const diffProfile = useMemo(() => diffProfileEntries(profile, profileForm), [profile, profileForm]);
  const hasProfileChanges = diffProfile.length > 0;

  // Indicateur de complétude du profil (nom/adresse/date/phone)
  const profileCompleteness = useMemo(() => {
    const fields = [
      { key: 'Nom', ok: Boolean(profile?.displayName && profile.displayName.trim().length >= 2) },
      { key: 'Adresse', ok: Boolean(profile?.address && profile.address.trim().length >= 5) },
      { key: 'Date de naissance', ok: Boolean(profile?.birthDate && !Number.isNaN(new Date(profile.birthDate).getTime())) },
      { key: 'Téléphone', ok: Boolean(profile?.contactPhone && String(profile.contactPhone).trim().length >= 7) }
    ];
    const done = fields.filter(f => f.ok).length;
    const missing = fields.filter(f => !f.ok).map(f => f.key);
    const pct = Math.round((done / fields.length) * 100);
    return { pct, missing };
  }, [profile]);

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
          // Recalcule les computes dépendants (Compta → Prévisions → Decideur) pour l'année courante
          graphRecalc.mutate({ source: 'Compta', year: selectedTaxYear });
          handleCloseForm();
        },
        onError
      });
      return;
    }

    createIncome.mutate(payload, {
      onSuccess: () => {
        notify('Revenu ajouté avec succès.', 'success');
        // Recalcule les computes dépendants (Compta → Prévisions → Decideur) pour l'année courante
        graphRecalc.mutate({ source: 'Compta', year: selectedTaxYear });
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
      onSuccess: () => {
        notify('Revenu supprimé.', 'success');
        // Recalcule les computes dépendants pour répercuter la suppression
        graphRecalc.mutate({ source: 'Compta', year: selectedTaxYear });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error as string | undefined;
        if (msg) {
          notify(`Suppression impossible: ${msg}`, 'error');
        } else {
          notify('Erreur lors de la suppression.', 'error');
        }
      }
    });
  };

  const isSaving = createIncome.isPending || updateIncome.isPending;

  // --- Mutations pour édition des feuillets et lignes ---
  const slipsMut = useMutateSlips();
  const slipLinesMut = useMutateSlipLines();
  const returnLinesMut = useMutateReturnLines();

  // États d'édition pour feuillet et lignes de feuillet
  const [editingSlipId, setEditingSlipId] = useState<number | null>(null);
  const [slipForm, setSlipForm] = useState<{ slipType: string; issuer: string; accountNumber: string }>({ slipType: '', issuer: '', accountNumber: '' });
  const [editingSlipLineId, setEditingSlipLineId] = useState<number | null>(null);
  const [slipLineForm, setSlipLineForm] = useState<{ code: string; label: string; amount: number }>({ code: '', label: '', amount: 0 });

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
        <Box sx={{ mb: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Box sx={{ flex: 1 }}>
              <LinearProgress variant="determinate" value={profileCompleteness.pct} sx={{ height: 8, borderRadius: 1 }} />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140, textAlign: 'right' }}>
              Complétude: {profileCompleteness.pct}%
            </Typography>
          </Stack>
          {profileCompleteness.missing.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              À compléter: {profileCompleteness.missing.join(', ')}
            </Typography>
          )}
        </Box>
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
              onClick={(event) => {
                blurEventTarget(event);
                if (hasProfileChanges) setConfirmProfileOpen(true);
                else notify('Aucun changement à enregistrer.', 'info');
              }}
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
                <TableCell>Statut</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.map((d) => (
                <TableRow key={d.id} hover>
                  <TableCell>{d.label}</TableCell>
                  <TableCell>{(d.size / 1024).toFixed(1)} Ko</TableCell>
                  <TableCell>{new Date(d.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    {d.metadata?.import?.status ? (
                      <>
                        <strong>{d.metadata.import.status}</strong>
                        {typeof d.metadata.import.taxYear === 'number' ? ` · ${d.metadata.import.taxYear}` : ''}
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton aria-label="ouvrir" href={buildDocumentDownloadUrl(d.id)} target="_blank" rel="noopener">
                      <LaunchIcon />
                    </IconButton>
                    <IconButton aria-label="ré-ingérer" onClick={async () => {
                      try {
                        const result = await reingestDocument({
                          documentId: d.id,
                          domain: 'personal-income',
                          autoCreate: true,
                          shareholderId: selectedShareholderId,
                          taxYear: selectedTaxYear
                        });
                        if (Number.isFinite(result.taxYear)) setSelectedTaxYear(result.taxYear as number);
                        const createdCount = result.createdIds?.length ?? 0;
                        const extractedCount = result.extracted?.length ?? 0;
                        if (createdCount > 0) {
                          notify(`Ré-ingestion OK (${result.taxYear}). ${createdCount} revenu(x) ajouté(s).`, 'success');
                        } else if (extractedCount > 0) {
                          notify(`Ré-ingestion analysée (${result.taxYear}) mais aucun revenu créé automatiquement.`, 'warning');
                        } else {
                          notify('Ré-ingestion terminée: aucun revenu détecté.', 'info');
                        }
                      } catch (err: any) {
                        const status = err?.response?.status as number | undefined;
                        const serverMsg = (err?.response?.data?.error as string | undefined) || '';
                        if (status === 410) {
                          notify("Ce document n'est plus disponible côté serveur (stockage éphémère). Ré-uploade le fichier puis ré-essaie.", 'warning');
                        } else if (serverMsg) {
                          notify(serverMsg, 'error');
                        } else {
                          notify('Ré-ingestion impossible pour ce document.', 'error');
                        }
                      }
                    }}>
                      <ReplayIcon />
                    </IconButton>
                    <IconButton
                      aria-label="renommer"
                      onMouseDown={preventDialogTriggerFocus}
                      onClick={(event) => {
                        blurEventTarget(event);
                        openRename(d.id, d.label);
                      }}
                    >
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
          <Button
            variant="contained"
            onMouseDown={preventDialogTriggerFocus}
            onClick={(event) => {
              blurEventTarget(event);
              handleOpenForm();
            }}
            disabled={!selectedShareholderId}
          >
            Ajouter un revenu
          </Button>
          <Button
            variant="outlined"
            onMouseDown={preventDialogTriggerFocus}
            onClick={(event) => {
              blurEventTarget(event);
              setOnboardingOpen(true);
              setOnboardingStep(0);
            }}
          >
            Démarrer l'onboarding
          </Button>
          <FormControlLabel
            control={<Switch checked={postToLedger} onChange={(e) => setPostToLedger(e.target.checked)} />}
            label="Publier au grand livre"
          />
          <Button
            variant="outlined"
            component="label"
            onMouseDown={preventDialogTriggerFocus}
            onClick={(event) => blurEventTarget(event)}
          >
            Importer un rapport d'impôt
            <input
              hidden
              type="file"
              accept="application/pdf,image/*"
              onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const { taxYear, createdIds, extracted, shareholderId: newShareholderId } = await importTax.mutateAsync({
                    file,
                    shareholderId: selectedShareholderId ?? undefined,
                    taxYear: selectedTaxYear,
                    autoCreate: true,
                    postToLedger
                  });
                  // Aligne l'année affichée avec l'année extraite/cible
                  if (Number.isFinite(taxYear)) {
                    setSelectedTaxYear(taxYear);
                  }
                  // Si le serveur a créé un actionnaire, sélectionne-le automatiquement
                  if (!selectedShareholderId && Number.isFinite(newShareholderId as number)) {
                    const sid = Number(newShareholderId);
                    setSelectedShareholderId(sid);
                    setForm((prev) => ({ ...prev, shareholderId: sid }));
                    notify('Profil personnel créé automatiquement à partir du document.', 'success');
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
                  // Déclenche un recalcul global depuis la compta pour propager les écritures postées
                  graphRecalc.mutate({ source: 'Compta', year: taxYear ?? selectedTaxYear });
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
          <Button
              onMouseDown={preventDialogTriggerFocus}
            variant="text"
            onClick={handleRefreshAll}
            disabled={graphRecalc.isPending}
          >
            Rafraîchir les données
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
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="h6">Résumé par catégorie</Typography>
              <Button
                size="small"
                variant="text"
                onMouseDown={preventDialogTriggerFocus}
                onClick={(event) => {
                  blurEventTarget(event);
                  setWhyOpen(true);
                }}
                disabled={!selectedShareholderId}
              >
                Pourquoi ce total ?
              </Button>
            </Stack>
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

      {/* Dialog Explicabilité */}
      <Dialog open={whyOpen} onClose={() => setWhyOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Pourquoi ce total ?</DialogTitle>
        <DialogContent dividers>
          {whyQuery.isLoading ? (
            <Typography>Chargement…</Typography>
          ) : whyQuery.isError ? (
            <Alert severity="error">Impossible de récupérer l'explication.</Alert>
          ) : whyQuery.data ? (
            <Stack spacing={2}>
              <Typography>
                Actionnaire: <strong>{whyQuery.data.shareholder.displayName}</strong> — Année: <strong>{whyQuery.data.taxYear}</strong>
              </Typography>
              <Typography>
                Total des revenus saisis: <strong>{currencyFormatter.format(whyQuery.data.totalIncome)}</strong>
              </Typography>
              {whyQuery.data.taxReturn && (
                <Box>
                  <Typography variant="subtitle1">Déclarations d'impôt (agrégats)</Typography>
                  <Stack direction="row" spacing={2}>
                    <Typography>Revenu imposable: {currencyFormatter.format(whyQuery.data.taxReturn.taxableIncome)}</Typography>
                    <Typography>Fédéral: {currencyFormatter.format(whyQuery.data.taxReturn.federalTax)}</Typography>
                    <Typography>Provincial: {currencyFormatter.format(whyQuery.data.taxReturn.provincialTax)}</Typography>
                  </Stack>
                </Box>
              )}
              <Box>
                <Typography variant="subtitle1" gutterBottom>Écritures comptables postées</Typography>
                {whyQuery.data.journal.entries.length === 0 ? (
                  <Typography color="text.secondary">Aucune écriture trouvée (essaie de publier au grand livre).</Typography>
                ) : (
                  <Stack spacing={2}>
                    {whyQuery.data.journal.entries.map((entry) => (
                      <Box key={entry.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                        <Typography fontWeight={600}>{entry.entryDate} — {entry.description ?? 'Écriture'}</Typography>
                        <Table size="small" sx={{ mt: 1 }}>
                          <TableHead>
                            <TableRow>
                              <TableCell>Compte</TableCell>
                              <TableCell align="right">Débit</TableCell>
                              <TableCell align="right">Crédit</TableCell>
                              <TableCell>Mémo</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {entry.lines.map((l) => (
                              <TableRow key={l.id}>
                                <TableCell>{l.accountCode}</TableCell>
                                <TableCell align="right">{l.debit ? currencyFormatter.format(l.debit) : '—'}</TableCell>
                                <TableCell align="right">{l.credit ? currencyFormatter.format(l.credit) : '—'}</TableCell>
                                <TableCell>{l.memo ?? '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          ) : (
            <Typography>Aucune donnée disponible.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWhyOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      <Paper sx={{ p: 3, mt: 4 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">Feuillets détectés (extraction IA)</Typography>
            <Typography variant="body2" color="text.secondary">
              Visualise les feuillets (T4/T5/RL‑1/T3/T5008…) et leurs lignes/cases extraits du PDF importé.
            </Typography>
          </Box>
          {isLoadingReturn ? (
            <Typography>Chargement des feuillets…</Typography>
          ) : !fullReturn || !fullReturn.slips || fullReturn.slips.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Aucun feuillet détecté pour {selectedTaxYear}.</Typography>
          ) : (
            <Stack spacing={2}>
              {fullReturn.slips.map((s) => (
                <Paper key={s.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1}>
                    {editingSlipId === s.id ? (
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ flex: 1 }}>
                        <TextField
                          label="Feuillet"
                          size="small"
                          value={slipForm.slipType}
                          onChange={(e) => setSlipForm((f) => ({ ...f, slipType: e.target.value }))}
                        />
                        <TextField
                          label="Émetteur"
                          size="small"
                          value={slipForm.issuer}
                          onChange={(e) => setSlipForm((f) => ({ ...f, issuer: e.target.value }))}
                        />
                        <TextField
                          label="Compte"
                          size="small"
                          value={slipForm.accountNumber}
                          onChange={(e) => setSlipForm((f) => ({ ...f, accountNumber: e.target.value }))}
                        />
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                              slipsMut.update.mutate(
                                { slipId: s.id, payload: { slipType: slipForm.slipType, issuer: slipForm.issuer || null, accountNumber: slipForm.accountNumber || null } },
                                {
                                  onSuccess: () => {
                                    setEditingSlipId(null);
                                  }
                                }
                              );
                            }}
                          >
                            Enregistrer
                          </Button>
                          <Button size="small" onClick={() => setEditingSlipId(null)}>Annuler</Button>
                        </Stack>
                      </Stack>
                    ) : (
                      <>
                        <Typography variant="subtitle1">{s.slipType}</Typography>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Typography variant="body2" color="text.secondary">Émetteur: {s.issuer || '—'}</Typography>
                          <Typography variant="body2" color="text.secondary">Compte: {s.accountNumber || '—'}</Typography>
                          <IconButton
                            aria-label="modifier feuillet"
                            size="small"
                            onClick={() => {
                              setEditingSlipId(s.id);
                              setSlipForm({ slipType: s.slipType, issuer: s.issuer || '', accountNumber: s.accountNumber || '' });
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <Button size="small" variant="outlined" onClick={() => {
                            slipLinesMut.create.mutate({ slipId: s.id, payload: { label: 'Nouvelle ligne', amount: 0 } });
                          }}>Ajouter une ligne</Button>
                        </Stack>
                      </>
                    )}
                  </Stack>
                  <Table size="small" sx={{ mt: 1 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Code</TableCell>
                        <TableCell>Libellé</TableCell>
                        <TableCell align="right">Montant</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {s.lines.map((li) => (
                        <TableRow key={li.id} hover>
                          {editingSlipLineId === li.id ? (
                            <>
                              <TableCell sx={{ width: 140 }}>
                                <TextField
                                  size="small"
                                  value={slipLineForm.code}
                                  onChange={(e) => setSlipLineForm((f) => ({ ...f, code: e.target.value }))}
                                  placeholder="Code"
                                />
                              </TableCell>
                              <TableCell>
                                <TextField
                                  size="small"
                                  fullWidth
                                  value={slipLineForm.label}
                                  onChange={(e) => setSlipLineForm((f) => ({ ...f, label: e.target.value }))}
                                  placeholder="Libellé"
                                />
                              </TableCell>
                              <TableCell align="right" sx={{ width: 180 }}>
                                <TextField
                                  size="small"
                                  type="number"
                                  inputProps={{ step: 0.01 }}
                                  value={slipLineForm.amount}
                                  onChange={(e) => setSlipLineForm((f) => ({ ...f, amount: Number(e.target.value) || 0 }))}
                                />
                              </TableCell>
                              <TableCell align="right" sx={{ width: 200 }}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => {
                                    slipLinesMut.update.mutate(
                                      { slipId: s.id, lineId: li.id, payload: { code: slipLineForm.code || null, label: slipLineForm.label, amount: slipLineForm.amount } },
                                      { onSuccess: () => setEditingSlipLineId(null) }
                                    );
                                  }}
                                  sx={{ mr: 1 }}
                                >
                                  Enregistrer
                                </Button>
                                <Button size="small" onClick={() => setEditingSlipLineId(null)}>Annuler</Button>
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell>{li.code || '—'}</TableCell>
                              <TableCell>{li.label}</TableCell>
                              <TableCell align="right">{currencyFormatter.format(li.amount)}</TableCell>
                              <TableCell align="right">
                                <IconButton aria-label="modifier" size="small" onClick={() => {
                                  setEditingSlipLineId(li.id);
                                  setSlipLineForm({ code: li.code || '', label: li.label, amount: li.amount });
                                }} sx={{ mr: 0.5 }}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton aria-label="supprimer" size="small" onClick={() => {
                                  const ok = window.confirm(`Supprimer la ligne "${li.label}" ?`);
                                  if (!ok) return;
                                  slipLinesMut.remove.mutate({ slipId: s.id, lineId: li.id });
                                }}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>

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

      {/* Diagnostics: événements récents et graphe */}
      <Grid container spacing={3} sx={{ mt: 0, pt: 4 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Événements récents</Typography>
            {(!recentEvents || recentEvents.length === 0) ? (
              <Typography variant="body2" color="text.secondary">Aucun événement récent.</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Détails</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentEvents.map((ev, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(ev.at).toLocaleString()}</TableCell>
                      <TableCell>{ev.type}</TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {Object.keys(ev).filter(k => !['type','at'].includes(k)).slice(0,3).map(k => `${k}: ${String((ev as any)[k])}`).join(' · ') || '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="h6">Graphe de dépendances</Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => graphRecalc.mutate({ source: 'Tax', year: selectedTaxYear })}
                  disabled={graphRecalc.isPending}
                >
                  Recalculer depuis Tax
                </Button>
                <Button
                  size="small"
                  onClick={() => graphRecalc.mutate({ source: 'Compta', year: selectedTaxYear })}
                  disabled={graphRecalc.isPending}
                >
                  Depuis Compta
                </Button>
              </Stack>
            </Stack>
            {!graph?.nodes?.length ? (
              <Typography variant="body2" color="text.secondary">Aucun nœud enregistré.</Typography>
            ) : (
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">Nœuds: {graph.nodes.join(' → ')}</Typography>
                {graphRecalc.data && (
                  <Alert severity="info">Ordre de propagation: {graphRecalc.data.order.join(' → ')}</Alert>
                )}
                {graphOutputs && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>Dernières sorties (résumées)</Typography>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflow: 'auto', background: '#f7f7f7', padding: 8, borderRadius: 4 }}>
                      {JSON.stringify(graphOutputs, null, 2)}
                    </pre>
                  </Box>
                )}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>

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

      {/* Onboarding guidé */}
      <Dialog open={onboardingOpen} onClose={() => setOnboardingOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Bienvenue — Configurons vos revenus personnels</DialogTitle>
        <DialogContent dividers>
          <Stepper activeStep={onboardingStep} alternativeLabel>
            <Step key={0}><StepLabel>Importer</StepLabel></Step>
            <Step key={1}><StepLabel>Vérifier le profil</StepLabel></Step>
            <Step key={2}><StepLabel>Associer les loyers</StepLabel></Step>
            <Step key={3}><StepLabel>Conseils (optionnel)</StepLabel></Step>
          </Stepper>
          <Box sx={{ mt: 3 }}>
            {onboardingStep === 0 && (
              <Stack spacing={2}>
                <Typography>Importe un rapport d'impôt ou des feuillets (PDF ou image). Sélectionne l'actionnaire et l'année, puis choisis un fichier.</Typography>
                {!selectedShareholderId && (
                  <Alert severity="info">Aucun actionnaire présent&nbsp;: l'import créera automatiquement un profil personnel.</Alert>
                )}
                <Stack direction="row" spacing={2} alignItems="center">
                  <Button
                    variant="contained"
                    disabled={wizardUploading}
                    onClick={() => wizardFileInputRef.current?.click()}
                  >
                    Choisir un fichier…
                  </Button>
                  {wizardUploading && <Typography>Import en cours…</Typography>}
                </Stack>
                <input
                  ref={wizardFileInputRef}
                  type="file"
                  hidden
                  accept="application/pdf,image/*"
                  onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    try {
                      setWizardUploading(true);
                      const { taxYear, createdIds, extracted, shareholderId: newShareholderId } = await importTax.mutateAsync({
                        file,
                        shareholderId: selectedShareholderId ?? undefined,
                        taxYear: selectedTaxYear,
                        autoCreate: true,
                        postToLedger
                      });
                      if (Number.isFinite(taxYear)) setSelectedTaxYear(taxYear);
                      if (!selectedShareholderId && Number.isFinite(newShareholderId as number)) {
                        const sid = Number(newShareholderId);
                        setSelectedShareholderId(sid);
                        setForm((prev) => ({ ...prev, shareholderId: sid }));
                        notify('Profil personnel créé automatiquement à partir du document.', 'success');
                      }
                      const createdCount = Array.isArray(createdIds) ? createdIds.length : 0;
                      const extractedCount = Array.isArray(extracted) ? extracted.length : 0;
                      if (createdCount > 0) {
                        notify(`Import terminé (${taxYear}). ${createdCount} revenu(x) ajouté(s).`, 'success');
                      } else if (extractedCount > 0) {
                        notify(`Import analysé (${taxYear}) mais aucun revenu créé automatiquement.`, 'warning');
                      } else {
                        notify('Aucun revenu identifiable dans le document.', 'info');
                      }
                      // Recalcule pour propager
                      graphRecalc.mutate({ source: 'Compta', year: taxYear ?? selectedTaxYear });
                      // Étape suivante
                      setOnboardingStep(1);
                    } catch (err: any) {
                      const status = err?.response?.status as number | undefined;
                      const serverMsg = (err?.response?.data?.error as string | undefined) || '';
                      if (status === 501) {
                        notify("Import indisponible (clé OpenAI manquante)", 'warning');
                      } else if (status === 413 || /trop volumineux|too large/i.test(serverMsg)) {
                        notify('Fichier trop volumineux (max 20 Mo).', 'error');
                      } else if (/non supporté|unsupported/i.test(serverMsg)) {
                        notify('Type de fichier non supporté. Utilise un PDF ou une image.', 'error');
                      } else if (status === 400 && serverMsg) {
                        notify(serverMsg, 'error');
                      } else {
                        notify("Import impossible. Vérifie le fichier.", 'error');
                      }
                    } finally {
                      setWizardUploading(false);
                    }
                  }}
                />
              </Stack>
            )}
            {onboardingStep === 1 && (
              <Stack spacing={2}>
                <Typography>Vérifie et complète tes informations personnelles. Le baromètre ci-dessous indique la complétude.</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                  <Box sx={{ flex: 1 }}>
                    <LinearProgress variant="determinate" value={profileCompleteness.pct} sx={{ height: 8, borderRadius: 1 }} />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140, textAlign: 'right' }}>
                    Complétude: {profileCompleteness.pct}%
                  </Typography>
                </Stack>
                {profileCompleteness.missing.length > 0 && (
                  <Alert severity="info">À compléter: {profileCompleteness.missing.join(', ')}</Alert>
                )}
              </Stack>
            )}
            {onboardingStep === 2 && (
              <Stack spacing={2}>
                <Typography>
                  Associe tes feuillets de revenus locatifs (T776/TP‑128) à tes immeubles. Cela permet d'auto‑créer des lignes annuelles de loyers et dépenses par immeuble.
                </Typography>
                <Stack direction="row" spacing={2}>
                  <Button variant="contained" onClick={() => navigate('/rental-tax')}>Aller aux relevés locatifs</Button>
                  <Button variant="outlined" onClick={handleRefreshAll}>Rafraîchir les données</Button>
                </Stack>
              </Stack>
            )}
            {onboardingStep === 3 && (
              <Stack spacing={2}>
                <Typography>
                  Découvre des conseils personnalisés (création d'entreprise, levier, gel successoral…). Cette étape est optionnelle.
                </Typography>
                <Button variant="contained" onClick={() => navigate('/advisors')}>Ouvrir les conseils</Button>
              </Stack>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
            <Box sx={{ flex: 1 }} />
            <Button onClick={() => setOnboardingOpen(false)}>Fermer</Button>
            {onboardingStep > 0 && <Button onClick={() => setOnboardingStep((s) => Math.max(0, s - 1))}>Précédent</Button>}
              {onboardingStep < 3 ? (
              <Button variant="contained" onClick={() => setOnboardingStep((s) => Math.min(3, s + 1))} disabled={onboardingStep === 0 && wizardUploading}>
                Suivant
              </Button>
            ) : (
              <Button variant="contained" onClick={() => setOnboardingOpen(false)}>Terminer</Button>
            )}
          </Stack>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmProfileOpen} onClose={() => setConfirmProfileOpen(false)} fullWidth>
        <DialogTitle>Confirmer la mise à jour du profil</DialogTitle>
        <DialogContent>
          {diffProfile.length === 0 ? (
            <Typography>Aucun changement détecté.</Typography>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Les informations suivantes seront mises à jour:
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Champ</TableCell>
                    <TableCell>Actuel</TableCell>
                    <TableCell>Nouveau</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {diffProfile.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell>{row.key}</TableCell>
                      <TableCell>{row.from || '—'}</TableCell>
                      <TableCell>{row.to || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmProfileOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={() => {
              setConfirmProfileOpen(false);
              updateProfile.mutate({
                displayName: profileForm.displayName || undefined,
                gender: (profileForm.gender || undefined) as any,
                birthDate: profileForm.birthDate || undefined,
                address: profileForm.address || null
              }, { onSuccess: () => notify('Profil mis à jour.', 'success') });
            }}
            disabled={updateProfile.isPending}
          >
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PersonalIncomeScreen;
