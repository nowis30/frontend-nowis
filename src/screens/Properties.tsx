import { useEffect, useMemo, useState, useRef, type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack
} from '@mui/material';
import LinearProgress from '@mui/material/LinearProgress';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import EditIcon from '@mui/icons-material/Edit';
import ApartmentIcon from '@mui/icons-material/Apartment';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DownloadIcon from '@mui/icons-material/Download';

import { apiClient } from '../api/client';
import { useSummary, type SummaryKpi } from '../api/summary';
import { useDepreciation, useSaveDepreciation, type DepreciationSettings } from '../api/depreciation';
import {
  usePropertyUnits,
  useCreateUnit,
  useUpdateUnit,
  useDeleteUnit,
  type PropertyUnitDto
} from '../api/propertyUnits';
import {
  usePropertyMortgages,
  useCreateMortgage,
  useUpdateMortgage,
  useDeleteMortgage,
  previewMortgage,
  type PropertyMortgageDto,
  type MortgagePreviewPayload,
  type MortgagePreviewDto
} from '../api/propertyMortgages';
import {
  fetchAttachments,
  uploadAttachment,
  deleteAttachment,
  downloadAttachment,
  type AttachmentDto
} from '../api/attachments';
import { downloadBlob } from '../utils/download';

interface PropertyPayload {
  name: string;
  address?: string;
  acquisitionDate?: string;
  purchasePrice?: number;
  currentValue?: number;
  notes?: string;
}

interface PropertyDto extends PropertyPayload {
  id: number;
}

interface UnitFormState {
  label: string;
  squareFeet: string;
  rentExpected: string;
}

interface MortgageFormState {
  lender: string;
  principal: string;
  ratePercent: string;
  termMonths: string;
  amortizationMonths: string;
  startDate: string;
  paymentFrequency: string;
}

type AttachmentFilterValue = 'all' | 'none' | number;

function useProperties() {
  return useQuery<PropertyDto[]>({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data } = await apiClient.get<PropertyDto[]>('/properties');
      return data;
    }
  });
}

function PropertiesScreen() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useProperties();
  const { data: summary, isLoading: isSummaryLoading } = useSummary();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PropertyPayload>({ name: '' });
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [ccaOpen, setCcaOpen] = useState(false);
  const [ccaError, setCcaError] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [editingPropertyId, setEditingPropertyId] = useState<number | null>(null);
  const createEmptyCcaForm = () => ({
    classCode: '',
    ccaRatePercent: 0,
    openingUcc: 0,
    additions: 0,
    dispositions: 0
  });
  const [ccaForm, setCcaForm] = useState(createEmptyCcaForm());
  const createEmptyUnitForm = (): UnitFormState => ({
    label: '',
    squareFeet: '',
    rentExpected: ''
  });
  const createEmptyMortgageForm = (): MortgageFormState => ({
    lender: '',
    principal: '',
    ratePercent: '',
    termMonths: '',
    amortizationMonths: '',
    startDate: new Date().toISOString().slice(0, 10),
    paymentFrequency: '12'
  });
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [mortgageDialogOpen, setMortgageDialogOpen] = useState(false);
  const [unitsContext, setUnitsContext] = useState<{ id: number; name: string } | null>(null);
  const [mortgagesContext, setMortgagesContext] = useState<{ id: number; name: string } | null>(null);
  const [unitForm, setUnitForm] = useState<UnitFormState>(createEmptyUnitForm());
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
  const [unitError, setUnitError] = useState<string | null>(null);
  const [mortgageForm, setMortgageForm] = useState<MortgageFormState>(createEmptyMortgageForm());
  const [editingMortgageId, setEditingMortgageId] = useState<number | null>(null);
  const [mortgageError, setMortgageError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [debouncedPreviewInput, setDebouncedPreviewInput] = useState<MortgagePreviewPayload | null>(
    null
  );
  const [attachmentFilter, setAttachmentFilter] = useState<AttachmentFilterValue>('all');
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: PropertyPayload) => apiClient.post('/properties', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      setOpen(false);
      setForm({ name: '' });
      setMutationError(null);
      setEditingPropertyId(null);
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'response' in error && error.response
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setMutationError(message ?? "Impossible d'enregistrer l'immeuble. Réessaie.");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/properties/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PropertyPayload }) =>
      apiClient.put(`/properties/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      setOpen(false);
      setForm({ name: '' });
      setMutationError(null);
      setEditingPropertyId(null);
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'response' in error && error.response
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setMutationError(message ?? "Impossible d'enregistrer l'immeuble. Réessaie.");
    }
  });

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('fr-CA', {
        style: 'currency',
        currency: 'CAD'
      }),
    []
  );

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat('fr-CA'), []);

  const summaryByProperty = useMemo<Map<number, SummaryKpi>>(() => {
    if (!summary) {
      return new Map<number, SummaryKpi>();
    }

    return new Map(summary.properties.map((property) => [property.propertyId, property]));
  }, [summary]);

  const { data: depreciationSettings, isLoading: isDepreciationLoading } = useDepreciation(
    selectedPropertyId,
    ccaOpen
  );

  const saveDepreciation = useSaveDepreciation(selectedPropertyId);
  const isSavingProperty = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (!ccaOpen || !depreciationSettings) {
      return;
    }

    setCcaForm({
      classCode: depreciationSettings.classCode,
      ccaRatePercent: Number((depreciationSettings.ccaRate ?? 0) * 100),
      openingUcc: depreciationSettings.openingUcc,
      additions: depreciationSettings.additions,
      dispositions: depreciationSettings.dispositions
    });
  }, [ccaOpen, depreciationSettings]);

  useEffect(() => {
    if (!mortgageDialogOpen) {
      setAttachmentFilter('all');
      setAttachmentError(null);
    }
  }, [mortgageDialogOpen]);

  useEffect(() => {
    setAttachmentFilter('all');
  }, [mortgagesContext?.id]);

  const totalCurrentValue = useMemo(() => {
    if (!data || data.length === 0) {
      return null;
    }

    const values = data
      .map((property) => property.currentValue)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

    if (values.length === 0) {
      return null;
    }

    return values.reduce((acc, value) => acc + value, 0);
  }, [data]);

  const formatCurrency = (value?: number | null) =>
    typeof value === 'number' && Number.isFinite(value) ? currencyFormatter.format(value) : '—';

  const formatPercent = (value?: number | null) =>
    typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(2)} %` : '—';

  const formatFileSize = (value?: number | null) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return '—';
    }

    if (value >= 1024 * 1024) {
      return `${(value / (1024 * 1024)).toFixed(1)} Mo`;
    }

    if (value >= 1024) {
      return `${(value / 1024).toFixed(1)} Ko`;
    }

    return `${Math.max(1, Math.round(value))} o`;
  };

  const formatDate = (value?: string | Date | null) => {
    if (!value) {
      return '—';
    }

    const parsed = typeof value === 'string' ? new Date(value) : value;

    if (Number.isNaN(parsed.getTime())) {
      return '—';
    }

    return dateFormatter.format(parsed);
  };

  const totals = summary?.totals;

  const toNumberOrUndefined = (value: unknown): number | undefined => {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === 'string' && value.trim().length === 0) {
      return undefined;
    }

    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
  };

  const getApiErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === 'object' && 'response' in error && error.response) {
      const message = (error as { response?: { data?: { error?: string } } }).response?.data?.error;
      if (message) {
        return message;
      }
    }

    return fallback;
  };

  const unitsPropertyId = unitsContext?.id ?? null;
  const {
    data: units,
    isLoading: isUnitsLoading,
    isFetching: isUnitsFetching
  } = usePropertyUnits(unitsPropertyId, unitDialogOpen);
  const createUnit = useCreateUnit();
  const updateUnit = useUpdateUnit();
  const deleteUnit = useDeleteUnit();

  const mortgagesPropertyId = mortgagesContext?.id ?? null;
  const {
    data: mortgages,
    isLoading: isMortgagesLoading,
    isFetching: isMortgagesFetching
  } = usePropertyMortgages(mortgagesPropertyId, mortgageDialogOpen);
  const createMortgage = useCreateMortgage();
  const updateMortgage = useUpdateMortgage();
  const deleteMortgage = useDeleteMortgage();

  const mortgagesById = useMemo(() => {
    if (!mortgages) {
      return new Map<number, PropertyMortgageDto>();
    }

    return new Map(mortgages.map((mortgageItem) => [mortgageItem.id, mortgageItem]));
  }, [mortgages]);

  const isUnitSaving = createUnit.isPending || updateUnit.isPending;
  const isMortgageSaving = createMortgage.isPending || updateMortgage.isPending;

  const attachmentsQuery = useQuery<AttachmentDto[]>({
    queryKey: ['attachments', mortgagesContext?.id, attachmentFilter],
    enabled: Boolean(mortgageDialogOpen && mortgagesContext),
    queryFn: async () => {
      if (!mortgagesContext) {
        return [];
      }

      if (typeof attachmentFilter === 'number') {
        return fetchAttachments(mortgagesContext.id, { mortgageId: attachmentFilter });
      }

      return fetchAttachments(mortgagesContext.id);
    }
  });

  const attachments = useMemo(() => attachmentsQuery.data ?? [], [attachmentsQuery.data]);
  const filteredAttachments = useMemo(() => {
    if (attachmentFilter === 'none') {
      return attachments.filter((item) => item.mortgageId === null);
    }

    return attachments;
  }, [attachments, attachmentFilter]);

  const uploadAttachmentMutation = useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      if (!mortgagesContext) {
        throw new Error('Aucun immeuble sélectionné');
      }

      const mortgageId = typeof attachmentFilter === 'number' ? attachmentFilter : undefined;
      return uploadAttachment(mortgagesContext.id, {
        file,
        title: file.name,
        mortgageId
      });
    },
    onSuccess: () => {
      if (mortgagesContext) {
        queryClient.invalidateQueries({ queryKey: ['attachments', mortgagesContext.id] });
      }
      setAttachmentError(null);
    },
    onError: (error: unknown) => {
      setAttachmentError(getApiErrorMessage(error, "Échec de l'envoi du fichier."));
    }
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachment: AttachmentDto) => {
      if (!mortgagesContext) {
        throw new Error('Aucun immeuble sélectionné');
      }

      await deleteAttachment(mortgagesContext.id, attachment.id);
    },
    onSuccess: () => {
      if (mortgagesContext) {
        queryClient.invalidateQueries({ queryKey: ['attachments', mortgagesContext.id] });
      }
      setAttachmentError(null);
    },
    onError: (error: unknown) => {
      setAttachmentError(getApiErrorMessage(error, 'Suppression impossible pour le moment.'));
    }
  });

  const downloadAttachmentMutation = useMutation({
    mutationFn: async (attachment: AttachmentDto) => {
      if (!mortgagesContext) {
        throw new Error('Aucun immeuble sélectionné');
      }

      const blob = await downloadAttachment(mortgagesContext.id, attachment.id);
      return blob;
    },
    onMutate: (attachment: AttachmentDto) => {
      setDownloadingAttachmentId(attachment.id);
      setAttachmentError(null);
    },
    onSuccess: (blob: Blob, attachment: AttachmentDto) => {
      const filename = attachment.filename || attachment.title || `document-${attachment.id}`;
      downloadBlob(blob, filename);
      setDownloadingAttachmentId(null);
    },
    onError: (error: unknown) => {
      setAttachmentError(getApiErrorMessage(error, 'Téléchargement impossible pour le moment.'));
      setDownloadingAttachmentId(null);
    }
  });

  const mortgagePreviewSource = useMemo<MortgagePreviewPayload | null>(() => {
    if (!mortgageDialogOpen || !mortgagesContext) {
      return null;
    }

    const parseNumber = (value: string, allowZero = false, requireInteger = false) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0 || (!allowZero && parsed === 0)) {
        return null;
      }
      if (requireInteger && !Number.isInteger(parsed)) {
        return null;
      }
      return parsed;
    };

    const principal = parseNumber(mortgageForm.principal);
    if (principal === null) {
      return null;
    }

    const ratePercentValue = parseNumber(mortgageForm.ratePercent, true);
    if (ratePercentValue === null) {
      return null;
    }

    const termMonths = parseNumber(mortgageForm.termMonths, false, true);
    if (termMonths === null) {
      return null;
    }

    const amortizationMonths = parseNumber(mortgageForm.amortizationMonths, false, true);
    if (amortizationMonths === null) {
      return null;
    }

    const paymentFrequency = parseNumber(mortgageForm.paymentFrequency, false, true);
    if (paymentFrequency === null) {
      return null;
    }

    const startDate = mortgageForm.startDate?.trim();
    if (!startDate) {
      return null;
    }

    const lender = mortgageForm.lender.trim();

    return {
      lender: lender.length > 0 ? lender : undefined,
      principal,
      rateAnnual: ratePercentValue / 100,
      termMonths,
      amortizationMonths,
      startDate,
      paymentFrequency
    } satisfies MortgagePreviewPayload;
  }, [mortgageDialogOpen, mortgagesContext, mortgageForm]);

  useEffect(() => {
    if (!mortgagePreviewSource) {
      setDebouncedPreviewInput(null);
      return;
    }

    const handle = window.setTimeout(() => {
      setDebouncedPreviewInput(mortgagePreviewSource);
    }, 300);

    return () => window.clearTimeout(handle);
  }, [mortgagePreviewSource]);

  const mortgagePreviewQuery = useQuery<MortgagePreviewDto>({
    queryKey: ['mortgagePreview', mortgagesContext?.id, debouncedPreviewInput],
    enabled: Boolean(mortgageDialogOpen && mortgagesContext && debouncedPreviewInput),
    queryFn: async () => {
      if (!mortgagesContext || !debouncedPreviewInput) {
        throw new Error('Prévisualisation indisponible.');
      }
      return previewMortgage(mortgagesContext.id, debouncedPreviewInput);
    }
  });

  const mortgagePreview = mortgagePreviewQuery.data;

  const schedulePreview = useMemo(() => {
    if (!mortgagePreview) {
      return [];
    }
    return mortgagePreview.schedule.slice(0, Math.min(12, mortgagePreview.schedule.length));
  }, [mortgagePreview]);

  const annualBreakdownPreview = useMemo(() => {
    if (!mortgagePreview) {
      return [];
    }
    return mortgagePreview.annualBreakdown.slice(0, Math.min(5, mortgagePreview.annualBreakdown.length));
  }, [mortgagePreview]);

  const handleOpenUnitDialog = (property: PropertyDto) => {
    setUnitsContext({ id: property.id, name: property.name });
    setUnitForm(createEmptyUnitForm());
    setEditingUnitId(null);
    setUnitError(null);
    setUnitDialogOpen(true);
  };

  const handleCloseUnitDialog = () => {
    setUnitDialogOpen(false);
    setUnitsContext(null);
    setUnitForm(createEmptyUnitForm());
    setEditingUnitId(null);
    setUnitError(null);
  };

  const handleEditUnit = (unit: PropertyUnitDto) => {
    setUnitError(null);
    setEditingUnitId(unit.id);
    setUnitForm({
      label: unit.label,
      squareFeet:
        unit.squareFeet !== null && unit.squareFeet !== undefined ? String(unit.squareFeet) : '',
      rentExpected:
        unit.rentExpected !== null && unit.rentExpected !== undefined
          ? String(unit.rentExpected)
          : ''
    });
  };

  const handleDeleteUnit = (unit: PropertyUnitDto) => {
    if (!unitsContext) {
      return;
    }

    const confirmed = window.confirm('Supprimer cette unité ?');
    if (!confirmed) {
      return;
    }

    deleteUnit.mutate(
      { propertyId: unitsContext.id, unitId: unit.id },
      {
        onError: (error: unknown) => {
          setUnitError(getApiErrorMessage(error, "Suppression impossible pour le moment."));
        }
      }
    );
  };

  const handleSubmitUnit = () => {
    if (!unitsContext) {
      return;
    }

    const label = unitForm.label.trim();
    if (!label) {
      setUnitError("Le nom de l'unité est requis.");
      return;
    }

    const squareFeetRaw = unitForm.squareFeet.trim();
    const rentExpectedRaw = unitForm.rentExpected.trim();

    let squareFeet: number | null = null;
    if (squareFeetRaw.length > 0) {
      const parsed = Number(squareFeetRaw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setUnitError('La superficie doit être un nombre positif ou vide.');
        return;
      }

      squareFeet = parsed;
    }

    let rentExpected: number | null = null;
    if (rentExpectedRaw.length > 0) {
      const parsed = Number(rentExpectedRaw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setUnitError('Le loyer attendu doit être un nombre positif ou vide.');
        return;
      }

      rentExpected = parsed;
    }

    const payload = {
      label,
      squareFeet,
      rentExpected
    };

    const onSuccess = () => {
      setUnitForm(createEmptyUnitForm());
      setEditingUnitId(null);
      setUnitError(null);
    };

    const onError = (error: unknown) => {
      setUnitError(getApiErrorMessage(error, "Impossible d'enregistrer l'unité."));
    };

    if (editingUnitId) {
      updateUnit.mutate(
        { propertyId: unitsContext.id, unitId: editingUnitId, payload },
        { onSuccess, onError }
      );
    } else {
      createUnit.mutate({ propertyId: unitsContext.id, payload }, { onSuccess, onError });
    }
  };

  const handleCancelUnitEdit = () => {
    setEditingUnitId(null);
    setUnitForm(createEmptyUnitForm());
    setUnitError(null);
  };

  const handleOpenMortgageDialog = (property: PropertyDto) => {
    setMortgagesContext({ id: property.id, name: property.name });
    setMortgageForm(createEmptyMortgageForm());
    setEditingMortgageId(null);
    setMortgageError(null);
    setMortgageDialogOpen(true);
  };

  const handleCloseMortgageDialog = () => {
    setMortgageDialogOpen(false);
    setMortgagesContext(null);
    setMortgageForm(createEmptyMortgageForm());
    setEditingMortgageId(null);
    setMortgageError(null);
    setDebouncedPreviewInput(null);
    setAttachmentError(null);
    setAttachmentFilter('all');
  };

  const handleEditMortgage = (mortgage: PropertyMortgageDto) => {
    setMortgageError(null);
    setEditingMortgageId(mortgage.id);
    setMortgageForm({
      lender: mortgage.lender,
      principal: String(mortgage.principal ?? ''),
      ratePercent: ((mortgage.rateAnnual ?? 0) * 100).toString(),
      termMonths: String(mortgage.termMonths ?? ''),
      amortizationMonths: String(mortgage.amortizationMonths ?? ''),
      startDate: mortgage.startDate ? mortgage.startDate.slice(0, 10) : '',
      paymentFrequency: String(mortgage.paymentFrequency ?? '')
    });
  };

  const handleDeleteMortgage = (mortgage: PropertyMortgageDto) => {
    if (!mortgagesContext) {
      return;
    }

    const confirmed = window.confirm('Supprimer cette hypothèque ?');
    if (!confirmed) {
      return;
    }

    deleteMortgage.mutate(
      { propertyId: mortgagesContext.id, mortgageId: mortgage.id },
      {
        onError: (error: unknown) => {
          setMortgageError(getApiErrorMessage(error, 'Suppression impossible pour le moment.'));
        }
      }
    );
  };

  const handleSubmitMortgage = () => {
    if (!mortgagesContext) {
      return;
    }

    const lender = mortgageForm.lender.trim();
    if (!lender) {
      setMortgageError('Le prêteur est requis.');
      return;
    }

    const parsePositiveNumber = (
      value: string,
      fieldLabel: string,
      allowZero = false,
      requireInteger = false
    ) => {
      const trimmed = value.trim();
      if (!trimmed) {
        setMortgageError(`${fieldLabel} est requis.`);
        return null;
      }

      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0 || (!allowZero && parsed === 0)) {
        setMortgageError(`${fieldLabel} doit être un nombre positif.`);
        return null;
      }

      if (requireInteger && !Number.isInteger(parsed)) {
        setMortgageError(`${fieldLabel} doit être un nombre entier.`);
        return null;
      }

      return parsed;
    };

    const principal = parsePositiveNumber(mortgageForm.principal, 'Le capital');
    if (principal === null) {
      return;
    }

  const ratePercentValue = parsePositiveNumber(mortgageForm.ratePercent, 'Le taux', true);
    if (ratePercentValue === null) {
      return;
    }

    const termMonths = parsePositiveNumber(mortgageForm.termMonths, 'La durée (mois)', false, true);
    if (termMonths === null) {
      return;
    }

    const amortizationMonths = parsePositiveNumber(
      mortgageForm.amortizationMonths,
      "L'amortissement (mois)",
      false,
      true
    );
    if (amortizationMonths === null) {
      return;
    }

    const paymentFrequency = parsePositiveNumber(
      mortgageForm.paymentFrequency,
      'La fréquence des paiements',
      false,
      true
    );
    if (paymentFrequency === null) {
      return;
    }

    const startDate = mortgageForm.startDate;
    if (!startDate) {
      setMortgageError('La date de début est requise.');
      return;
    }

    const payload = {
      lender,
      principal,
      rateAnnual: ratePercentValue / 100,
      termMonths,
      amortizationMonths,
      startDate,
      paymentFrequency
    };

    const onSuccess = () => {
      setMortgageForm(createEmptyMortgageForm());
      setEditingMortgageId(null);
      setMortgageError(null);
      setDebouncedPreviewInput(null);
    };

    const onError = (error: unknown) => {
      setMortgageError(getApiErrorMessage(error, "Impossible d'enregistrer l'hypothèque."));
    };

    if (editingMortgageId) {
      updateMortgage.mutate(
        { propertyId: mortgagesContext.id, mortgageId: editingMortgageId, payload },
        { onSuccess, onError }
      );
    } else {
      createMortgage.mutate({ propertyId: mortgagesContext.id, payload }, { onSuccess, onError });
    }
  };

  const handleCancelMortgageEdit = () => {
    setEditingMortgageId(null);
    setMortgageForm(createEmptyMortgageForm());
    setMortgageError(null);
    setDebouncedPreviewInput(null);
    setAttachmentError(null);
  };

  const handleAttachmentFilterChange = (value: AttachmentFilterValue) => {
    setAttachmentFilter(value);
    setAttachmentError(null);
  };

  const handleUploadButtonClick = () => {
    setAttachmentError(null);
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputElement = event.target;
    const files = inputElement.files;

    if (!files || files.length === 0) {
      return;
    }

    if (!mortgagesContext) {
      setAttachmentError('Aucun immeuble sélectionné.');
      inputElement.value = '';
      return;
    }

    const file = files[0];
    if (!file || file.size === 0) {
      setAttachmentError('Le fichier sélectionné est vide.');
      inputElement.value = '';
      return;
    }

    setAttachmentError(null);

    uploadAttachmentMutation.mutate(
      { file },
      {
        onSettled: () => {
          inputElement.value = '';
        }
      }
    );
  };

  const handleDownloadAttachment = (attachment: AttachmentDto) => {
    if (downloadAttachmentMutation.isPending) {
      return;
    }

    downloadAttachmentMutation.mutate(attachment);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Immeubles</Typography>
        <Button
          variant="contained"
          onClick={() => {
            setMutationError(null);
            setEditingPropertyId(null);
            setForm({ name: '' });
            setOpen(true);
          }}
        >
          Ajouter un immeuble
        </Button>
      </Box>
      {isLoading || isSummaryLoading ? (
        <Typography>Chargement...</Typography>
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nom</TableCell>
                <TableCell>Adresse</TableCell>
                <TableCell align="right">Unités</TableCell>
                <TableCell align="right">Loyer potentiel</TableCell>
                <TableCell align="right">Valeur actuelle</TableCell>
                <TableCell align="right">Dette en cours</TableCell>
                <TableCell align="right">Ratio LTV</TableCell>
                <TableCell align="right">Service de la dette</TableCell>
                <TableCell align="right">Capital remboursé</TableCell>
                <TableCell align="right">Intérêts</TableCell>
                <TableCell align="right">Cashflow net</TableCell>
                <TableCell align="right">Équité</TableCell>
                <TableCell align="right">CCA</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.map((property: PropertyDto) => {
                const metrics = summaryByProperty.get(property.id);

                return (
                  <TableRow key={property.id} hover>
                    <TableCell>{property.name}</TableCell>
                    <TableCell>{property.address ?? '—'}</TableCell>
                    <TableCell align="right">
                      {metrics ? metrics.unitsCount : '—'}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(metrics?.rentPotentialMonthly)}
                    </TableCell>
                    <TableCell align="right">{formatCurrency(property.currentValue)}</TableCell>
                    <TableCell align="right">{formatCurrency(metrics?.outstandingDebt)}</TableCell>
                    <TableCell align="right">{formatPercent(metrics?.loanToValue)}</TableCell>
                    <TableCell align="right">{formatCurrency(metrics?.debtService)}</TableCell>
                    <TableCell align="right">{formatCurrency(metrics?.principalPortion)}</TableCell>
                    <TableCell align="right">{formatCurrency(metrics?.interestPortion)}</TableCell>
                    <TableCell align="right">{formatCurrency(metrics?.netCashflow)}</TableCell>
                    <TableCell align="right">{formatCurrency(metrics?.equity)}</TableCell>
                    <TableCell align="right">{formatCurrency(metrics?.cca)}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        edge="end"
                        aria-label="modifier"
                        onClick={() => {
                          setMutationError(null);
                          setEditingPropertyId(property.id);
                          const acquisitionDateValue = property.acquisitionDate as unknown;
                          const normalizedAcquisitionDate =
                            typeof acquisitionDateValue === 'string'
                              ? acquisitionDateValue.slice(0, 10)
                              : acquisitionDateValue instanceof Date
                              ? acquisitionDateValue.toISOString().slice(0, 10)
                              : undefined;
                          setForm({
                            name: property.name,
                            address: property.address ?? undefined,
                            acquisitionDate: normalizedAcquisitionDate,
                            purchasePrice: toNumberOrUndefined(property.purchasePrice),
                            currentValue: toNumberOrUndefined(property.currentValue),
                            notes: property.notes ?? undefined
                          });
                          setOpen(true);
                        }}
                        sx={{ mr: 0.5 }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="unités"
                        onClick={() => handleOpenUnitDialog(property)}
                        sx={{ mr: 0.5 }}
                      >
                        <ApartmentIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="hypothèques"
                        onClick={() => handleOpenMortgageDialog(property)}
                        sx={{ mr: 0.5 }}
                      >
                        <AccountBalanceIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="supprimer"
                        onClick={() => deleteMutation.mutate(property.id)}
                        sx={{ mr: 0.5 }}
                      >
                        <DeleteIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="Paramètres CCA"
                        onClick={() => {
                          setSelectedPropertyId(property.id);
                          setCcaOpen(true);
                          setCcaError(null);
                        }}
                      >
                        <SettingsIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
              {totals && (
                <TableRow sx={{ backgroundColor: 'rgba(25, 118, 210, 0.08)' }}>
                  <TableCell component="th" scope="row" colSpan={2} sx={{ fontWeight: 600 }}>
                    Total portefeuille
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {totals.unitsCount}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatCurrency(totals.rentPotentialMonthly)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatCurrency(totalCurrentValue)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatCurrency(totals.outstandingDebt)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatPercent(totals.loanToValue)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatCurrency(totals.debtService)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatCurrency(totals.principalPortion)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatCurrency(totals.interestPortion)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatCurrency(totals.netCashflow)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatCurrency(totals.equity)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatCurrency(totals.cca)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    —
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setMutationError(null);
          setEditingPropertyId(null);
          setForm({ name: '' });
        }}
        fullWidth
      >
        <DialogTitle>{editingPropertyId ? 'Modifier un immeuble' : 'Nouvel immeuble'}</DialogTitle>
        <DialogContent>
          {mutationError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {mutationError}
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <TextField
                label="Nom"
                fullWidth
                required
                value={form.name}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setForm((prev: PropertyPayload) => ({ ...prev, name: event.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Adresse"
                fullWidth
                value={form.address ?? ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setForm((prev: PropertyPayload) => ({ ...prev, address: event.target.value }))
                }
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Date d'acquisition"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={form.acquisitionDate ?? ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setForm((prev: PropertyPayload) => ({
                    ...prev,
                    acquisitionDate: event.target.value
                  }))
                }
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Valeur actuelle"
                type="number"
                fullWidth
                value={form.currentValue ?? ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setForm((prev: PropertyPayload) => ({
                    ...prev,
                    currentValue: Number(event.target.value)
                  }))
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notes"
                fullWidth
                multiline
                minRows={3}
                value={form.notes ?? ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setForm((prev: PropertyPayload) => ({ ...prev, notes: event.target.value }))
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpen(false);
              setMutationError(null);
              setEditingPropertyId(null);
              setForm({ name: '' });
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={() => {
              if (editingPropertyId) {
                updateMutation.mutate({ id: editingPropertyId, payload: form });
              } else {
                createMutation.mutate(form);
              }
            }}
            variant="contained"
            disabled={isSavingProperty}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={unitDialogOpen}
        onClose={handleCloseUnitDialog}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          Unités{unitsContext ? ` — ${unitsContext.name}` : ''}
        </DialogTitle>
        <DialogContent>
          {unitError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {unitError}
            </Alert>
          )}
          {(isUnitsLoading || isUnitsFetching) && (
            <Box sx={{ mt: 1, mb: 2 }}>
              <LinearProgress />
            </Box>
          )}
          {!isUnitsLoading && !isUnitsFetching && (units?.length ?? 0) === 0 && (
            <Typography sx={{ mb: 2 }}>Aucune unité enregistrée pour cet immeuble.</Typography>
          )}
          {!isUnitsLoading && !isUnitsFetching && (units?.length ?? 0) > 0 && (
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Nom</TableCell>
                    <TableCell align="right">Superficie (pi²)</TableCell>
                    <TableCell align="right">Loyer attendu</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {units?.map((unit) => (
                    <TableRow key={unit.id} hover>
                      <TableCell>{unit.label}</TableCell>
                      <TableCell align="right">
                        {unit.squareFeet !== null && unit.squareFeet !== undefined
                          ? unit.squareFeet.toLocaleString('fr-CA')
                          : '—'}
                      </TableCell>
                      <TableCell align="right">{formatCurrency(unit.rentExpected)}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          edge="end"
                          aria-label="modifier"
                          onClick={() => handleEditUnit(unit)}
                          sx={{ mr: 0.5 }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          edge="end"
                          aria-label="supprimer"
                          onClick={() => handleDeleteUnit(unit)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <Typography variant="h6" sx={{ mb: 2 }}>
            {editingUnitId ? 'Modifier une unité' : 'Ajouter une unité'}
          </Typography>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Nom"
                fullWidth
                required
                value={unitForm.label}
                disabled={isUnitSaving}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setUnitForm((prev) => ({ ...prev, label: event.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Superficie (pi²)"
                type="number"
                fullWidth
                value={unitForm.squareFeet}
                disabled={isUnitSaving}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setUnitForm((prev) => ({ ...prev, squareFeet: event.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Loyer attendu"
                type="number"
                fullWidth
                value={unitForm.rentExpected}
                disabled={isUnitSaving}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setUnitForm((prev) => ({ ...prev, rentExpected: event.target.value }))
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          {editingUnitId && (
            <Button onClick={handleCancelUnitEdit} disabled={isUnitSaving}>
              Annuler la modification
            </Button>
          )}
          <Button onClick={handleCloseUnitDialog} disabled={isUnitSaving}>
            Fermer
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitUnit}
            disabled={isUnitSaving || !unitsContext}
          >
            {editingUnitId ? 'Mettre à jour' : 'Ajouter'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={mortgageDialogOpen}
        onClose={handleCloseMortgageDialog}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          Hypothèques{mortgagesContext ? ` — ${mortgagesContext.name}` : ''}
        </DialogTitle>
        <DialogContent>
          {mortgageError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {mortgageError}
            </Alert>
          )}
          {(isMortgagesLoading || isMortgagesFetching) && (
            <Box sx={{ mt: 1, mb: 2 }}>
              <LinearProgress />
            </Box>
          )}
          {!isMortgagesLoading && !isMortgagesFetching && (mortgages?.length ?? 0) === 0 && (
            <Typography sx={{ mb: 2 }}>Aucune hypothèque enregistrée pour cet immeuble.</Typography>
          )}
          {!isMortgagesLoading && !isMortgagesFetching && (mortgages?.length ?? 0) > 0 && (
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Prêteur</TableCell>
                    <TableCell align="right">Capital</TableCell>
                    <TableCell align="right">Taux</TableCell>
                    <TableCell align="right">Durée (mois)</TableCell>
                    <TableCell align="right">Amortissement (mois)</TableCell>
                    <TableCell align="right">Paiement</TableCell>
                    <TableCell align="right">Fréquence/an</TableCell>
                    <TableCell align="right">Date de début</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mortgages?.map((mortgage) => (
                    <TableRow key={mortgage.id} hover>
                      <TableCell>{mortgage.lender}</TableCell>
                      <TableCell align="right">{formatCurrency(mortgage.principal)}</TableCell>
                      <TableCell align="right">{formatPercent(mortgage.rateAnnual)}</TableCell>
                      <TableCell align="right">{mortgage.termMonths}</TableCell>
                      <TableCell align="right">{mortgage.amortizationMonths}</TableCell>
                      <TableCell align="right">{formatCurrency(mortgage.paymentAmount)}</TableCell>
                      <TableCell align="right">{mortgage.paymentFrequency}</TableCell>
                      <TableCell align="right">{formatDate(mortgage.startDate)}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          edge="end"
                          aria-label="modifier"
                          onClick={() => handleEditMortgage(mortgage)}
                          sx={{ mr: 0.5 }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          edge="end"
                          aria-label="supprimer"
                          onClick={() => handleDeleteMortgage(mortgage)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {mortgagesContext && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Documents
              </Typography>
              {attachmentError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {attachmentError}
                </Alert>
              )}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ mb: 2 }}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                justifyContent="space-between"
              >
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel id="attachment-filter-label">Filtrer</InputLabel>
                  <Select
                    labelId="attachment-filter-label"
                    label="Filtrer"
                    value={attachmentFilter}
                    onChange={(event) =>
                      handleAttachmentFilterChange(event.target.value as AttachmentFilterValue)
                    }
                  >
                    <MenuItem value="all">Tous les documents</MenuItem>
                    <MenuItem value="none">Sans hypothèque</MenuItem>
                    {(mortgages ?? []).map((mortgageOption) => (
                      <MenuItem key={mortgageOption.id} value={mortgageOption.id}>
                        {mortgageOption.lender || `Hypothèque ${mortgageOption.id}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button
                    variant="outlined"
                    onClick={handleUploadButtonClick}
                    disabled={uploadAttachmentMutation.isPending || !mortgagesContext}
                  >
                    {uploadAttachmentMutation.isPending
                      ? 'Téléversement...'
                      : 'Téléverser un fichier'}
                  </Button>
                  <Button
                    variant="text"
                    onClick={() => attachmentsQuery.refetch()}
                    disabled={attachmentsQuery.isFetching}
                  >
                    {attachmentsQuery.isFetching ? 'Actualisation...' : 'Actualiser'}
                  </Button>
                </Stack>
              </Stack>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />
              {(attachmentsQuery.isLoading || attachmentsQuery.isFetching) && (
                <Box sx={{ mt: 1, mb: 2 }}>
                  <LinearProgress />
                </Box>
              )}
              {!attachmentsQuery.isLoading &&
                !attachmentsQuery.isFetching &&
                filteredAttachments.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Aucun document pour ce filtre.
                  </Typography>
                )}
              {!attachmentsQuery.isLoading &&
                !attachmentsQuery.isFetching &&
                filteredAttachments.length > 0 && (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Nom</TableCell>
                          <TableCell>Hypothèque</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell align="right">Taille</TableCell>
                          <TableCell align="right">Ajouté le</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredAttachments.map((attachment) => {
                          const relatedMortgage = attachment.mortgageId
                            ? mortgagesById.get(attachment.mortgageId)
                            : null;

                          return (
                            <TableRow key={attachment.id} hover>
                              <TableCell>{attachment.title || attachment.filename}</TableCell>
                              <TableCell>
                                {relatedMortgage
                                  ? relatedMortgage.lender || `Hypothèque ${relatedMortgage.id}`
                                  : '—'}
                              </TableCell>
                              <TableCell>{attachment.contentType || '—'}</TableCell>
                              <TableCell align="right">{formatFileSize(attachment.size)}</TableCell>
                              <TableCell align="right">{formatDate(attachment.createdAt)}</TableCell>
                              <TableCell align="right">
                                <IconButton
                                  aria-label="télécharger"
                                  onClick={() => handleDownloadAttachment(attachment)}
                                  disabled={
                                    downloadAttachmentMutation.isPending &&
                                    downloadingAttachmentId === attachment.id
                                  }
                                  sx={{ mr: 0.5 }}
                                >
                                  <DownloadIcon
                                    fontSize="small"
                                    sx={{
                                      opacity:
                                        downloadAttachmentMutation.isPending &&
                                        downloadingAttachmentId === attachment.id
                                          ? 0.5
                                          : 1
                                    }}
                                  />
                                </IconButton>
                                <IconButton
                                  aria-label="supprimer"
                                  onClick={() => deleteAttachmentMutation.mutate(attachment)}
                                  disabled={deleteAttachmentMutation.isPending}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
            </Box>
          )}
          <Typography variant="h6" sx={{ mb: 2 }}>
            {editingMortgageId ? 'Modifier une hypothèque' : 'Ajouter une hypothèque'}
          </Typography>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} md={4}>
              <TextField
                label="Prêteur"
                fullWidth
                required
                value={mortgageForm.lender}
                disabled={isMortgageSaving}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setMortgageForm((prev) => ({ ...prev, lender: event.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Capital"
                type="number"
                fullWidth
                required
                value={mortgageForm.principal}
                disabled={isMortgageSaving}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setMortgageForm((prev) => ({ ...prev, principal: event.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Taux (%)"
                type="number"
                fullWidth
                required
                value={mortgageForm.ratePercent}
                disabled={isMortgageSaving}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setMortgageForm((prev) => ({ ...prev, ratePercent: event.target.value }))
                }
                helperText="Ex: 4.25 pour 4,25%"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Durée (mois)"
                type="number"
                fullWidth
                required
                value={mortgageForm.termMonths}
                disabled={isMortgageSaving}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setMortgageForm((prev) => ({ ...prev, termMonths: event.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Amortissement (mois)"
                type="number"
                fullWidth
                required
                value={mortgageForm.amortizationMonths}
                disabled={isMortgageSaving}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setMortgageForm((prev) => ({ ...prev, amortizationMonths: event.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Fréquence des paiements (par an)"
                type="number"
                fullWidth
                required
                value={mortgageForm.paymentFrequency}
                disabled={isMortgageSaving}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setMortgageForm((prev) => ({ ...prev, paymentFrequency: event.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Date de début"
                type="date"
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
                value={mortgageForm.startDate}
                disabled={isMortgageSaving}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setMortgageForm((prev) => ({ ...prev, startDate: event.target.value }))
                }
              />
            </Grid>
          </Grid>
          {debouncedPreviewInput && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Simulation du paiement et de l&apos;amortissement
              </Typography>
              {mortgagePreviewQuery.isLoading && (
                <Box sx={{ mt: 1, mb: 2 }}>
                  <LinearProgress />
                </Box>
              )}
              {mortgagePreviewQuery.isError && !mortgagePreviewQuery.isLoading && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Calcul du paiement impossible pour le moment. Vérifie les valeurs saisies.
                </Alert>
              )}
              {mortgagePreview && (
                <Box>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} md={3}>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="overline">Paiement périodique</Typography>
                        <Typography variant="h5">
                          {formatCurrency(mortgagePreview.paymentAmount)}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="overline">Fin de terme</Typography>
                        <Typography variant="body1">
                          Solde&nbsp;: {formatCurrency(mortgagePreview.termSummary.balanceRemaining)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Après {mortgagePreview.termSummary.periods} paiements
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="overline">Intérêts totaux</Typography>
                        <Typography variant="body1">
                          {formatCurrency(mortgagePreview.totalInterest)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {mortgagePreview.totalPeriods} paiements
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="overline">Date finale</Typography>
                        <Typography variant="body1">
                          {mortgagePreview.payoffDate
                            ? formatDate(mortgagePreview.payoffDate)
                            : '—'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total payé {formatCurrency(mortgagePreview.totalPaid)}
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                  {schedulePreview.length > 0 && (
                    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Période</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell align="right">Paiement</TableCell>
                            <TableCell align="right">Intérêts</TableCell>
                            <TableCell align="right">Capital</TableCell>
                            <TableCell align="right">Solde restant</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {schedulePreview.map((entry) => (
                            <TableRow key={entry.periodIndex}>
                              <TableCell>{entry.periodIndex}</TableCell>
                              <TableCell>{formatDate(entry.paymentDate)}</TableCell>
                              <TableCell align="right">
                                {formatCurrency(entry.paymentAmount)}
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(entry.interestPortion)}
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(entry.principalPortion)}
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(entry.remainingBalance)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                  {schedulePreview.length > 0 && mortgagePreview.schedule.length > schedulePreview.length && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                      Aperçu des {schedulePreview.length} premiers paiements sur {mortgagePreview.schedule.length}.
                    </Typography>
                  )}
                  {annualBreakdownPreview.length > 0 && (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Année</TableCell>
                            <TableCell align="right">Capital remboursé</TableCell>
                            <TableCell align="right">Intérêts payés</TableCell>
                            <TableCell align="right">Solde fin d&apos;année</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {annualBreakdownPreview.map((entry) => (
                            <TableRow key={entry.year}>
                              <TableCell>{entry.year}</TableCell>
                              <TableCell align="right">
                                {formatCurrency(entry.totalPrincipal)}
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(entry.totalInterest)}
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(entry.endingBalance)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {editingMortgageId && (
            <Button onClick={handleCancelMortgageEdit} disabled={isMortgageSaving}>
              Annuler la modification
            </Button>
          )}
          <Button onClick={handleCloseMortgageDialog} disabled={isMortgageSaving}>
            Fermer
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitMortgage}
            disabled={isMortgageSaving || !mortgagesContext}
          >
            {editingMortgageId ? 'Mettre à jour' : 'Ajouter'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={ccaOpen}
        onClose={() => {
          setCcaOpen(false);
          setCcaError(null);
          setSelectedPropertyId(null);
          setCcaForm(createEmptyCcaForm());
        }}
        fullWidth
      >
        <DialogTitle>Paramètres CCA</DialogTitle>
        <DialogContent>
          {ccaError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {ccaError}
            </Alert>
          )}
          {isDepreciationLoading && (
            <Box sx={{ mt: 1, mb: 2 }}>
              <LinearProgress />
            </Box>
          )}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Code de classe"
                fullWidth
                value={ccaForm.classCode}
                disabled={isDepreciationLoading || saveDepreciation.isPending}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setCcaForm((prev) => ({ ...prev, classCode: event.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Taux CCA (%)"
                type="number"
                fullWidth
                value={ccaForm.ccaRatePercent}
                disabled={isDepreciationLoading || saveDepreciation.isPending}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setCcaForm((prev) => ({
                    ...prev,
                    ccaRatePercent: Number(event.target.value)
                  }))
                }
                helperText="Ex: 4 pour 4%"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="DPA non amortie (UCC) d'ouverture"
                type="number"
                fullWidth
                value={ccaForm.openingUcc}
                disabled={isDepreciationLoading || saveDepreciation.isPending}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setCcaForm((prev) => ({
                    ...prev,
                    openingUcc: Number(event.target.value)
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Additions admissibles"
                type="number"
                fullWidth
                value={ccaForm.additions}
                disabled={isDepreciationLoading || saveDepreciation.isPending}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setCcaForm((prev) => ({
                    ...prev,
                    additions: Number(event.target.value)
                  }))
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Dispositions"
                type="number"
                fullWidth
                value={ccaForm.dispositions}
                disabled={isDepreciationLoading || saveDepreciation.isPending}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setCcaForm((prev) => ({
                    ...prev,
                    dispositions: Number(event.target.value)
                  }))
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCcaOpen(false);
              setCcaError(null);
              setSelectedPropertyId(null);
              setCcaForm(createEmptyCcaForm());
            }}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            disabled={saveDepreciation.isPending || isDepreciationLoading || !selectedPropertyId}
            onClick={() => {
              if (!selectedPropertyId) {
                return;
              }

              setCcaError(null);
              const payload: DepreciationSettings = {
                classCode: ccaForm.classCode,
                ccaRate: (ccaForm.ccaRatePercent ?? 0) / 100,
                openingUcc: ccaForm.openingUcc,
                additions: ccaForm.additions,
                dispositions: ccaForm.dispositions
              };

              saveDepreciation.mutate(
                payload,
                {
                  onSuccess: () => {
                    setCcaOpen(false);
                    setCcaError(null);
                    setSelectedPropertyId(null);
                    setCcaForm(createEmptyCcaForm());
                  },
                  onError: (error: unknown) => {
                    const message =
                      error && typeof error === 'object' && 'response' in error && error.response
                        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
                        : null;
                    setCcaError(message ?? 'Sauvegarde impossible pour le moment.');
                  }
                }
              );
            }}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PropertiesScreen;
