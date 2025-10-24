import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './client';

export type ExpenseFrequency = 'PONCTUEL' | 'HEBDOMADAIRE' | 'MENSUEL' | 'TRIMESTRIEL' | 'ANNUEL';

export interface ExpensePayload {
  propertyId: number;
  label: string;
  category: string;
  amount: number;
  frequency: ExpenseFrequency;
  startDate: string;
  endDate?: string | null;
}

export interface ExpenseDto extends ExpensePayload {
  id: number;
  property: {
    id: number;
    name: string;
  };
}

export function useExpenses() {
  return useQuery<ExpenseDto[]>({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data } = await apiClient.get<ExpenseDto[]>('/expenses');
      return data;
    }
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ExpensePayload) => {
      const { data } = await apiClient.post<ExpenseDto>('/expenses', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    }
  });
}

export function useUpdateExpense(expenseId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ExpensePayload) => {
      if (!expenseId) {
        throw new Error("Identifiant de dépense manquant");
      }

      const { data } = await apiClient.put<ExpenseDto>(`/expenses/${expenseId}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    }
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    }
  });
}

export function useExportFiscalExpenses() {
  return useMutation({
    mutationFn: async ({ year }: { year: number }) => {
      const response = await apiClient.get(`/expenses/export/fiscal?year=${year}&format=csv`, {
        responseType: 'blob'
      });
      return response.data as Blob;
    }
  });
}
