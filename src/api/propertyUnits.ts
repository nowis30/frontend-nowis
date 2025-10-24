import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './client';

export interface PropertyUnitDto {
  id: number;
  propertyId: number;
  label: string;
  squareFeet: number | null;
  rentExpected: number | null;
}

interface UnitPayload {
  label: string;
  squareFeet?: number | null;
  rentExpected?: number | null;
}

export function usePropertyUnits(propertyId: number | null, enabled: boolean) {
  return useQuery<PropertyUnitDto[]>({
    queryKey: ['propertyUnits', propertyId],
    enabled: Boolean(enabled && propertyId),
    queryFn: async () => {
      if (!propertyId) {
        return [];
      }

      const { data } = await apiClient.get<PropertyUnitDto[]>(`/properties/${propertyId}/units`);
      return data;
    }
  });
}

export function useCreateUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, payload }: { propertyId: number; payload: UnitPayload }) => {
      const { data } = await apiClient.post<PropertyUnitDto>(`/properties/${propertyId}/units`, payload);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['propertyUnits', variables.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    }
  });
}

export function useUpdateUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      propertyId,
      unitId,
      payload
    }: {
      propertyId: number;
      unitId: number;
      payload: UnitPayload;
    }) => {
      const { data } = await apiClient.put<PropertyUnitDto>(
        `/properties/${propertyId}/units/${unitId}`,
        payload
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['propertyUnits', variables.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    }
  });
}

export function useDeleteUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, unitId }: { propertyId: number; unitId: number }) => {
      await apiClient.delete(`/properties/${propertyId}/units/${unitId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['propertyUnits', variables.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    }
  });
}
