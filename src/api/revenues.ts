import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './client';

export type RevenueFrequency = 'PONCTUEL' | 'HEBDOMADAIRE' | 'MENSUEL' | 'TRIMESTRIEL' | 'ANNUEL';

export interface RevenuePayload {
  propertyId: number;
  label: string;
  amount: number;
  frequency: RevenueFrequency;
  startDate: string;
  endDate?: string | null;
}

export interface RevenueDto extends RevenuePayload {
  id: number;
  property: {
    id: number;
    name: string;
  };
}

export interface RevenueImportError {
  line: number;
  message: string;
}

export interface RevenueImportResult {
  inserted: number;
  errors: RevenueImportError[];
  items: RevenueDto[];
}

export function useRevenues(propertyId?: number | null) {
  return useQuery<RevenueDto[]>({
    queryKey: ['revenues', propertyId ?? 'all'],
    queryFn: async () => {
      const query = propertyId ? `?propertyId=${propertyId}` : '';
      const { data } = await apiClient.get<RevenueDto[]>(`/revenues${query}`);
      return data;
    }
  });
}

export function useCreateRevenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RevenuePayload) => {
      const { data } = await apiClient.post<RevenueDto>('/revenues', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    }
  });
}

export function useUpdateRevenue(revenueId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RevenuePayload) => {
      if (!revenueId) {
        throw new Error('Identifiant de revenu manquant');
      }

      const { data } = await apiClient.put<RevenueDto>(`/revenues/${revenueId}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    }
  });
}

export function useDeleteRevenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/revenues/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    }
  });
}

export function useImportRevenues() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const content = await file.text();
      const { data } = await apiClient.post<RevenueImportResult>('/revenues/import', content, {
        headers: { 'Content-Type': 'text/csv' }
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    }
  });
}
