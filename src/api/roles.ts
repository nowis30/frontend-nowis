import { useQuery } from '@tanstack/react-query';

import { apiClient } from './client';

export interface RoleRecord {
  id: number;
  name: string;
}

export function useRoles() {
  return useQuery<RoleRecord[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data } = await apiClient.get<RoleRecord[]>('/roles');
      return data;
    }
  });
}
