import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

export type InsightSeverity = 'info' | 'warning' | 'critical';

export interface ProfileInsight {
  code: string;
  severity: InsightSeverity;
  message: string;
  context?: Record<string, string | number>;
}

export function useProfileInsights() {
  return useQuery<ProfileInsight[]>({
    queryKey: ['profile', 'insights'],
    queryFn: async () => {
      const { data } = await apiClient.get<ProfileInsight[]>('/profile/insights');
      return data;
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000
  });
}
