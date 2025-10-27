import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './client';

export type LeverageSourceType = 'HOME_EQUITY' | 'RENTAL_PROPERTY' | 'HELOC' | 'CORPORATE_LOAN';
export type LeverageInvestmentVehicle = 'ETF' | 'STOCK' | 'REALESTATE' | 'BUSINESS' | 'FUND';

export interface LeverageSimulationPayload {
  label: string;
  sourceType: LeverageSourceType;
  principal: number;
  annualRate: number;
  termMonths: number;
  amortizationMonths?: number;
  startDate: string; // ISO string
  investmentVehicle: LeverageInvestmentVehicle;
  expectedReturnAnnual: number;
  expectedVolatility?: number;
  planHorizonYears: number;
  interestDeductible: boolean;
  marginalTaxRate?: number;
  companyId?: number;
  save?: boolean;
}

export interface LeverageScenarioSummary {
  annualDebtService: number;
  annualInterestCost: number;
  afterTaxDebtCost: number;
  expectedInvestmentReturn: number;
  netExpectedDelta: number;
  cashflowImpact: number;
  breakEvenReturn: number;
  details: {
    monthlyPayment: number;
    principalRepaidYearOne: number;
  };
}

export interface LeverageConversationResponse {
  summary: LeverageScenarioSummary;
  narrative: string;
  highlights: string[];
  savedScenarioId?: number;
}

export interface LeverageScenarioRecord {
  id: number;
  label: string;
  sourceType: LeverageSourceType;
  principal: string;
  rateAnnual: string;
  termMonths: number;
  amortizationMonths: number | null;
  startDate: string;
  interestDeductible: boolean;
  investmentVehicle: LeverageInvestmentVehicle;
  expectedReturnAnnual: string;
  expectedVolatility: string | null;
  planHorizonYears: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  companyId: number | null;
}

export async function listLeverageScenarios(): Promise<LeverageScenarioRecord[]> {
  const { data } = await apiClient.get<LeverageScenarioRecord[]>('/leverage');
  return data;
}

export async function runLeverageConversation(
  payload: LeverageSimulationPayload
): Promise<LeverageConversationResponse> {
  const { data } = await apiClient.post<LeverageConversationResponse>('/ai/leverage', payload);
  return data;
}

export function useLeverageScenarios() {
  return useQuery<LeverageScenarioRecord[]>({
    queryKey: ['leverage', 'scenarios'],
    queryFn: listLeverageScenarios
  });
}

export function useLeverageConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runLeverageConversation,
    onSuccess: (_data, variables) => {
      if (variables.save) {
        queryClient.invalidateQueries({ queryKey: ['leverage', 'scenarios'] });
      }
    }
  });
}
