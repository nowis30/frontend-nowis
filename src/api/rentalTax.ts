import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './client';

export type RentalTaxFormType = 'T776' | 'TP128';

export interface RentalTaxExpenseLine {
  key: string;
  label: string;
  amount: number;
  category?: string | null;
}

export interface RentalTaxIncomeLine {
  key: string;
  label: string;
  amount: number;
}

export interface RentalTaxComputedData {
  grossRents: number;
  otherIncome: number;
  totalIncome: number;
  expenses: RentalTaxExpenseLine[];
  totalExpenses: number;
  netIncome: number;
  mortgageInterest: number;
  capitalCostAllowance: number;
  incomeDetails: RentalTaxIncomeLine[];
}

export interface RentalTaxFormPayload {
  income: {
    grossRents: number;
    otherIncome: number;
    totalIncome: number;
  };
  expenses: RentalTaxExpenseLine[];
  totals: {
    totalExpenses: number;
    netIncome: number;
  };
}

export interface RentalTaxStatementDto {
  id: number;
  formType: RentalTaxFormType;
  taxYear: number;
  propertyId: number | null;
  propertyName: string | null;
  propertyAddress: string | null;
  payload: RentalTaxFormPayload;
  computed: RentalTaxComputedData;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RentalTaxPrepareResponse {
  taxYear: number;
  formType: RentalTaxFormType;
  property: {
    id: number;
    name: string;
    address: string | null;
  } | null;
  computed: RentalTaxComputedData;
  payloadTemplate: RentalTaxFormPayload;
  previous?: RentalTaxStatementDto | null;
}

export interface RentalTaxPreparePayload {
  taxYear: number;
  formType: RentalTaxFormType;
  propertyId?: number | null;
}

export interface RentalTaxCreatePayload extends RentalTaxPreparePayload {
  payload: RentalTaxFormPayload;
  notes?: string | null;
}

export function useRentalTaxStatements() {
  return useQuery<RentalTaxStatementDto[]>({
    queryKey: ['rental-tax', 'statements'],
    queryFn: async () => {
      const { data } = await apiClient.get<RentalTaxStatementDto[]>('/tax/rental-statements');
      return data;
    }
  });
}

export async function prepareRentalTaxStatement(
  payload: RentalTaxPreparePayload
): Promise<RentalTaxPrepareResponse> {
  const { data } = await apiClient.post<RentalTaxPrepareResponse>(
    '/tax/rental-statements/prepare',
    payload
  );
  return data;
}

export function useCreateRentalTaxStatement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RentalTaxCreatePayload) => {
      const { data } = await apiClient.post<RentalTaxStatementDto>('/tax/rental-statements', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental-tax', 'statements'] });
    }
  });
}

export async function downloadRentalTaxPdf(id: number): Promise<Blob> {
  const { data } = await apiClient.get(`/tax/rental-statements/${id}/pdf`, {
    responseType: 'blob'
  });
  return data;
}
