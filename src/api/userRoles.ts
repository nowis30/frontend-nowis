import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './client';

export interface UserRolePayload {
  userId: number;
  roleId: number;
  companyId?: number | null;
}

export function useCreateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UserRolePayload) => {
      const { data } = await apiClient.post('/userRoles', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });
}

export function useDeleteUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: number) => {
      await apiClient.delete(`/userRoles/${assignmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });
}
