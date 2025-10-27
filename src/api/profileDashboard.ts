import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

export interface ProfileProjectionPoint {
  month: string;
  projectedNetWorth: number;
  projectedChange: number;
}

export interface ProfileProjectionAssumptions {
  baselineNetWorth: number;
  averageMonthlyChange: number;
  averageMonthlyGrowthRate: number;
  monthlyExpenses: number;
}

export interface ProfileProjection {
  timeline: ProfileProjectionPoint[];
  assumptions: ProfileProjectionAssumptions;
  notes: string[];
}

export interface ProfileDashboardPayload {
  generatedAt: string;
  summary: {
    totals: {
      personalAssets: number;
      investmentHoldings: number;
      personalLiabilities: number;
      netWorth: number;
      annualExpenses: number;
      monthlyExpenses: number;
    };
    breakdowns: unknown;
    goals: unknown;
  };
  insights: unknown;
  wealth: {
    overview: unknown;
    history: unknown;
  };
  projection: ProfileProjection;
}

export function useProfileDashboard() {
  return useQuery<ProfileDashboardPayload>({
    queryKey: ['profile', 'dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get<ProfileDashboardPayload>('/profile/dashboard');
      return data;
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000
  });
}
