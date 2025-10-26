import { useMutation, useQuery } from '@tanstack/react-query';

import { apiClient } from './client';

export interface FreezeShareholderDto {
  id: number;
  displayName: string;
  relationship: 'FOUNDER' | 'SPOUSE' | 'CHILD' | 'TRUST' | 'HOLDCO' | 'OTHER';
  currentFairValue: number;
  dividendPreference: number;
  marginalTaxRatePercent: number;
}

export interface FreezeAssetDto {
  id: number;
  label: string;
  fairMarketValue: number;
  annualGrowthPercent: number;
  distributionYieldPercent: number;
}

export interface FreezeScenarioDto {
  id: number;
  label: string;
  baseYear: number;
  freezeRatePercent: number;
  preferredDividendRatePercent: number;
  redemptionYears: number;
  createdAt: string;
  updatedAt: string;
}

export interface FreezeSimulationInputs {
  scenarioId: number;
  assetIds: number[];
  targetFreezeYear: number;
  generations: number;
  reinvestmentRatePercent: number;
  marginalTaxRatePercent: number;
  dividendRetentionPercent: number;
}

export interface FreezeSimulationResult {
  scenarioId: number;
  targetFreezeYear: number;
  preferredShareValue: number;
  capitalGainTriggered: number;
  capitalGainTax: number;
  dividendStream: Array<{
    year: number;
    amount: number;
    taxableAmount: number;
    afterTaxRetained: number;
  }>;
  redemptionSchedule: Array<{
    year: number;
    outstanding: number;
    redeemed: number;
  }>;
  familyTrustAllocation: Array<{
    beneficiaryId: number;
    beneficiaryName: string;
    cumulativeValue: number;
  }>;
  notes: string[];
}

export interface FreezeScenarioPayload {
  label: string;
  baseYear: number;
  freezeRatePercent: number;
  preferredDividendRatePercent: number;
  redemptionYears: number;
  notes?: string | null;
}

export function useFreezeShareholders() {
  return useQuery<FreezeShareholderDto[]>({
    queryKey: ['freeze', 'shareholders'],
    queryFn: async () => {
      const { data } = await apiClient.get<FreezeShareholderDto[]>('/freeze/shareholders');
      return data;
    }
  });
}

export function useFreezeAssets() {
  return useQuery<FreezeAssetDto[]>({
    queryKey: ['freeze', 'assets'],
    queryFn: async () => {
      const { data } = await apiClient.get<FreezeAssetDto[]>('/freeze/assets');
      return data;
    }
  });
}

export function useFreezeScenarios() {
  return useQuery<FreezeScenarioDto[]>({
    queryKey: ['freeze', 'scenarios'],
    queryFn: async () => {
      const { data } = await apiClient.get<FreezeScenarioDto[]>('/freeze/scenarios');
      return data;
    }
  });
}

export function useCreateFreezeScenario() {
  return useMutation({
    mutationFn: async (payload: FreezeScenarioPayload) => {
      const { data } = await apiClient.post<FreezeScenarioDto>('/freeze/scenarios', payload);
      return data;
    }
  });
}

export function useDeleteFreezeScenario() {
  return useMutation({
    mutationFn: async (scenarioId: number) => {
      await apiClient.delete(`/freeze/scenarios/${scenarioId}`);
    }
  });
}

export function useRunFreezeSimulation() {
  return useMutation({
    mutationFn: async (payload: FreezeSimulationInputs) => {
      const { data } = await apiClient.post<FreezeSimulationResult>('/freeze/simulations', payload);
      return data;
    }
  });
}