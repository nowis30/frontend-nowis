import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './client';

export interface FamilyWealthOverviewDto {
  asOf: string;
  totals: {
    assets: number;
    liabilities: number;
    netWorth: number;
  };
  breakdown: {
    personalProperty: {
      netValue: number;
      debt: number;
    };
    personalAssets: {
      total: number;
      liquid: number;
    };
    companies: {
      total: number;
      items: Array<{ companyId: number; name: string; netAssetValue: number; valuationDate: string | null }>;
    };
    trusts: {
      total: number;
      items: Array<{ trustId: number; name: string; netAssetValue: number }>;
    };
    liabilities: {
      personal: number;
      shareholderLoans: number;
      total: number;
    };
  };
  comparisons: {
    structure: Array<{ label: string; value: number }>;
    incomeMix: Array<{ label: string; value: number }>;
  };
  riskIndicators: {
    debtToAsset: number;
    liquidityCoverage: number;
    diversificationScore: number;
  };
  observations: string[];
}

export interface FamilyWealthHistoryPointDto {
  snapshotDate: string;
  netWorth: number;
  assets: number;
  liabilities: number;
  metadata: unknown;
}

export interface FamilyWealthScenarioDto {
  id?: number;
  label: string;
  scenarioType: string;
  timeline: Array<{ year: number; projectedNetWorth: number }>;
  assumptions: {
    growthRatePercent: number;
    drawdownPercent: number;
    annualContribution: number;
    annualWithdrawal: number;
  };
}

export interface CreateFamilyWealthScenarioPayload {
  label: string;
  scenarioType?: string;
  horizonYears: number;
  growthRatePercent?: number;
  drawdownPercent?: number;
  annualContribution?: number;
  annualWithdrawal?: number;
  persist?: boolean;
}

export interface StressTestPayload {
  rentDropPercent?: number;
  propertyValueShockPercent?: number;
  interestRateShockPercent?: number;
  marketShockPercent?: number;
}

export interface StressTestResultDto {
  baseNetWorth: number;
  stressedNetWorth: number;
  deltas: {
    netWorth: number;
    property: number;
    companies: number;
    trusts: number;
    liquidity: number;
  };
}

export interface FamilyWealthOverviewOptions {
  year?: number;
  persist?: boolean;
}

export function useFamilyWealthOverview(options: FamilyWealthOverviewOptions = {}) {
  const { year, persist } = options;

  return useQuery<FamilyWealthOverviewDto>({
    queryKey: ['family-wealth', 'overview', year ?? 'current', persist ?? false],
    queryFn: async () => {
      const params: Record<string, string | number | boolean> = {};
      if (typeof year === 'number') {
        params.year = year;
      }
      if (typeof persist === 'boolean') {
        params.persist = persist;
      }

      const { data } = await apiClient.get<FamilyWealthOverviewDto>('/wealth/family/overview', {
        params
      });
      return data;
    }
  });
}

export function useFamilyWealthHistory() {
  return useQuery<FamilyWealthHistoryPointDto[]>({
    queryKey: ['family-wealth', 'history'],
    queryFn: async () => {
      const { data } = await apiClient.get<FamilyWealthHistoryPointDto[]>('/wealth/family/history');
      return data;
    }
  });
}

export function useFamilyWealthScenarios() {
  return useQuery<FamilyWealthScenarioDto[]>({
    queryKey: ['family-wealth', 'scenarios'],
    queryFn: async () => {
      const { data } = await apiClient.get<FamilyWealthScenarioDto[]>('/wealth/family/scenarios');
      return data;
    }
  });
}

function invalidateWealthQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['family-wealth'] });
}

export function useCreateFamilyWealthScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateFamilyWealthScenarioPayload) => {
      const { data } = await apiClient.post<FamilyWealthScenarioDto>('/wealth/family/scenarios', payload);
      return data;
    },
    onSuccess: () => invalidateWealthQueries(queryClient)
  });
}

export function useDeleteFamilyWealthScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (scenarioId: number) => {
      await apiClient.delete(`/wealth/family/scenarios/${scenarioId}`);
    },
    onSuccess: () => invalidateWealthQueries(queryClient)
  });
}

export function useRunFamilyWealthStressTest() {
  return useMutation({
    mutationFn: async (payload: StressTestPayload) => {
      const { data } = await apiClient.post<StressTestResultDto>('/wealth/family/stress-test', payload);
      return data;
    }
  });
}
