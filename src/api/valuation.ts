import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './client';

export interface ValuationTotals {
  totalMarketValue: number;
  totalDebt: number;
  netAssetValue: number;
}

export interface ValuationPropertyEntry {
  propertyId: number;
  name: string;
  address: string | null;
  marketValue: number;
  debtOutstanding: number;
  netValue: number;
}

export interface ShareClassValuationEntry {
  shareClassId: number;
  code: string;
  description: string | null;
  participatesInGrowth: boolean;
  totalShares: number;
  pricePerShare: number;
  totalValue: number;
}

export interface ShareholderEquityBreakdownEntry {
  shareClassId: number;
  shareClassCode: string;
  participatesInGrowth: boolean;
  shares: number;
  equityValue: number;
}

export interface ShareholderEquityEntry {
  shareholderId: number;
  displayName: string;
  totalShares: number;
  participatingShares: number;
  ownershipPercent: number;
  equityValue: number;
  breakdown: ShareholderEquityBreakdownEntry[];
}

export interface ValuationSnapshotDto {
  id: number;
  companyId: number | null;
  companyName: string | null;
  valuationDate: string;
  totals: ValuationTotals;
  properties: ValuationPropertyEntry[];
  shareClasses: ShareClassValuationEntry[];
  shareholders: ShareholderEquityEntry[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShareholderHistoryPoint {
  valuationDate: string;
  equityValue: number;
  ownershipPercent: number;
}

export interface ShareholderHistoryEntry {
  shareholderId: number;
  displayName: string;
  timeline: ShareholderHistoryPoint[];
}

export interface ValuationHistoryResponse {
  history: ShareholderHistoryEntry[];
  timeline: Array<{
    id: number;
    companyId: number | null;
    companyName: string | null;
    valuationDate: string;
    netAssetValue: number;
  }>;
}

export interface CreateSnapshotPayload {
  companyId: number;
  valuationDate?: string | Date;
  notes?: string | null;
}

export function useValuationSnapshots(companyId?: number) {
  return useQuery<ValuationSnapshotDto[]>({
    queryKey: ['valuation', 'snapshots', companyId ?? 'all'],
    queryFn: async () => {
      const { data } = await apiClient.get<ValuationSnapshotDto[]>('/valuation/snapshots', {
        params: { companyId }
      });
      return data;
    }
  });
}

export function useCreateValuationSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateSnapshotPayload) => {
      const { data } = await apiClient.post<ValuationSnapshotDto>('/valuation/snapshots', payload);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['valuation', 'snapshots', variables.companyId ?? 'all'] });
      queryClient.invalidateQueries({ queryKey: ['valuation', 'history', variables.companyId ?? 'all'] });
    }
  });
}

export function useDeleteValuationSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (snapshotId: number) => {
      await apiClient.delete(`/valuation/snapshots/${snapshotId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['valuation', 'snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['valuation', 'history'] });
    }
  });
}

export function useValuationHistory(companyId?: number) {
  return useQuery<ValuationHistoryResponse>({
    queryKey: ['valuation', 'history', companyId ?? 'all'],
    queryFn: async () => {
      const { data } = await apiClient.get<ValuationHistoryResponse>(
        '/valuation/history/shareholders',
        {
          params: { companyId }
        }
      );
      return data;
    }
  });
}

export async function downloadValuationPdf(snapshotId: number): Promise<Blob> {
  const { data } = await apiClient.post(`/valuation/snapshots/${snapshotId}/export/pdf`, undefined, {
    responseType: 'blob'
  });
  return data;
}

export async function downloadValuationCsv(snapshotId: number): Promise<Blob> {
  const { data } = await apiClient.post(`/valuation/snapshots/${snapshotId}/export/csv`, undefined, {
    responseType: 'blob'
  });
  return data;
}
