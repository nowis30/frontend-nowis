import { useQuery } from '@tanstack/react-query';

import { apiClient } from './client';

export interface DividendRecord {
  id: number;
  companyId: number;
  shareholderId: number;
  shareClassId?: number | null;
  declarationDate: string;
  recordDate?: string | null;
  paymentDate?: string | null;
  amount: number;
  dividendType: 'ELIGIBLE' | 'NON_ELIGIBLE';
  notes?: string | null;
}

export interface ReturnOfCapitalRecord {
  id: number;
  companyId: number;
  shareholderId: number;
  shareClassId?: number | null;
  transactionDate: string;
  amount: number;
  notes?: string | null;
}

export function useDividends(year?: number) {
  return useQuery({
    queryKey: ['dividends', year ?? 'all'],
    queryFn: async () => {
      const { data } = await apiClient.get<DividendRecord[]>('/corporate/dividends', {
        params: year ? { year } : undefined
      });
      return data;
    }
  });
}

export function useReturnsOfCapital(year?: number) {
  return useQuery({
    queryKey: ['returns-of-capital', year ?? 'all'],
    queryFn: async () => {
      const { data } = await apiClient.get<ReturnOfCapitalRecord[]>('/corporate/returns-of-capital', {
        params: year ? { year } : undefined
      });
      return data;
    }
  });
}
