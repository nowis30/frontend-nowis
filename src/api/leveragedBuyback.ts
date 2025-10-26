import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './client';

export interface LeveragedBuybackInputs {
  loanAmount: number;
  interestRatePercent: number;
  taxRatePercent: number;
  expectedGrowthPercent: number;
  termYears: number;
}

export interface LeveragedBuybackMetrics {
  monthlyPayment: number;
  totalInterest: number;
  taxShield: number;
  afterTaxInterest: number;
  projectedShareValue: number;
  projectedShareGain: number;
  netGain: number;
  breakEvenGrowth: number;
  breakEvenGrowthPercent: number;
  returnOnInvestment: number;
  returnOnInvestmentPercent: number;
  paybackYears: number | null;
  monthlyPaymentRounded: number;
}

export interface LeveragedBuybackSimulationResponse {
  inputs: LeveragedBuybackInputs;
  metrics: LeveragedBuybackMetrics;
}

export interface LeveragedBuybackScenarioDto extends LeveragedBuybackSimulationResponse {
  id: number;
  label: string | null;
  companyId: number | null;
  companyName: string | null;
  approved: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  generatedAt: string;
  resolutionId?: number | null;
}

export interface LeveragedBuybackPayload extends LeveragedBuybackInputs {
  label?: string | null;
  notes?: string | null;
  companyId?: number | null;
  approved?: boolean;
  companyName?: string | null;
}

export type LeveragedBuybackSimulationPayload = LeveragedBuybackInputs;

export async function simulateLeveragedBuyback(
  payload: LeveragedBuybackSimulationPayload
): Promise<LeveragedBuybackSimulationResponse> {
  const { data } = await apiClient.post<LeveragedBuybackSimulationResponse>(
    '/leveraged-buyback/simulate',
    payload
  );
  return data;
}

export function useLeveragedBuybackScenarios() {
  return useQuery<LeveragedBuybackScenarioDto[]>({
    queryKey: ['leveraged-buyback', 'scenarios'],
    queryFn: async () => {
      const { data } = await apiClient.get<LeveragedBuybackScenarioDto[]>('/leveraged-buyback');
      return data;
    }
  });
}

export function useCreateLeveragedBuybackScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: LeveragedBuybackPayload) => {
      const { data } = await apiClient.post<LeveragedBuybackScenarioDto>('/leveraged-buyback', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leveraged-buyback', 'scenarios'] });
    }
  });
}

export async function downloadLeveragedBuybackPdfById(id: number): Promise<Blob> {
  const { data } = await apiClient.get(`/leveraged-buyback/${id}/pdf`, {
    responseType: 'blob'
  });
  return data;
}

export async function downloadLeveragedBuybackSnapshotPdf(
  payload: LeveragedBuybackPayload
): Promise<Blob> {
  const { data } = await apiClient.post('/leveraged-buyback/report', payload, {
    responseType: 'blob'
  });
  return data;
}
