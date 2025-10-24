import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './client';

export interface DepreciationSettings {
  classCode: string;
  ccaRate: number; // stored as decimal (0.04)
  openingUcc: number;
  additions: number;
  dispositions: number;
}

export function useDepreciation(propertyId: number | null, enabled: boolean) {
  return useQuery<DepreciationSettings>({
    queryKey: ['depreciation', propertyId],
    enabled: Boolean(propertyId) && enabled,
    queryFn: async () => {
      const { data } = await apiClient.get<DepreciationSettings>(`/properties/${propertyId}/depreciation`);
      return data;
    }
  });
}

export function useSaveDepreciation(propertyId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: DepreciationSettings) => {
      const { data } = await apiClient.put<DepreciationSettings>(
        `/properties/${propertyId}/depreciation`,
        payload
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['depreciation', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    }
  });
}
