import { ChangeEvent, Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Collapse,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
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
import type { SelectChangeEvent } from '@mui/material/Select';
import type { AlertColor } from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DownloadIcon from '@mui/icons-material/Download';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import HouseIcon from '@mui/icons-material/House';
import PeopleIcon from '@mui/icons-material/People';
import PaidIcon from '@mui/icons-material/Paid';
import BalanceIcon from '@mui/icons-material/Balance';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

import {
  useCompanies,
  useCompanyDetail,
  useCreateCompany,
  useDeleteCompany,
  type CompanyDetailDto,
  type CompanyPayload,
  type CorporateResolutionDto,
  type CorporateResolutionPayload,
  type CorporateResolutionUpdatePayload,
  type CorporateStatementDto,
  type CorporateStatementLinePayload,
  type CorporateStatementPayload,
  type CorporateStatementUpdatePayload,
  type ShareholderLinkDto,
  type ShareholderLinkUpdatePayload,
  type ShareholderUpdatePayload,
  type ShareClassDto,
  type ShareTransactionDto,
  createShareholderLink,
  updateShareholderLink,
  deleteShareholderLink,
  createShareClass,
  updateShareClass,
  deleteShareClass,
  createShareTransaction,
  updateShareTransaction,
  deleteShareTransaction,
  createCorporateStatement,
  updateCorporateStatement,
  deleteCorporateStatement,
  createCorporateResolution,
  updateCorporateResolution,
  deleteCorporateResolution
} from '../api/companies';
import { downloadBlob } from '../utils/download';

type DialogMode = 'create' | 'edit';

interface CompanyFormState {
  name: string;
  province: string;
  fiscalYearEnd: string;
  neq: string;
  notes: string;
}

interface ShareholderFormState {
  displayName: string;
  type: 'PERSON' | 'CORPORATION';
  contactEmail: string;
  contactPhone: string;
  role: string;
  votingPercent: string;
}

interface ShareClassFormState {
  code: string;
  description: string;
  hasVotingRights: boolean;
  participatesInGrowth: boolean;
  dividendPolicy: string;
}

interface ShareTransactionFormState {
  shareholderId: string;
  shareClassId: string;
  type: string;
  transactionDate: string;
  quantity: string;
  pricePerShare: string;
  considerationPaid: string;
  fairMarketValue: string;
  notes: string;
}

interface CorporateStatementFormState {
  statementType: string;
  periodStart: string;
  periodEnd: string;
  isAudited: boolean;
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  totalRevenue: string;
  totalExpenses: string;
  netIncome: string;
  metadata: string;
  lines: CorporateStatementLineFormState[];
}

interface CorporateStatementLineFormState {
  id?: number;
  category: string;
  label: string;
  amount: string;
  metadata: string;
}

interface CorporateResolutionFormState {
  type: string;
  title: string;
  resolutionDate: string;
  body: string;
  metadata: string;
}

const initialCompanyForm: CompanyFormState = {
  name: '',
  province: '',
  fiscalYearEnd: '',
  neq: '',
  notes: ''
};

const emptyShareholderForm: ShareholderFormState = {
  displayName: '',
  type: 'PERSON',
  contactEmail: '',
  contactPhone: '',
  role: '',
  votingPercent: ''
};

const emptyShareClassForm: ShareClassFormState = {
  code: '',
  description: '',
  hasVotingRights: true,
  participatesInGrowth: true,
  dividendPolicy: ''
};

const emptyShareTransactionForm: ShareTransactionFormState = {
  shareholderId: '',
  shareClassId: '',
  type: 'ISSUANCE',
  transactionDate: new Date().toISOString().slice(0, 10),
  quantity: '',
  pricePerShare: '',
  considerationPaid: '',
  fairMarketValue: '',
  notes: ''
};

const emptyCorporateStatementForm: CorporateStatementFormState = {
  statementType: 'BALANCE_SHEET',
  periodStart: new Date().toISOString().slice(0, 10),
  periodEnd: new Date().toISOString().slice(0, 10),
  isAudited: false,
  totalAssets: '',
  totalLiabilities: '',
  totalEquity: '',
  totalRevenue: '',
  totalExpenses: '',
  netIncome: '',
  metadata: '',
  lines: []
};

const emptyCorporateResolutionForm: CorporateResolutionFormState = {
  type: 'ANNUAL',
  title: '',
  resolutionDate: new Date().toISOString().slice(0, 10),
  body: '',
  metadata: ''
};

const dateFormatter = new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium' });
const currencyFormatter = new Intl.NumberFormat('fr-CA', {
  style: 'currency',
  currency: 'CAD'
});

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
}

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined) {
    return '—';
  }

  return value.toLocaleString('fr-CA', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '—';
  }

  return currencyFormatter.format(value);
}

function toPayload(form: CompanyFormState): CompanyPayload {
  return {
    name: form.name.trim(),
    province: form.province.trim() || null,
    fiscalYearEnd: form.fiscalYearEnd || null,
    neq: form.neq.trim() || null,
    notes: form.notes.trim() || null
  };
}

function extractApiError(error: unknown): string | null {
  if (error && typeof error === 'object' && 'response' in error) {
    const maybe = (error as { response?: { data?: { error?: string } } }).response?.data?.error;
    return maybe ?? null;
  }
  return null;
}

function parseNullableNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseOptionalNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

function parseIdParam(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildCompanyLink(baseUrl: string, companyId: number, extras?: { statementId?: number; resolutionId?: number }) {
  const url = new URL(baseUrl);
  url.pathname = '/companies';
  url.searchParams.set('companyId', String(companyId));
  if (extras?.statementId) {
    url.searchParams.set('statementId', String(extras.statementId));
  }
  if (extras?.resolutionId) {
    url.searchParams.set('resolutionId', String(extras.resolutionId));
  }
  return url.toString();
}

const shareholderTypeOptions = [
  { value: 'PERSON', label: 'Personne physique' },
  { value: 'CORPORATION', label: 'Personne morale' }
] as const;

const transactionTypeOptions = [
  { value: 'ISSUANCE', label: 'Émission' },
  { value: 'TRANSFER', label: 'Transfert' },
  { value: 'REDEMPTION', label: 'Rachat' },
  { value: 'DIVIDEND', label: 'Dividende' }
] as const;

const statementTypeOptions = [
  { value: 'BALANCE_SHEET', label: 'Bilan' },
  { value: 'INCOME_STATEMENT', label: 'Résultat net' },
  { value: 'CASH_FLOW', label: 'Flux de trésorerie' }
] as const;

const resolutionTypeOptions = [
  { value: 'ANNUAL', label: 'Assemblée annuelle' },
  { value: 'SPECIAL', label: 'Résolution spéciale' },
  { value: 'BOARD', label: 'Conseil d’administration' },
  { value: 'WRITTEN', label: 'Résolution écrite' }
] as const;

function formatEnumLabel(value: string, labels: Record<string, string>) {
  return labels[value] ?? value;
}

const transactionTypeLabels = transactionTypeOptions.reduce<Record<string, string>>(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {}
);

const statementTypeLabels = statementTypeOptions.reduce<Record<string, string>>(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {}
);

const resolutionTypeLabels = resolutionTypeOptions.reduce<Record<string, string>>(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {}
);

const shareholderTypeLabels = shareholderTypeOptions.reduce<Record<string, string>>(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {}
);

function formatTransactionType(value: string) {
  return formatEnumLabel(value, transactionTypeLabels);
}

function formatStatementType(value: string) {
  return formatEnumLabel(value, statementTypeLabels);
}

function formatResolutionType(value: string) {
  return formatEnumLabel(value, resolutionTypeLabels);
}

function formatShareholderType(value: string) {
  return formatEnumLabel(value, shareholderTypeLabels);
}

function CompaniesScreen() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(() => {
    const parsed = parseIdParam(searchParams.get('companyId'));
    return parsed ?? null;
  });
  const [highlightedStatementId, setHighlightedStatementId] = useState<number | null>(null);
  const [highlightedResolutionId, setHighlightedResolutionId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CompanyFormState>(initialCompanyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const [shareholderDialog, setShareholderDialog] = useState<{
    open: boolean;
    mode: DialogMode;
    link: ShareholderLinkDto | null;
  }>({ open: false, mode: 'create', link: null });
  const [shareholderForm, setShareholderForm] = useState<ShareholderFormState>(emptyShareholderForm);
  const [shareholderError, setShareholderError] = useState<string | null>(null);
  const [shareholderSaving, setShareholderSaving] = useState(false);

  const [shareClassDialog, setShareClassDialog] = useState<{
    open: boolean;
    mode: DialogMode;
    shareClass: ShareClassDto | null;
  }>({ open: false, mode: 'create', shareClass: null });
  const [shareClassForm, setShareClassForm] = useState<ShareClassFormState>(emptyShareClassForm);
  const [shareClassError, setShareClassError] = useState<string | null>(null);
  const [shareClassSaving, setShareClassSaving] = useState(false);

  const [transactionDialog, setTransactionDialog] = useState<{
    open: boolean;
    mode: DialogMode;
    transaction: ShareTransactionDto | null;
  }>({ open: false, mode: 'create', transaction: null });
  const [transactionForm, setTransactionForm] = useState<ShareTransactionFormState>(
    emptyShareTransactionForm
  );
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [transactionSaving, setTransactionSaving] = useState(false);

  const [statementDialog, setStatementDialog] = useState<{
    open: boolean;
    mode: DialogMode;
    statement: CorporateStatementDto | null;
  }>({ open: false, mode: 'create', statement: null });
  const [statementForm, setStatementForm] = useState<CorporateStatementFormState>(
    emptyCorporateStatementForm
  );
  const [statementError, setStatementError] = useState<string | null>(null);
  const [statementSaving, setStatementSaving] = useState(false);
  const [expandedStatements, setExpandedStatements] = useState<Record<number, boolean>>({});

  const [resolutionDialog, setResolutionDialog] = useState<{
    open: boolean;
    mode: DialogMode;
    resolution: CorporateResolutionDto | null;
  }>({ open: false, mode: 'create', resolution: null });
  const [resolutionForm, setResolutionForm] = useState<CorporateResolutionFormState>(
    emptyCorporateResolutionForm
  );
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const [resolutionSaving, setResolutionSaving] = useState(false);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: AlertColor;
  }>({ open: false, message: '', severity: 'success' });

  const { data: companies, isLoading: isLoadingCompanies, isFetching: isFetchingCompanies } =
    useCompanies();

  const updateUrlParams = useCallback(
    (modifier: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      modifier(next);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    const paramId = parseIdParam(searchParams.get('companyId'));
    if (paramId !== null && paramId !== selectedCompanyId) {
      setSelectedCompanyId(paramId);
    }
  }, [searchParams, selectedCompanyId]);

  useEffect(() => {
    if (!selectedCompanyId && companies && companies.length > 0) {
      const firstId = companies[0].id;
      setSelectedCompanyId(firstId);
      setExpandedStatements({});
      updateUrlParams((params) => {
        params.set('companyId', String(firstId));
      });
    }
  }, [companies, selectedCompanyId, updateUrlParams]);

  useEffect(() => {
    const statementParam = parseIdParam(searchParams.get('statementId'));
    setHighlightedStatementId((prev) => (prev === statementParam ? prev : statementParam));

    const resolutionParam = parseIdParam(searchParams.get('resolutionId'));
    setHighlightedResolutionId((prev) => (prev === resolutionParam ? prev : resolutionParam));
  }, [searchParams]);

  useEffect(() => {
    setExpandedStatements({});
  }, [selectedCompanyId]);

  const { data: companyDetail, isLoading: isLoadingDetail } = useCompanyDetail(
    selectedCompanyId ?? undefined
  );

  useEffect(() => {
    if (!highlightedStatementId || !companyDetail) {
      return;
    }

    const exists = companyDetail.statements.some((statement) => statement.id === highlightedStatementId);
    if (exists && !expandedStatements[highlightedStatementId]) {
      setExpandedStatements((prev) => ({
        ...prev,
        [highlightedStatementId]: true
      }));
    }
  }, [highlightedStatementId, companyDetail, expandedStatements]);

  const openSnackbar = (message: string, severity: AlertColor = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const copyLinkToClipboard = async (url: string, successMessage: string) => {
    if (typeof navigator === 'undefined' || typeof document === 'undefined') {
      openSnackbar('Copie non disponible dans cet environnement.', 'error');
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      openSnackbar(successMessage, 'success');
    } catch (error) {
      console.error('Clipboard copy failed', error);
      openSnackbar('Impossible de copier le lien.', 'error');
    }
  };

  const handleSnackbarClose = (_event: unknown, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const createCompany = useCreateCompany((created: CompanyDetailDto) => {
    setDialogOpen(false);
    setForm(initialCompanyForm);
    setFormError(null);
    handleSelectCompany(created.id);
    openSnackbar('Entreprise créée.');
  });

  const deleteCompany = useDeleteCompany(selectedCompanyId ?? 0);

  const handleOpenCompanyDialog = () => {
    setForm(initialCompanyForm);
    setFormError(null);
    setDialogOpen(true);
  };

  const handleCompanyFormChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const refreshCompanyData = async (companyId: number) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['company', companyId] }),
      queryClient.invalidateQueries({ queryKey: ['companies'] })
    ]);
  };

  const handleSelectCompany = (companyId: number, options?: { preserveAnchors?: boolean }) => {
    setSelectedCompanyId(companyId);
    setExpandedStatements({});

    if (!options?.preserveAnchors) {
      setHighlightedStatementId(null);
      setHighlightedResolutionId(null);
      updateUrlParams((params) => {
        params.set('companyId', String(companyId));
        params.delete('statementId');
        params.delete('resolutionId');
      });
    } else {
      updateUrlParams((params) => {
        params.set('companyId', String(companyId));
      });
    }
  };

  const handleCreateCompany = async () => {
    if (!form.name.trim()) {
      setFormError('Le nom de la compagnie est requis.');
      return;
    }

    try {
      await createCompany.mutateAsync(toPayload(form));
    } catch (error) {
      setFormError(extractApiError(error) ?? "Impossible d'enregistrer la compagnie.");
    }
  };

  const handleDeleteCompany = async () => {
    if (!selectedCompanyId) {
      return;
    }

    const confirmed = window.confirm('Supprimer cette société ? Cette action est irréversible.');
    if (!confirmed) {
      return;
    }

    await deleteCompany.mutateAsync();
    setSelectedCompanyId(null);
    setHighlightedStatementId(null);
    setHighlightedResolutionId(null);
    updateUrlParams((params) => {
      params.delete('companyId');
      params.delete('statementId');
      params.delete('resolutionId');
    });
    openSnackbar('Entreprise supprimée.');
  };

  const activeCompany = useMemo(() => companyDetail ?? null, [companyDetail]);
  const isBusy = isLoadingCompanies || isFetchingCompanies;

  const sortedTransactions = useMemo(() => {
    if (!activeCompany) {
      return [] as ShareTransactionDto[];
    }
    return [...activeCompany.shareTransactions].sort((a, b) =>
      a.transactionDate < b.transactionDate ? 1 : -1
    );
  }, [activeCompany]);

  const sortedStatements = useMemo(() => {
    if (!activeCompany) {
      return [] as CompanyDetailDto['statements'];
    }
    return [...activeCompany.statements].sort((a, b) =>
      a.periodEnd < b.periodEnd ? 1 : -1
    );
  }, [activeCompany]);

  const sortedResolutions = useMemo(() => {
    if (!activeCompany) {
      return [] as CompanyDetailDto['resolutions'];
    }
    return [...activeCompany.resolutions].sort((a, b) =>
      a.resolutionDate < b.resolutionDate ? 1 : -1
    );
  }, [activeCompany]);

  const handleOpenShareholderDialog = (mode: DialogMode, link: ShareholderLinkDto | null = null) => {
    setShareholderDialog({ open: true, mode, link });
    setShareholderError(null);
    if (mode === 'edit' && link) {
      const normalizedType = link.shareholder.type === 'CORPORATION' ? 'CORPORATION' : 'PERSON';
      setShareholderForm({
        displayName: link.shareholder.displayName,
        type: normalizedType,
        contactEmail: link.shareholder.contactEmail ?? '',
        contactPhone: link.shareholder.contactPhone ?? '',
        role: link.role ?? '',
        votingPercent: link.votingPercent?.toString() ?? ''
      });
    } else {
      setShareholderForm(emptyShareholderForm);
    }
  };

  const handleShareholderInput = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setShareholderForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleShareholderSelect = (event: SelectChangeEvent<string>) => {
    const { value } = event.target;
    setShareholderForm((prev) => ({ ...prev, type: value === 'CORPORATION' ? 'CORPORATION' : 'PERSON' }));
  };

  const handleSaveShareholder = async () => {
    if (!selectedCompanyId) {
      return;
    }

    const votingPercent = parseNullableNumber(shareholderForm.votingPercent);
    if (shareholderForm.votingPercent.trim() && votingPercent === null) {
      setShareholderError('Pourcentage de vote invalide.');
      return;
    }

    if (shareholderDialog.mode === 'create' && !shareholderForm.displayName.trim()) {
      setShareholderError("Le nom de l'actionnaire est requis.");
      return;
    }

    try {
      setShareholderSaving(true);
      let successMessage = 'Actionnaire mis à jour.';
      if (shareholderDialog.mode === 'create') {
        await createShareholderLink(selectedCompanyId, {
          shareholder: {
            displayName: shareholderForm.displayName.trim(),
            type: shareholderForm.type,
            contactEmail: shareholderForm.contactEmail.trim() || null,
            contactPhone: shareholderForm.contactPhone.trim() || null
          },
          role: shareholderForm.role.trim() || null,
          votingPercent
        });
        successMessage = 'Actionnaire ajouté.';
      } else if (shareholderDialog.link) {
        const payload: ShareholderLinkUpdatePayload = {
          role: shareholderForm.role.trim() || null,
          votingPercent
        };

        const details: ShareholderUpdatePayload = {};
        const existing = shareholderDialog.link.shareholder;

        const trimmedName = shareholderForm.displayName.trim();
        if (trimmedName && trimmedName !== existing.displayName) {
          details.displayName = trimmedName;
        }

        const normalizedType = shareholderForm.type;
        if (normalizedType !== existing.type) {
          details.type = normalizedType;
        }

        const trimmedEmail = shareholderForm.contactEmail.trim();
        if (trimmedEmail !== (existing.contactEmail ?? '')) {
          details.contactEmail = trimmedEmail ? trimmedEmail : null;
        }

        const trimmedPhone = shareholderForm.contactPhone.trim();
        if (trimmedPhone !== (existing.contactPhone ?? '')) {
          details.contactPhone = trimmedPhone ? trimmedPhone : null;
        }

        if (Object.keys(details).length > 0) {
          payload.shareholder = details;
        }

        await updateShareholderLink(selectedCompanyId, shareholderDialog.link.id, payload);
      }
      await refreshCompanyData(selectedCompanyId);
      openSnackbar(successMessage);
      setShareholderDialog({ open: false, mode: 'create', link: null });
      setShareholderForm(emptyShareholderForm);
    } catch (error) {
      setShareholderError(extractApiError(error) ?? "Impossible d'enregistrer l'actionnaire.");
    } finally {
      setShareholderSaving(false);
    }
  };

  const handleDeleteShareholder = async (link: ShareholderLinkDto) => {
    if (!selectedCompanyId) {
      return;
    }
    const confirmed = window.confirm('Retirer cet actionnaire de la société ?');
    if (!confirmed) {
      return;
    }
    await deleteShareholderLink(selectedCompanyId, link.id);
    await refreshCompanyData(selectedCompanyId);
    openSnackbar('Actionnaire retiré.');
  };

  const handleOpenShareClassDialog = (mode: DialogMode, shareClass: ShareClassDto | null = null) => {
    setShareClassDialog({ open: true, mode, shareClass });
    setShareClassError(null);
    if (mode === 'edit' && shareClass) {
      setShareClassForm({
        code: shareClass.code,
        description: shareClass.description ?? '',
        hasVotingRights: shareClass.hasVotingRights,
        participatesInGrowth: shareClass.participatesInGrowth,
        dividendPolicy: shareClass.dividendPolicy ?? ''
      });
    } else {
      setShareClassForm(emptyShareClassForm);
    }
  };

  const handleShareClassInput = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setShareClassForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleShareClassToggle = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    setShareClassForm((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSaveShareClass = async () => {
    if (!selectedCompanyId) {
      return;
    }

    if (!shareClassForm.code.trim()) {
      setShareClassError('Le code de classe est requis.');
      return;
    }

    try {
      setShareClassSaving(true);
      let successMessage = "Classe d'actions mise à jour.";
      const payload = {
        code: shareClassForm.code.trim(),
        description: shareClassForm.description.trim() || null,
        hasVotingRights: shareClassForm.hasVotingRights,
        participatesInGrowth: shareClassForm.participatesInGrowth,
        dividendPolicy: shareClassForm.dividendPolicy.trim() || null
      };

      if (shareClassDialog.mode === 'create') {
        await createShareClass(selectedCompanyId, payload);
        successMessage = "Classe d'actions créée.";
      } else if (shareClassDialog.shareClass) {
        await updateShareClass(selectedCompanyId, shareClassDialog.shareClass.id, payload);
      }

      await refreshCompanyData(selectedCompanyId);
      openSnackbar(successMessage);
      setShareClassDialog({ open: false, mode: 'create', shareClass: null });
      setShareClassForm(emptyShareClassForm);
    } catch (error) {
      setShareClassError(extractApiError(error) ?? "Impossible d'enregistrer la classe d'actions.");
    } finally {
      setShareClassSaving(false);
    }
  };

  const handleDeleteShareClass = async (shareClass: ShareClassDto) => {
    if (!selectedCompanyId) {
      return;
    }
    const confirmed = window.confirm('Supprimer cette classe d’actions ?');
    if (!confirmed) {
      return;
    }
    await deleteShareClass(selectedCompanyId, shareClass.id);
    await refreshCompanyData(selectedCompanyId);
    openSnackbar("Classe d'actions supprimée.");
  };

  const handleOpenTransactionDialog = (
    mode: DialogMode,
    transaction: ShareTransactionDto | null = null
  ) => {
    setTransactionDialog({ open: true, mode, transaction });
    setTransactionError(null);
    if (activeCompany) {
      const defaultShareholder = activeCompany.shareholders[0]?.shareholder.id ?? '';
      const defaultShareClass = activeCompany.shareClasses[0]?.id ?? '';
      if (mode === 'create' || !transaction) {
        setTransactionForm({
          ...emptyShareTransactionForm,
          shareholderId: defaultShareholder ? String(defaultShareholder) : '',
          shareClassId: defaultShareClass ? String(defaultShareClass) : '',
          transactionDate: new Date().toISOString().slice(0, 10)
        });
      } else {
        setTransactionForm({
          shareholderId: transaction.shareholder?.id ? String(transaction.shareholder.id) : '',
          shareClassId: transaction.shareClass?.id ? String(transaction.shareClass.id) : '',
          type: transaction.type,
          transactionDate: transaction.transactionDate.slice(0, 10),
          quantity: transaction.quantity?.toString() ?? '',
          pricePerShare: transaction.pricePerShare?.toString() ?? '',
          considerationPaid: transaction.considerationPaid?.toString() ?? '',
          fairMarketValue: transaction.fairMarketValue?.toString() ?? '',
          notes: transaction.notes ?? ''
        });
      }
    }
  };

  const handleTransactionInput = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setTransactionForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleTransactionSelect = (event: SelectChangeEvent<string>) => {
    const { name, value } = event.target;
    setTransactionForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveTransaction = async () => {
    if (!selectedCompanyId) {
      return;
    }

    if (!transactionForm.shareholderId || !transactionForm.shareClassId) {
      setTransactionError('Sélectionne un actionnaire et une classe.');
      return;
    }

    const quantity = Number(transactionForm.quantity);
    if (!transactionForm.quantity.trim() || Number.isNaN(quantity) || quantity <= 0) {
      setTransactionError('La quantité doit être un nombre positif.');
      return;
    }

    const payload = {
      shareholderId: Number(transactionForm.shareholderId),
      shareClassId: Number(transactionForm.shareClassId),
  type: transactionForm.type || 'ISSUANCE',
      transactionDate: transactionForm.transactionDate,
      quantity,
      pricePerShare: parseNullableNumber(transactionForm.pricePerShare),
      considerationPaid: parseNullableNumber(transactionForm.considerationPaid),
      fairMarketValue: parseNullableNumber(transactionForm.fairMarketValue),
      notes: transactionForm.notes.trim() || null
    };

    try {
      setTransactionSaving(true);
      let successMessage = 'Transaction mise à jour.';
      if (transactionDialog.mode === 'create') {
        await createShareTransaction(selectedCompanyId, payload);
        successMessage = 'Transaction enregistrée.';
      } else if (transactionDialog.transaction) {
        await updateShareTransaction(selectedCompanyId, transactionDialog.transaction.id, payload);
      }
      await refreshCompanyData(selectedCompanyId);
      openSnackbar(successMessage);
      setTransactionDialog({ open: false, mode: 'create', transaction: null });
      setTransactionForm(emptyShareTransactionForm);
    } catch (error) {
      setTransactionError(
        extractApiError(error) ?? "Impossible d'enregistrer la transaction."
      );
    } finally {
      setTransactionSaving(false);
    }
  };

  const handleDeleteTransaction = async (transaction: ShareTransactionDto) => {
    if (!selectedCompanyId) {
      return;
    }
    const confirmed = window.confirm('Supprimer cette transaction sur actions ?');
    if (!confirmed) {
      return;
    }
    await deleteShareTransaction(selectedCompanyId, transaction.id);
    await refreshCompanyData(selectedCompanyId);
    openSnackbar('Transaction supprimée.');
  };

  const resetStatementForm = () => {
    setStatementForm({
      ...emptyCorporateStatementForm,
      periodStart: new Date().toISOString().slice(0, 10),
      periodEnd: new Date().toISOString().slice(0, 10),
      lines: []
    });
  };

  const handleOpenStatementDialog = (
    mode: DialogMode,
    statement: CorporateStatementDto | null = null
  ) => {
    setStatementDialog({ open: true, mode, statement });
    setStatementError(null);
    if (mode === 'edit' && statement) {
      setStatementForm({
        statementType: statement.statementType,
        periodStart: statement.periodStart.slice(0, 10),
        periodEnd: statement.periodEnd.slice(0, 10),
        isAudited: statement.isAudited,
        totalAssets: statement.totals.assets?.toString() ?? '',
        totalLiabilities: statement.totals.liabilities?.toString() ?? '',
        totalEquity: statement.totals.equity?.toString() ?? '',
        totalRevenue: statement.totals.revenue?.toString() ?? '',
        totalExpenses: statement.totals.expenses?.toString() ?? '',
        netIncome: statement.totals.netIncome?.toString() ?? '',
        metadata: statement.metadata ?? '',
        lines: statement.lines.map((line) => ({
          id: line.id,
          category: line.category,
          label: line.label,
          amount: line.amount?.toString() ?? '',
          metadata: line.metadata ?? ''
        }))
      });
    } else {
      resetStatementForm();
    }
  };

  const closeStatementDialog = () => {
    setStatementDialog({ open: false, mode: 'create', statement: null });
    setStatementError(null);
    resetStatementForm();
  };

  const handleStatementInput = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setStatementForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleStatementToggle = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    setStatementForm((prev) => ({ ...prev, [name]: checked }));
  };

  const handleStatementSelect = (event: SelectChangeEvent<string>) => {
    const { name, value } = event.target;
    setStatementForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddStatementLine = () => {
    setStatementForm((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          category: '',
          label: '',
          amount: '',
          metadata: ''
        }
      ]
    }));
  };

  const handleStatementLineChange = (
    index: number,
    field: keyof CorporateStatementLineFormState,
    value: string
  ) => {
    setStatementForm((prev) => {
      const lines = prev.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line
      );
      return { ...prev, lines };
    });
  };

  const handleRemoveStatementLine = (index: number) => {
    setStatementForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, lineIndex) => lineIndex !== index)
    }));
  };

  const handleSaveStatement = async () => {
    if (!selectedCompanyId) {
      return;
    }

    if (!statementForm.statementType.trim()) {
      setStatementError("Le type d'état est requis.");
      return;
    }

    if (!statementForm.periodStart || !statementForm.periodEnd) {
      setStatementError('La période doit être complétée.');
      return;
    }

    const startDate = new Date(statementForm.periodStart);
    const endDate = new Date(statementForm.periodEnd);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
      setStatementError('Dates de période invalides.');
      return;
    }

    if (endDate < startDate) {
      setStatementError('La fin de période doit être postérieure au début.');
      return;
    }

    const payload: CorporateStatementPayload = {
      statementType: statementForm.statementType,
      periodStart: statementForm.periodStart,
      periodEnd: statementForm.periodEnd,
      isAudited: statementForm.isAudited
    };

    const numericEntries = [
      ['totalAssets', statementForm.totalAssets],
      ['totalLiabilities', statementForm.totalLiabilities],
      ['totalEquity', statementForm.totalEquity],
      ['totalRevenue', statementForm.totalRevenue],
      ['totalExpenses', statementForm.totalExpenses],
      ['netIncome', statementForm.netIncome]
    ] as const;

    numericEntries.forEach(([key, rawValue]) => {
      const parsed = parseOptionalNumber(rawValue);
      if (parsed === undefined) {
        return;
      }
      switch (key) {
        case 'totalAssets':
          payload.totalAssets = parsed;
          break;
        case 'totalLiabilities':
          payload.totalLiabilities = parsed;
          break;
        case 'totalEquity':
          payload.totalEquity = parsed;
          break;
        case 'totalRevenue':
          payload.totalRevenue = parsed;
          break;
        case 'totalExpenses':
          payload.totalExpenses = parsed;
          break;
        case 'netIncome':
          payload.netIncome = parsed;
          break;
        default:
          break;
      }
    });

    const normalizedLines: CorporateStatementLinePayload[] = [];
    let lineValidationError = false;
    statementForm.lines.forEach((line, index) => {
      const category = line.category.trim();
      const label = line.label.trim();
      const amountText = line.amount.trim();
      const metadata = line.metadata.trim();
      const hasContent = category || label || amountText || metadata;

      if (!hasContent) {
        return;
      }

      if (!category || !label || !amountText) {
        lineValidationError = true;
        return;
      }

      const amount = Number(amountText);
      if (!Number.isFinite(amount)) {
        lineValidationError = true;
        return;
      }

      normalizedLines.push({
        category,
        label,
        amount,
        orderIndex: index,
        metadata: metadata ? metadata : null
      });
    });

    if (lineValidationError) {
      setStatementError('Complète les lignes (catégorie, libellé et montant numérique).');
      return;
    }

    if (normalizedLines.length > 0) {
      payload.lines = normalizedLines;
    } else if (statementDialog.mode === 'edit') {
      payload.lines = [];
    }

    const metadataValue = statementForm.metadata.trim();
    if (metadataValue) {
      payload.metadata = metadataValue;
    } else if (statementDialog.mode === 'edit') {
      payload.metadata = null;
    }

    try {
      setStatementSaving(true);
      let successMessage = 'État financier mis à jour.';
      if (statementDialog.mode === 'create') {
  await createCorporateStatement(selectedCompanyId, payload);
        successMessage = 'État financier créé.';
      } else if (statementDialog.statement) {
        await updateCorporateStatement(
          selectedCompanyId,
          statementDialog.statement.id,
          payload as CorporateStatementUpdatePayload
        );
      }
      await refreshCompanyData(selectedCompanyId);
      openSnackbar(successMessage);
      closeStatementDialog();
    } catch (error) {
      setStatementError(
        extractApiError(error) ?? "Impossible d'enregistrer l'état financier."
      );
    } finally {
      setStatementSaving(false);
    }
  };

  const handleDeleteStatement = async (statement: CorporateStatementDto) => {
    if (!selectedCompanyId) {
      return;
    }
    const confirmed = window.confirm('Supprimer cet état financier ?');
    if (!confirmed) {
      return;
    }
    if (highlightedStatementId === statement.id) {
      setHighlightedStatementId(null);
      updateUrlParams((params) => {
        params.delete('statementId');
      });
    }
    await deleteCorporateStatement(selectedCompanyId, statement.id);
    await refreshCompanyData(selectedCompanyId);
    openSnackbar('État financier supprimé.');
  };

  const handleCopyStatementLink = async (statement: CorporateStatementDto) => {
    if (!selectedCompanyId) {
      return;
    }
    if (typeof window === 'undefined') {
      openSnackbar('Copie non disponible dans cet environnement.', 'error');
      return;
    }
    const url = buildCompanyLink(window.location.origin, selectedCompanyId, {
      statementId: statement.id
    });
    await copyLinkToClipboard(url, "Lien de l'état copié.");
  };

  const toggleStatementExpansion = (statementId: number) => {
    setExpandedStatements((prev) => ({
      ...prev,
      [statementId]: !prev[statementId]
    }));
  };

  const resetResolutionForm = () => {
    setResolutionForm({
      ...emptyCorporateResolutionForm,
      resolutionDate: new Date().toISOString().slice(0, 10)
    });
  };

  const handleOpenResolutionDialog = (
    mode: DialogMode,
    resolution: CorporateResolutionDto | null = null
  ) => {
    setResolutionDialog({ open: true, mode, resolution });
    setResolutionError(null);
    if (mode === 'edit' && resolution) {
      setResolutionForm({
        type: resolution.type,
        title: resolution.title,
        resolutionDate: resolution.resolutionDate.slice(0, 10),
        body: resolution.body ?? '',
        metadata: resolution.metadata ?? ''
      });
    } else {
      resetResolutionForm();
    }
  };

  const closeResolutionDialog = () => {
    setResolutionDialog({ open: false, mode: 'create', resolution: null });
    setResolutionError(null);
    resetResolutionForm();
  };

  const handleResolutionInput = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setResolutionForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleResolutionSelect = (event: SelectChangeEvent<string>) => {
    const { name, value } = event.target;
    setResolutionForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveResolution = async () => {
    if (!selectedCompanyId) {
      return;
    }

    if (!resolutionForm.type.trim() || !resolutionForm.title.trim()) {
      setResolutionError('Le type et le titre sont requis.');
      return;
    }

    if (!resolutionForm.resolutionDate) {
      setResolutionError('La date de résolution est requise.');
      return;
    }

    const payload: CorporateResolutionPayload = {
      type: resolutionForm.type,
      title: resolutionForm.title.trim(),
      resolutionDate: resolutionForm.resolutionDate
    };

    const bodyValue = resolutionForm.body.trim();
    if (bodyValue) {
      payload.body = bodyValue;
    } else if (resolutionDialog.mode === 'edit') {
      payload.body = null;
    }

    const metadataValue = resolutionForm.metadata.trim();
    if (metadataValue) {
      payload.metadata = metadataValue;
    } else if (resolutionDialog.mode === 'edit') {
      payload.metadata = null;
    }

    try {
      setResolutionSaving(true);
      let successMessage = 'Résolution mise à jour.';
      if (resolutionDialog.mode === 'create') {
  await createCorporateResolution(selectedCompanyId, payload);
        successMessage = 'Résolution enregistrée.';
      } else if (resolutionDialog.resolution) {
        await updateCorporateResolution(
          selectedCompanyId,
          resolutionDialog.resolution.id,
          payload as CorporateResolutionUpdatePayload
        );
      }
      await refreshCompanyData(selectedCompanyId);
      openSnackbar(successMessage);
      closeResolutionDialog();
    } catch (error) {
      setResolutionError(
        extractApiError(error) ?? "Impossible d'enregistrer la résolution."
      );
    } finally {
      setResolutionSaving(false);
    }
  };

  const handleDeleteResolution = async (resolution: CorporateResolutionDto) => {
    if (!selectedCompanyId) {
      return;
    }
    const confirmed = window.confirm('Supprimer cette résolution ?');
    if (!confirmed) {
      return;
    }
    if (highlightedResolutionId === resolution.id) {
      setHighlightedResolutionId(null);
      updateUrlParams((params) => {
        params.delete('resolutionId');
      });
    }
    await deleteCorporateResolution(selectedCompanyId, resolution.id);
    await refreshCompanyData(selectedCompanyId);
    openSnackbar('Résolution supprimée.');
  };

  const handleCopyResolutionLink = async (resolution: CorporateResolutionDto) => {
    if (!selectedCompanyId) {
      return;
    }
    if (typeof window === 'undefined') {
      openSnackbar('Copie non disponible dans cet environnement.', 'error');
      return;
    }
    const url = buildCompanyLink(window.location.origin, selectedCompanyId, {
      resolutionId: resolution.id
    });
    await copyLinkToClipboard(url, 'Lien de la résolution copié.');
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Entreprises</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCompanyDialog}>
          Nouvelle entreprise
        </Button>
      </Stack>

      {isBusy && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper elevation={1} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Mes compagnies
            </Typography>
            {companies && companies.length === 0 && !isBusy ? (
              <Typography color="text.secondary">Aucune compagnie enregistrée.</Typography>
            ) : (
              <List sx={{ maxHeight: 400, overflowY: 'auto' }}>
                {companies?.map((company) => (
                  <ListItemButton
                    key={company.id}
                    selected={company.id === selectedCompanyId}
                    onClick={() => handleSelectCompany(company.id)}
                  >
                    <ListItemText
                      primary={company.name}
                      secondary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <HouseIcon fontSize="small" />
                          <Typography variant="caption">
                            {company.counts.properties} immeubles
                          </Typography>
                        </Stack>
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          {isLoadingDetail && selectedCompanyId ? <LinearProgress sx={{ mb: 2 }} /> : null}

          {activeCompany ? (
            <Stack spacing={3}>
              <Paper elevation={1} sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h5">{activeCompany.name}</Typography>
                  <Button
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={handleDeleteCompany}
                    disabled={deleteCompany.isPending}
                  >
                    Supprimer
                  </Button>
                </Stack>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CalendarMonthIcon fontSize="small" />
                      <Typography variant="body2">
                        Fin d&apos;exercice: {formatDate(activeCompany.fiscalYearEnd)}
                      </Typography>
                    </Stack>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2">Province: {activeCompany.province ?? '—'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2">NEQ: {activeCompany.neq ?? '—'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      {activeCompany.notes || 'Aucune note.'}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              <Paper elevation={1} sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <PeopleIcon fontSize="small" />
                    <Typography variant="h6">Actionnaires</Typography>
                  </Stack>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenShareholderDialog('create')}
                  >
                    Ajouter
                  </Button>
                </Stack>
                {activeCompany.shareholders.length === 0 ? (
                  <Typography color="text.secondary">Aucun actionnaire lié.</Typography>
                ) : (
                  <Stack spacing={2}>
                    {activeCompany.shareholders.map((link) => (
                      <Box key={link.id} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="subtitle1">{link.shareholder.displayName}</Typography>
                            <Chip size="small" label={formatShareholderType(link.shareholder.type)} />
                          </Stack>
                          <Stack direction="row" spacing={1}>
                            <Tooltip title="Modifier le lien">
                              <IconButton size="small" onClick={() => handleOpenShareholderDialog('edit', link)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Supprimer le lien">
                              <IconButton size="small" onClick={() => handleDeleteShareholder(link)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {link.role || 'Rôle non précisé'}
                        </Typography>
                        <Typography variant="body2">
                          Droits de vote: {formatNumber(link.votingPercent, 2)}%
                        </Typography>
                        {(link.shareholder.contactEmail || link.shareholder.contactPhone) && (
                          <Typography variant="body2" color="text.secondary">
                            {link.shareholder.contactEmail ?? '—'} • {link.shareholder.contactPhone ?? '—'}
                          </Typography>
                        )}
                        <Divider sx={{ mt: 1 }} />
                      </Box>
                    ))}
                  </Stack>
                )}
              </Paper>

              <Paper elevation={1} sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Classes d&apos;actions</Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenShareClassDialog('create')}
                  >
                    Ajouter
                  </Button>
                </Stack>
                {activeCompany.shareClasses.length === 0 ? (
                  <Typography color="text.secondary">Aucune classe définie.</Typography>
                ) : (
                  <Stack spacing={2}>
                    {activeCompany.shareClasses.map((shareClass) => (
                      <Box key={shareClass.id} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="subtitle1">{shareClass.code}</Typography>
                            {shareClass.description ? (
                              <Typography variant="body2" color="text.secondary">
                                {shareClass.description}
                              </Typography>
                            ) : null}
                          </Stack>
                          <Stack direction="row" spacing={1}>
                            <Tooltip title="Modifier la classe">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenShareClassDialog('edit', shareClass)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Supprimer la classe">
                              <IconButton size="small" onClick={() => handleDeleteShareClass(shareClass)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Stack>
                        <Stack direction="row" spacing={1}>
                          <Chip
                            size="small"
                            color={shareClass.hasVotingRights ? 'primary' : 'default'}
                            label={shareClass.hasVotingRights ? 'Droits de vote' : 'Sans vote'}
                          />
                          <Chip
                            size="small"
                            color={shareClass.participatesInGrowth ? 'primary' : 'default'}
                            label={
                              shareClass.participatesInGrowth
                                ? 'Participation à la croissance'
                                : 'Croissance limitée'
                            }
                          />
                        </Stack>
                        {shareClass.dividendPolicy ? (
                          <Typography variant="body2">Politique: {shareClass.dividendPolicy}</Typography>
                        ) : null}
                        <Divider sx={{ mt: 1 }} />
                      </Box>
                    ))}
                  </Stack>
                )}
              </Paper>

              <Paper elevation={1} sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Transactions sur actions</Typography>
                  <Tooltip
                    title={
                      activeCompany.shareholders.length && activeCompany.shareClasses.length
                        ? ''
                        : 'Ajoute au moins un actionnaire et une classe.'
                    }
                  >
                    <span>
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => handleOpenTransactionDialog('create')}
                        disabled={
                          activeCompany.shareholders.length === 0 ||
                          activeCompany.shareClasses.length === 0
                        }
                      >
                        Ajouter
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>
                {sortedTransactions.length === 0 ? (
                  <Typography color="text.secondary">Aucune transaction enregistrée.</Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Actionnaire</TableCell>
                        <TableCell>Classe</TableCell>
                        <TableCell align="right">Quantité</TableCell>
                        <TableCell align="right">Valeur FMV</TableCell>
                        <TableCell align="right">Contrepartie</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedTransactions.map((tx) => (
                        <TableRow key={tx.id} hover>
                          <TableCell>{formatDate(tx.transactionDate)}</TableCell>
                          <TableCell>{formatTransactionType(tx.type)}</TableCell>
                          <TableCell>{tx.shareholder?.displayName ?? '—'}</TableCell>
                          <TableCell>{tx.shareClass?.code ?? '—'}</TableCell>
                          <TableCell align="right">{formatNumber(tx.quantity)}</TableCell>
                          <TableCell align="right">
                            {formatCurrency(tx.fairMarketValue)}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(tx.considerationPaid)}
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Modifier">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenTransactionDialog('edit', tx)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Supprimer">
                              <IconButton size="small" onClick={() => handleDeleteTransaction(tx)}>
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

              <Paper elevation={1} sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <BalanceIcon fontSize="small" />
                    <Typography variant="h6">États financiers</Typography>
                  </Stack>
                  <Button size="small" startIcon={<AddIcon />} onClick={() => handleOpenStatementDialog('create')}>
                    Ajouter
                  </Button>
                </Stack>
                {sortedStatements.length === 0 ? (
                  <Typography color="text.secondary">Aucun état financier disponible.</Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" />
                        <TableCell>Période</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="right">Actifs</TableCell>
                        <TableCell align="right">Capitaux propres</TableCell>
                        <TableCell align="right">Bénéfice net</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedStatements.map((statement) => {
                        const isHighlightedStatement = highlightedStatementId === statement.id;
                        return (
                          <Fragment key={statement.id}>
                            <TableRow
                              hover
                              sx={
                                isHighlightedStatement
                                  ? (theme) => ({ backgroundColor: theme.palette.action.hover })
                                  : undefined
                              }
                            >
                              <TableCell padding="checkbox">
                                {statement.lines.length > 0 ? (
                                  <IconButton
                                    size="small"
                                    onClick={() => toggleStatementExpansion(statement.id)}
                                  >
                                    {expandedStatements[statement.id] ? (
                                      <KeyboardArrowUpIcon fontSize="small" />
                                    ) : (
                                      <KeyboardArrowDownIcon fontSize="small" />
                                    )}
                                  </IconButton>
                                ) : (
                                  <IconButton size="small" disabled>
                                    <KeyboardArrowDownIcon fontSize="small" />
                                  </IconButton>
                                )}
                              </TableCell>
                              <TableCell>{formatDate(statement.periodEnd)}</TableCell>
                              <TableCell>{formatStatementType(statement.statementType)}</TableCell>
                              <TableCell align="right">{formatCurrency(statement.totals.assets)}</TableCell>
                              <TableCell align="right">{formatCurrency(statement.totals.equity)}</TableCell>
                              <TableCell align="right">{formatCurrency(statement.totals.netIncome)}</TableCell>
                              <TableCell align="right">
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                <Tooltip title="Modifier">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleOpenStatementDialog('edit', statement)}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Supprimer">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteStatement(statement)}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Copier le lien">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleCopyStatementLink(statement)}
                                  >
                                    <ContentCopyIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Télécharger">
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      downloadJson(
                                        `etat-${activeCompany.name}-${statement.periodEnd.slice(0, 10)}.json`,
                                        statement
                                      )
                                    }
                                  >
                                    <DownloadIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell colSpan={7} sx={{ py: 0 }}>
                              <Collapse
                                in={Boolean(expandedStatements[statement.id]) && statement.lines.length > 0}
                                timeout="auto"
                                unmountOnExit
                              >
                                  <Box
                                    sx={{
                                      px: 4,
                                      py: 2,
                                      borderLeft: 4,
                                      borderStyle: 'solid',
                                      borderColor: isHighlightedStatement ? 'primary.main' : 'transparent',
                                      bgcolor: isHighlightedStatement ? 'action.hover' : undefined
                                    }}
                                  >
                                    <Typography variant="subtitle2" gutterBottom>
                                      Détail de l'état
                                    </Typography>
                                    <Table size="small">
                                      <TableHead>
                                        <TableRow>
                                          <TableCell>Catégorie</TableCell>
                                          <TableCell>Libellé</TableCell>
                                          <TableCell align="right">Montant</TableCell>
                                          <TableCell>Métadonnées</TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {statement.lines.map((line) => (
                                          <TableRow key={line.id}>
                                            <TableCell>{line.category}</TableCell>
                                            <TableCell>{line.label}</TableCell>
                                            <TableCell align="right">{formatNumber(line.amount, 2)}</TableCell>
                                            <TableCell>{line.metadata ?? '—'}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </Box>
                              </Collapse>
                              </TableCell>
                            </TableRow>
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </Paper>

              <Paper elevation={1} sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <PaidIcon fontSize="small" />
                    <Typography variant="h6">Résolutions</Typography>
                  </Stack>
                  <Button size="small" startIcon={<AddIcon />} onClick={() => handleOpenResolutionDialog('create')}>
                    Ajouter
                  </Button>
                </Stack>
                {sortedResolutions.length === 0 ? (
                  <Typography color="text.secondary">Aucune résolution enregistrée.</Typography>
                ) : (
                  <Stack spacing={2}>
                    {sortedResolutions.map((resolution) => {
                      const isHighlightedResolution = highlightedResolutionId === resolution.id;
                      return (
                        <Box
                          key={resolution.id}
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.5,
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: isHighlightedResolution ? 'primary.main' : 'transparent',
                            bgcolor: isHighlightedResolution ? 'action.hover' : 'transparent',
                            transition: 'background-color 0.2s ease'
                          }}
                        >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="subtitle1">{resolution.title}</Typography>
                            <Chip size="small" label={formatResolutionType(resolution.type)} />
                          </Stack>
                          <Stack direction="row" spacing={1}>
                            <Tooltip title="Modifier">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenResolutionDialog('edit', resolution)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Supprimer">
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteResolution(resolution)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Copier le lien">
                              <IconButton
                                size="small"
                                onClick={() => handleCopyResolutionLink(resolution)}
                              >
                                <ContentCopyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Télécharger">
                              <IconButton
                                size="small"
                                onClick={() =>
                                  downloadJson(
                                    `resolution-${activeCompany.name}-${resolution.resolutionDate.slice(0, 10)}.json`,
                                    resolution
                                  )
                                }
                              >
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(resolution.resolutionDate)}
                        </Typography>
                        {resolution.body ? (
                          <Typography variant="body2">{resolution.body}</Typography>
                        ) : null}
                        <Divider sx={{ mt: 1 }} />
                      </Box>
                      );
                    })}
                  </Stack>
                )}
              </Paper>
            </Stack>
          ) : (
            <Paper elevation={1} sx={{ p: 3 }}>
              <Typography color="text.secondary">
                Sélectionne une entreprise pour voir les détails.
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouvelle entreprise</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <TextField
              label="Nom"
              name="name"
              value={form.name}
              onChange={handleCompanyFormChange}
              required
              autoFocus
            />
            <TextField
              label="Province"
              name="province"
              value={form.province}
              onChange={handleCompanyFormChange}
            />
            <TextField
              label="Fin d'exercice"
              name="fiscalYearEnd"
              type="date"
              value={form.fiscalYearEnd}
              onChange={handleCompanyFormChange}
              InputLabelProps={{ shrink: true }}
            />
            <TextField label="NEQ" name="neq" value={form.neq} onChange={handleCompanyFormChange} />
            <TextField
              label="Notes"
              name="notes"
              value={form.notes}
              onChange={handleCompanyFormChange}
              multiline
              minRows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleCreateCompany} variant="contained" disabled={createCompany.isPending}>
            Créer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={shareholderDialog.open}
        onClose={() => setShareholderDialog({ open: false, mode: 'create', link: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {shareholderDialog.mode === 'create' ? 'Ajouter un actionnaire' : 'Modifier le lien'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {shareholderError ? <Alert severity="error">{shareholderError}</Alert> : null}
            <TextField
              label="Nom"
              name="displayName"
              value={shareholderForm.displayName}
              onChange={handleShareholderInput}
              required
            />
            <FormControl fullWidth>
              <InputLabel id="shareholder-type-label">Type</InputLabel>
              <Select
                labelId="shareholder-type-label"
                label="Type"
                name="type"
                value={shareholderForm.type}
                onChange={handleShareholderSelect}
              >
                {shareholderTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Courriel"
              name="contactEmail"
              value={shareholderForm.contactEmail}
              onChange={handleShareholderInput}
            />
            <TextField
              label="Téléphone"
              name="contactPhone"
              value={shareholderForm.contactPhone}
              onChange={handleShareholderInput}
            />
            <TextField
              label="Rôle"
              name="role"
              value={shareholderForm.role}
              onChange={handleShareholderInput}
            />
            <TextField
              label="Droits de vote (%)"
              name="votingPercent"
              value={shareholderForm.votingPercent}
              onChange={handleShareholderInput}
              type="number"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareholderDialog({ open: false, mode: 'create', link: null })}>
            Annuler
          </Button>
          <Button onClick={handleSaveShareholder} variant="contained" disabled={shareholderSaving}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={shareClassDialog.open}
        onClose={() => setShareClassDialog({ open: false, mode: 'create', shareClass: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {shareClassDialog.mode === 'create'
            ? "Ajouter une classe d'actions"
            : "Modifier la classe d'actions"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {shareClassError ? <Alert severity="error">{shareClassError}</Alert> : null}
            <TextField
              label="Code"
              name="code"
              value={shareClassForm.code}
              onChange={handleShareClassInput}
              required
            />
            <TextField
              label="Description"
              name="description"
              value={shareClassForm.description}
              onChange={handleShareClassInput}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={shareClassForm.hasVotingRights}
                  onChange={handleShareClassToggle}
                  name="hasVotingRights"
                />
              }
              label="Droits de vote"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={shareClassForm.participatesInGrowth}
                  onChange={handleShareClassToggle}
                  name="participatesInGrowth"
                />
              }
              label="Participe à la croissance"
            />
            <TextField
              label="Politique de dividende"
              name="dividendPolicy"
              value={shareClassForm.dividendPolicy}
              onChange={handleShareClassInput}
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareClassDialog({ open: false, mode: 'create', shareClass: null })}>
            Annuler
          </Button>
          <Button onClick={handleSaveShareClass} variant="contained" disabled={shareClassSaving}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={transactionDialog.open}
        onClose={() => setTransactionDialog({ open: false, mode: 'create', transaction: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {transactionDialog.mode === 'create'
            ? 'Ajouter une transaction sur actions'
            : 'Modifier la transaction'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {transactionError ? <Alert severity="error">{transactionError}</Alert> : null}
            <FormControl fullWidth>
              <InputLabel id="shareholder-select-label">Actionnaire</InputLabel>
              <Select
                labelId="shareholder-select-label"
                label="Actionnaire"
                name="shareholderId"
                value={transactionForm.shareholderId}
                onChange={handleTransactionSelect}
              >
                {activeCompany?.shareholders.map((link) => (
                  <MenuItem key={link.id} value={link.shareholder.id}>
                    {link.shareholder.displayName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="share-class-select-label">Classe</InputLabel>
              <Select
                labelId="share-class-select-label"
                label="Classe"
                name="shareClassId"
                value={transactionForm.shareClassId}
                onChange={handleTransactionSelect}
              >
                {activeCompany?.shareClasses.map((shareClass) => (
                  <MenuItem key={shareClass.id} value={shareClass.id}>
                    {shareClass.code}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                Sélectionne la combinaison actionnaire / classe concernée.
              </FormHelperText>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="transaction-type-label">Type</InputLabel>
              <Select
                labelId="transaction-type-label"
                label="Type"
                name="type"
                value={transactionForm.type}
                onChange={handleTransactionSelect}
              >
                {transactionTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Date"
              name="transactionDate"
              type="date"
              value={transactionForm.transactionDate}
              onChange={handleTransactionInput}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Quantité"
              name="quantity"
              type="number"
              value={transactionForm.quantity}
              onChange={handleTransactionInput}
              required
            />
            <TextField
              label="Prix par action"
              name="pricePerShare"
              type="number"
              value={transactionForm.pricePerShare}
              onChange={handleTransactionInput}
            />
            <TextField
              label="Contrepartie"
              name="considerationPaid"
              type="number"
              value={transactionForm.considerationPaid}
              onChange={handleTransactionInput}
            />
            <TextField
              label="Valeur marchande"
              name="fairMarketValue"
              type="number"
              value={transactionForm.fairMarketValue}
              onChange={handleTransactionInput}
            />
            <TextField
              label="Notes"
              name="notes"
              value={transactionForm.notes}
              onChange={handleTransactionInput}
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransactionDialog({ open: false, mode: 'create', transaction: null })}>
            Annuler
          </Button>
          <Button onClick={handleSaveTransaction} variant="contained" disabled={transactionSaving}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={statementDialog.open} onClose={closeStatementDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {statementDialog.mode === 'create'
            ? 'Ajouter un état financier'
            : "Modifier l'état financier"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {statementError ? <Alert severity="error">{statementError}</Alert> : null}
            <FormControl fullWidth>
              <InputLabel id="statement-type-label">Type</InputLabel>
              <Select
                labelId="statement-type-label"
                label="Type"
                name="statementType"
                value={statementForm.statementType}
                onChange={handleStatementSelect}
              >
                {statementTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Début de période"
                  name="periodStart"
                  type="date"
                  value={statementForm.periodStart}
                  onChange={handleStatementInput}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Fin de période"
                  name="periodEnd"
                  type="date"
                  value={statementForm.periodEnd}
                  onChange={handleStatementInput}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
            </Grid>
            <FormControlLabel
              control={
                <Switch
                  checked={statementForm.isAudited}
                  onChange={handleStatementToggle}
                  name="isAudited"
                />
              }
              label="États audités"
            />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Total des actifs"
                  name="totalAssets"
                  type="number"
                  value={statementForm.totalAssets}
                  onChange={handleStatementInput}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Total des passifs"
                  name="totalLiabilities"
                  type="number"
                  value={statementForm.totalLiabilities}
                  onChange={handleStatementInput}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Capitaux propres"
                  name="totalEquity"
                  type="number"
                  value={statementForm.totalEquity}
                  onChange={handleStatementInput}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Revenus"
                  name="totalRevenue"
                  type="number"
                  value={statementForm.totalRevenue}
                  onChange={handleStatementInput}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Dépenses"
                  name="totalExpenses"
                  type="number"
                  value={statementForm.totalExpenses}
                  onChange={handleStatementInput}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Bénéfice net"
                  name="netIncome"
                  type="number"
                  value={statementForm.netIncome}
                  onChange={handleStatementInput}
                />
              </Grid>
            </Grid>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1">Postes détaillés</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={handleAddStatementLine}>
                  Ajouter une ligne
                </Button>
              </Stack>
              {statementForm.lines.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Ajoute des lignes pour ventiler les montants (facultatif).
                </Typography>
              ) : (
                <Stack spacing={2}>
                  {statementForm.lines.map((line, index) => (
                    <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Catégorie"
                            value={line.category}
                            onChange={(event) =>
                              handleStatementLineChange(index, 'category', event.target.value)
                            }
                            required
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Libellé"
                            value={line.label}
                            onChange={(event) =>
                              handleStatementLineChange(index, 'label', event.target.value)
                            }
                            required
                          />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <TextField
                            label="Montant"
                            value={line.amount}
                            type="number"
                            onChange={(event) =>
                              handleStatementLineChange(index, 'amount', event.target.value)
                            }
                            required
                          />
                        </Grid>
                        <Grid item xs={12} sm={1} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Tooltip title="Supprimer la ligne">
                            <span>
                              <IconButton size="small" onClick={() => handleRemoveStatementLine(index)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            label="Notes / métadonnées"
                            value={line.metadata}
                            onChange={(event) =>
                              handleStatementLineChange(index, 'metadata', event.target.value)
                            }
                            multiline
                            minRows={2}
                          />
                        </Grid>
                      </Grid>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Stack>
            <TextField
              label="Métadonnées"
              name="metadata"
              value={statementForm.metadata}
              onChange={handleStatementInput}
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeStatementDialog}>Annuler</Button>
          <Button onClick={handleSaveStatement} variant="contained" disabled={statementSaving}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={resolutionDialog.open} onClose={closeResolutionDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {resolutionDialog.mode === 'create'
            ? 'Ajouter une résolution'
            : 'Modifier la résolution'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {resolutionError ? <Alert severity="error">{resolutionError}</Alert> : null}
            <FormControl fullWidth>
              <InputLabel id="resolution-type-label">Type</InputLabel>
              <Select
                labelId="resolution-type-label"
                label="Type"
                name="type"
                value={resolutionForm.type}
                onChange={handleResolutionSelect}
              >
                {resolutionTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Titre"
              name="title"
              value={resolutionForm.title}
              onChange={handleResolutionInput}
              required
            />
            <TextField
              label="Date"
              name="resolutionDate"
              type="date"
              value={resolutionForm.resolutionDate}
              onChange={handleResolutionInput}
              InputLabelProps={{ shrink: true }}
              required
            />
            <TextField
              label="Corps"
              name="body"
              value={resolutionForm.body}
              onChange={handleResolutionInput}
              multiline
              minRows={3}
            />
            <TextField
              label="Métadonnées"
              name="metadata"
              value={resolutionForm.metadata}
              onChange={handleResolutionInput}
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeResolutionDialog}>Annuler</Button>
          <Button onClick={handleSaveResolution} variant="contained" disabled={resolutionSaving}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default CompaniesScreen;
