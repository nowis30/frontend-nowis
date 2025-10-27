import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
  simulationId: number;
  scenarioId: number;
  targetFreezeYear: number;
  preferredShareValue: number;
  capitalGainTriggered: number;
  capitalGainTax: number;
  totalDividends: number;
  totalAfterTaxRetained: number;
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
    beneficiaryId: number | null;
    beneficiaryName: string;
    cumulativeValue: number;
  }>;
  notes: Array<{ label: string; value: string }>;
}

export type SuccessionStepStatus = 'todo' | 'in_progress' | 'done';

export interface SuccessionProgressStep {
  id: string;
  label: string;
  status: SuccessionStepStatus;
  summary?: string;
  blockers?: string[];
  completedAt?: string | null;
}

export interface SuccessionProgressReport {
  generatedAt: string;
  completionRatio: number;
  steps: SuccessionProgressStep[];
  stats: {
    shareholders: number;
    trusts: number;
    assets: number;
    scenarios: number;
    simulations: number;
  };
  latestSimulation?: {
    id: number;
    scenarioId: number;
    generatedAt: string;
    inputs: {
      targetFreezeYear: number;
      generations: number;
      reinvestmentRatePercent: number;
      marginalTaxRatePercent: number;
      dividendRetentionPercent: number;
    };
    metrics?: {
      preferredShareValue: number;
      capitalGainTriggered: number;
      capitalGainTax: number;
      totalDividends: number;
      totalAfterTaxRetained: number;
      latentTaxBefore: number;
      latentTaxAfter: number;
    };
    counts?: {
      redemptions: number;
      dividends: number;
      beneficiaries: number;
    };
  };
  nextAction: {
    stepId: string | null;
    label: string;
    suggestion: string;
  };
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

function formatSimulationNotes(notes: Record<string, unknown> | null | undefined): Array<{ label: string; value: string }> {
  if (!notes || typeof notes !== 'object') {
    return [];
  }

  return Object.entries(notes).map(([key, rawValue]) => {
    let value = '';
    if (typeof rawValue === 'number') {
      value = new Intl.NumberFormat('fr-CA', {
        maximumFractionDigits: 2
      }).format(rawValue);
    } else if (typeof rawValue === 'string') {
      value = rawValue;
    } else {
      value = JSON.stringify(rawValue);
    }
    return {
      label: key,
      value
    };
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FreezeSimulationInputs): Promise<FreezeSimulationResult> => {
      type BackendSimulation = {
        id: number;
        scenarioId: number;
        targetFreezeYear: number;
        result: {
          preferredShareValue: number;
          capitalGainTriggered: number;
          capitalGainTax: number;
          totalDividends: number;
          totalAfterTaxRetained: number;
          latentTaxBefore: number;
          latentTaxAfter: number;
          notes: Record<string, unknown> | null;
        } | null;
        beneficiaryResults: Array<{
          beneficiaryId: number | null;
          beneficiaryName: string;
          cumulativeValue: number;
        }>;
        redemptions: Array<{ year: number; outstanding: number; redeemed: number }>;
        dividends: Array<{ year: number; amount: number; taxableAmount: number; afterTaxRetained: number }>;
      };

      const { data } = await apiClient.post<BackendSimulation>('/freeze/simulations', payload);

      if (!data.result) {
        throw new Error('Simulation incomplète');
      }

      return {
        simulationId: data.id,
        scenarioId: data.scenarioId,
        targetFreezeYear: data.targetFreezeYear,
        preferredShareValue: data.result.preferredShareValue,
        capitalGainTriggered: data.result.capitalGainTriggered,
        capitalGainTax: data.result.capitalGainTax,
        totalDividends: data.result.totalDividends,
        totalAfterTaxRetained: data.result.totalAfterTaxRetained,
        dividendStream: data.dividends,
        redemptionSchedule: data.redemptions,
        familyTrustAllocation: data.beneficiaryResults,
        notes: formatSimulationNotes(data.result.notes)
      };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['freeze', 'progress'] });
      void queryClient.invalidateQueries({ queryKey: ['freeze', 'simulations'] });
    }
  });
}

export function useSuccessionProgress() {
  return useQuery<SuccessionProgressReport>({
    queryKey: ['freeze', 'progress'],
    queryFn: async () => {
      const { data } = await apiClient.get<SuccessionProgressReport>('/freeze/progress');
      return data;
    },
    refetchInterval: 60_000,
    staleTime: 30_000
  });
}