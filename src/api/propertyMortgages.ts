import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './client';

export interface PropertyMortgageDto {
  id: number;
  propertyId: number;
  lender: string;
  principal: number;
  rateAnnual: number;
  termMonths: number;
  amortizationMonths: number;
  startDate: string;
  paymentFrequency: number;
  paymentAmount: number;
  createdAt: string;
  updatedAt: string;
}

interface MortgagePayload {
  lender: string;
  principal: number;
  rateAnnual: number;
  termMonths: number;
  amortizationMonths: number;
  startDate: string;
  paymentFrequency: number;
}

export interface MortgagePreviewPayload {
  lender?: string;
  principal: number;
  rateAnnual: number;
  termMonths: number;
  amortizationMonths: number;
  startDate: string;
  paymentFrequency: number;
}

export interface MortgageAmortizationEntry {
  periodIndex: number;
  paymentDate: string;
  paymentAmount: number;
  interestPortion: number;
  principalPortion: number;
  remainingBalance: number;
}

export interface MortgageAmortizationAnnual {
  year: number;
  totalInterest: number;
  totalPrincipal: number;
  endingBalance: number;
}

export interface MortgagePreviewDto {
  paymentAmount: number;
  totalPeriods: number;
  payoffDate: string | null;
  totalPrincipal: number;
  totalInterest: number;
  totalPaid: number;
  termSummary: {
    periods: number;
    endDate: string | null;
    totalPrincipal: number;
    totalInterest: number;
    balanceRemaining: number;
  };
  annualBreakdown: MortgageAmortizationAnnual[];
  schedule: MortgageAmortizationEntry[];
}

export interface MortgageAnalysisDto {
  mortgage: PropertyMortgageDto;
  analysis: MortgagePreviewDto;
}

export function usePropertyMortgages(propertyId: number | null, enabled: boolean) {
  return useQuery<PropertyMortgageDto[]>({
    queryKey: ['propertyMortgages', propertyId],
    enabled: Boolean(enabled && propertyId),
    queryFn: async () => {
      if (!propertyId) {
        return [];
      }

      const { data } = await apiClient.get<PropertyMortgageDto[]>(
        `/properties/${propertyId}/mortgages`
      );
      return data;
    }
  });
}

export function useCreateMortgage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      propertyId,
      payload
    }: {
      propertyId: number;
      payload: MortgagePayload;
    }) => {
      const { data } = await apiClient.post<PropertyMortgageDto>(
        `/properties/${propertyId}/mortgages`,
        payload
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['propertyMortgages', variables.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    }
  });
}

export function useUpdateMortgage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      propertyId,
      mortgageId,
      payload
    }: {
      propertyId: number;
      mortgageId: number;
      payload: MortgagePayload;
    }) => {
      const { data } = await apiClient.put<PropertyMortgageDto>(
        `/properties/${propertyId}/mortgages/${mortgageId}`,
        payload
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['propertyMortgages', variables.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    }
  });
}

export function useDeleteMortgage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, mortgageId }: { propertyId: number; mortgageId: number }) => {
      await apiClient.delete(`/properties/${propertyId}/mortgages/${mortgageId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['propertyMortgages', variables.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    }
  });
}

export async function previewMortgage(propertyId: number, payload: MortgagePreviewPayload) {
  const { data } = await apiClient.post<MortgagePreviewDto>(
    `/properties/${propertyId}/mortgages/preview`,
    payload
  );
  return data;
}

export async function fetchMortgageAnalysis(propertyId: number, mortgageId: number) {
  const { data } = await apiClient.get<MortgageAnalysisDto>(
    `/properties/${propertyId}/mortgages/${mortgageId}/amortization`
  );
  return data;
}
