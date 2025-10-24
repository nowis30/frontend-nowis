import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './client';

export interface UserRoleAssignment {
  id: number;
  roleId: number;
  roleName: string;
  companyId: number | null;
  companyName: string | null;
}

export interface UserRecord {
  id: number;
  email: string;
  createdAt: string;
  updatedAt: string;
  roles: UserRoleAssignment[];
}

export interface CreateUserPayload {
  email: string;
  password: string;
  roles: Array<{
    roleId: number;
    companyId?: number | null;
  }>;
}

export function useUsers() {
  return useQuery<UserRecord[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await apiClient.get<UserRecord[]>('/users');
      return data;
    }
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      const { data } = await apiClient.post<UserRecord>('/users', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });
}
