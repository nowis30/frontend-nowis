import { useQuery } from '@tanstack/react-query';

import { apiClient } from './client';

export interface PropertyOption {
  id: number;
  name: string;
}

interface PropertyResponse extends PropertyOption {
  address?: string;
}

export function usePropertyOptions() {
  return useQuery<PropertyOption[]>({
    queryKey: ['properties', 'options'],
    queryFn: async () => {
      const { data } = await apiClient.get<PropertyResponse[]>('/properties');
      return data.map((property) => ({ id: property.id, name: property.name }));
    }
  });
}
