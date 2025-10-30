import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './client';

export type PersonalIncomeCategory =
  | 'EMPLOYMENT'
  | 'PENSION'
  | 'OAS'
  | 'CPP_QPP'
  | 'RRIF_RRSP'
  | 'BUSINESS'
  | 'ELIGIBLE_DIVIDEND'
  | 'NON_ELIGIBLE_DIVIDEND'
  | 'CAPITAL_GAIN'
  | 'OTHER';

export interface PersonalIncomePayload {
  shareholderId: number;
  taxYear: number;
  category: PersonalIncomeCategory;
  label: string;
  source?: string | null;
  slipType?: string | null;
  amount: number;
}

export interface PersonalIncomeDto extends PersonalIncomePayload {
  id: number;
  createdAt: string;
  updatedAt: string;
  shareholder: {
    id: number;
    displayName: string;
  };
}

export interface PersonalIncomeSummaryDto {
  shareholder: {
    id: number;
    displayName: string;
  };
  taxYear: number;
  categories: Record<PersonalIncomeCategory, number>;
  taxInputs: {
    employmentIncome: number;
    businessIncome: number;
    eligibleDividends: number;
    nonEligibleDividends: number;
    capitalGains: number;
  };
  totalIncome: number;
}

export interface PersonalIncomeShareholderDto {
  id: number;
  displayName: string;
}

export interface PersonalProfileDto {
  id: number;
  displayName: string;
  address: string | null;
  birthDate: string | null; // ISO date
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  contactEmail: string | null;
  contactPhone: string | null;
  latestTaxableIncome?: number | null;
  latestTaxYear?: number | null;
}

export interface UpdatePersonalProfilePayload {
  displayName?: string;
  address?: string | null;
  birthDate?: string | null; // ISO date string
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
}

// --- Tax return (full structure with lines and slips) ---
export type TaxSection = 'INCOME' | 'DEDUCTION' | 'CREDIT' | 'CARRYFORWARD' | 'PAYMENT' | 'OTHER';

export interface PersonalTaxReturnDto {
  id: number;
  shareholderId: number;
  taxYear: number;
  taxableIncome: number;
  federalTax: number;
  provincialTax: number;
  balanceDue: number;
  documentId: number | null;
  rawExtraction?: unknown | null;
}

export interface PersonalTaxReturnLineDto {
  id: number;
  section: TaxSection;
  code: string | null;
  label: string;
  amount: number;
  orderIndex: number;
  metadata?: unknown | null;
}

export interface TaxSlipLineDto {
  id: number;
  code: string | null;
  label: string;
  amount: number;
  orderIndex: number;
  metadata?: unknown | null;
}

export interface TaxSlipDto {
  id: number;
  slipType: string;
  issuer: string | null;
  accountNumber: string | null;
  documentId: number | null;
  metadata?: unknown | null;
  lines: TaxSlipLineDto[];
}

export interface PersonalTaxReturnResponse {
  return: PersonalTaxReturnDto | null;
  lines: PersonalTaxReturnLineDto[];
  slips: TaxSlipDto[];
}

export function usePersonalTaxReturn(shareholderId?: number | null, taxYear?: number | null) {
  return useQuery<PersonalTaxReturnResponse>({
    queryKey: ['personal-tax-return', shareholderId ?? 'all', taxYear ?? 'all'],
    enabled: Boolean(shareholderId && taxYear),
    queryFn: async () => {
      if (!shareholderId || !taxYear) {
        return { return: null, lines: [], slips: [] } as PersonalTaxReturnResponse;
      }
      const params = new URLSearchParams({
        shareholderId: String(shareholderId),
        taxYear: String(taxYear)
      });
      const { data } = await apiClient.get<PersonalTaxReturnResponse>(
        `/personal-incomes/returns?${params.toString()}`
      );
      return data;
    }
  });
}

export function usePersonalIncomeShareholders() {
  return useQuery<PersonalIncomeShareholderDto[]>({
    queryKey: ['personal-income-shareholders'],
    queryFn: async () => {
      const { data } = await apiClient.get<PersonalIncomeShareholderDto[]>('/personal-incomes/shareholders');
      return data;
    }
  });
}

export function usePersonalIncomes(shareholderId?: number | null, taxYear?: number | null) {
  return useQuery<PersonalIncomeDto[]>({
    queryKey: ['personal-incomes', shareholderId ?? 'all', taxYear ?? 'all'],
    enabled: Boolean(shareholderId && taxYear),
    queryFn: async () => {
      if (!shareholderId || !taxYear) {
        return [];
      }

      const params = new URLSearchParams({
        shareholderId: String(shareholderId),
        taxYear: String(taxYear)
      });
      const { data } = await apiClient.get<PersonalIncomeDto[]>(`/personal-incomes?${params.toString()}`);
      return data;
    }
  });
}

export function usePersonalProfile() {
  return useQuery<PersonalProfileDto>({
    queryKey: ['personal-profile'],
    queryFn: async () => {
      const { data } = await apiClient.get<PersonalProfileDto>('/personal-incomes/profile');
      return data;
    }
  });
}

export function useUpdatePersonalProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdatePersonalProfilePayload) => {
      const { data } = await apiClient.put<PersonalProfileDto>('/personal-incomes/profile', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-profile'] });
      queryClient.invalidateQueries({ queryKey: ['personal-income-shareholders'] });
    }
  });
}

export function usePersonalIncomeSummary(shareholderId?: number | null, taxYear?: number | null) {
  return useQuery<PersonalIncomeSummaryDto>({
    queryKey: ['personal-income-summary', shareholderId ?? 'all', taxYear ?? 'all'],
    enabled: Boolean(shareholderId && taxYear),
    queryFn: async () => {
      if (!shareholderId || !taxYear) {
        throw new Error('Actionnaire ou année fiscale invalide');
      }

      const params = new URLSearchParams({
        shareholderId: String(shareholderId),
        taxYear: String(taxYear)
      });
      const { data } = await apiClient.get<PersonalIncomeSummaryDto>(
        `/personal-incomes/summary?${params.toString()}`
      );
      return data;
    }
  });
}

function invalidatePersonalIncomeQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['personal-incomes'] });
  queryClient.invalidateQueries({ queryKey: ['personal-income-summary'] });
  queryClient.invalidateQueries({ queryKey: ['summary'] });
}

export function useCreatePersonalIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PersonalIncomePayload) => {
      const { data } = await apiClient.post<PersonalIncomeDto>('/personal-incomes', payload);
      return data;
    },
    onSuccess: () => {
      invalidatePersonalIncomeQueries(queryClient);
    }
  });
}

export function useUpdatePersonalIncome(incomeId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PersonalIncomePayload) => {
      if (!incomeId) {
        throw new Error('Identifiant du revenu personnel manquant');
      }

      const { data } = await apiClient.put<PersonalIncomeDto>(`/personal-incomes/${incomeId}`, payload);
      return data;
    },
    onSuccess: () => {
      invalidatePersonalIncomeQueries(queryClient);
    }
  });
}

export function useDeletePersonalIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/personal-incomes/${id}`);
    },
    onSuccess: () => {
      invalidatePersonalIncomeQueries(queryClient);
    }
  });
}

export interface ImportPersonalTaxResultItem {
  category: PersonalIncomeCategory | string;
  label: string;
  amount: number;
  source?: string | null;
  slipType?: string | null;
}

export interface ImportPersonalTaxResponse {
  shareholderId: number;
  taxYear: number;
  extracted: ImportPersonalTaxResultItem[];
  createdIds: number[];
  documentId?: number;
  taxReturnId?: number;
  duplicate?: boolean;
  status?: 'OK' | 'PARTIAL' | 'INCOMPLETE' | 'DUPLICATE';
}

export function useImportPersonalTaxReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      file: File | Blob;
      shareholderId?: number | null;
      taxYear?: number | null;
      autoCreate?: boolean;
      postToLedger?: boolean;
    }): Promise<ImportPersonalTaxResponse> => {
      const form = new FormData();
      form.append('file', params.file);
      const sp = new URLSearchParams();
      sp.set('domain', 'personal-income');
      if (params.shareholderId) sp.set('shareholderId', String(params.shareholderId));
      if (params.taxYear) sp.set('taxYear', String(params.taxYear));
      if (typeof params.autoCreate === 'boolean') sp.set('autoCreate', String(params.autoCreate));
      if (typeof params.postToLedger === 'boolean') sp.set('postToLedger', String(params.postToLedger));
      const { data } = await apiClient.post<ImportPersonalTaxResponse>(
        `/ai/ingest?${sp.toString()}`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return data;
    },
    onSuccess: () => {
      invalidatePersonalIncomeQueries(queryClient);
    }
  });
}

// --- Why/personal-income ---
export interface WhyPersonalIncomeDto {
  shareholder: { id: number; displayName: string };
  taxYear: number;
  totalIncome: number;
  items: { id: number; category: PersonalIncomeCategory | string; label: string; amount: number; source?: string | null; slipType?: string | null }[];
  taxReturn: {
    id: number;
    taxableIncome: number;
    federalTax: number;
    provincialTax: number;
    balanceDue: number;
    lines: { id: number; section: string; code: string | null; label: string; amount: number; orderIndex: number }[];
    slips: { id: number; slipType: string; issuer: string | null; accountNumber: string | null; lines: { id: number; code: string | null; label: string; amount: number; orderIndex: number }[] }[];
  } | null;
  journal: { entries: { id: number; entryDate: string; description: string | null; reference: string | null; lines: { id: number; accountCode: string; debit: number; credit: number; memo: string | null }[] }[] };
}

export function useWhyPersonalIncome(shareholderId?: number | null, taxYear?: number | null) {
  return useQuery<WhyPersonalIncomeDto>({
    queryKey: ['why-personal-income', shareholderId ?? 'all', taxYear ?? 'all'],
    enabled: Boolean(shareholderId && taxYear),
    queryFn: async () => {
      if (!shareholderId || !taxYear) {
        throw new Error('Paramètres manquants');
      }
      const params = new URLSearchParams({ shareholderId: String(shareholderId), taxYear: String(taxYear) });
      const { data } = await apiClient.get<WhyPersonalIncomeDto>(`/why/personal-income?${params.toString()}`);
      return data;
    }
  });
}
