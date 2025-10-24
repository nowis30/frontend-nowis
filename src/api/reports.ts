import { useQuery } from '@tanstack/react-query';

import { apiClient } from './client';

export interface ReportsOverviewResponse {
  generatedAt: string;
  totals: {
    users: number;
    companies: number;
    properties: number;
    revenue: number;
    expenses: number;
    statements: number;
    resolutions: number;
  };
  roles: Array<{
    roleId: number;
    roleName: string;
    assignments: number;
  }>;
  topCompaniesByEquity: Array<{
    companyId: number;
    companyName: string;
    periodEnd: string;
    totalEquity: number;
    netIncome: number;
  }>;
  recentActivity: Array<{
    type: 'STATEMENT' | 'RESOLUTION';
    id: number;
    companyId: number;
    companyName: string;
    date: string;
    label: string;
  }>;
}

export function useReportsOverview(enabled = true) {
  return useQuery<ReportsOverviewResponse>({
    queryKey: ['reports', 'overview'],
    enabled,
    queryFn: async () => {
      const { data } = await apiClient.get<ReportsOverviewResponse>('/reports/overview');
      return data;
    }
  });
}
