import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export interface ReturnYearEntry {
  taxYear: number;
  shareholderId: number;
  shareholderName: string;
}

export interface PersonalReturnResponse {
  return: {
    id: number;
    shareholderId: number;
    taxYear: number;
    taxableIncome: number;
    federalTax: number;
    provincialTax: number;
    balanceDue: number;
    documentId: number | null;
    rawExtraction: unknown | null;
  } | null;
  lines: Array<{
    id: number;
    section: string;
    code: string | null;
    label: string;
    amount: number;
    orderIndex: number;
    metadata: unknown | null;
  }>;
  slips: Array<{
    id: number;
    slipType: string;
    issuer: string | null;
    accountNumber: string | null;
    documentId: number | null;
    metadata: unknown | null;
    lines: Array<{
      id: number;
      code: string | null;
      label: string;
      amount: number;
      orderIndex: number;
      metadata: unknown | null;
    }>;
  }>;
}

export function useAvailableReturnYears() {
  return useQuery<ReturnYearEntry[]>({
    queryKey: ['personal-returns', 'years'],
    queryFn: async () => {
      const { data } = await apiClient.get<ReturnYearEntry[]>(
        '/personal-incomes/returns/years'
      );
      return data;
    },
    staleTime: 60_000
  });
}

export function usePersonalReturn(shareholderId: number | undefined, taxYear: number | undefined) {
  return useQuery<PersonalReturnResponse>({
    queryKey: ['personal-returns', shareholderId, taxYear],
    queryFn: async () => {
      const { data } = await apiClient.get<PersonalReturnResponse>(
        '/personal-incomes/returns',
        {
          params: { shareholderId, taxYear }
        }
      );
      return data;
    },
    enabled: !!shareholderId && !!taxYear,
    staleTime: 60_000
  });
}

// Mutations for editing return lines and slips
export function useCreateReturnLine(returnId: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { section: string; code?: string | null; label: string; amount: number; orderIndex?: number; metadata?: unknown }) => {
      if (!returnId) throw new Error('returnId requis');
      const { data } = await apiClient.post<{ id: number }>(`/personal-incomes/returns/${returnId}/lines`, payload);
      return data;
    },
    onSuccess: (_data, _vars, _ctx) => {
      qc.invalidateQueries({ queryKey: ['personal-returns'] });
    }
  });
}

export function useUpdateReturnLine(returnId: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { lineId: number; payload: Partial<{ section: string; code: string | null; label: string; amount: number; orderIndex: number; metadata: unknown }> }) => {
      if (!returnId) throw new Error('returnId requis');
      await apiClient.put(`/personal-incomes/returns/${returnId}/lines/${args.lineId}`, args.payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-returns'] });
    }
  });
}

export function useDeleteReturnLine(returnId: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lineId: number) => {
      if (!returnId) throw new Error('returnId requis');
      await apiClient.delete(`/personal-incomes/returns/${returnId}/lines/${lineId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-returns'] });
    }
  });
}

export function useCreateSlip(returnId: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { slipType: string; issuer?: string | null; accountNumber?: string | null; orderIndex?: number; metadata?: unknown }) => {
      if (!returnId) throw new Error('returnId requis');
      const { data } = await apiClient.post<{ id: number }>(`/personal-incomes/returns/${returnId}/slips`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-returns'] });
    }
  });
}

export function useUpdateSlip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { slipId: number; payload: Partial<{ slipType: string; issuer: string | null; accountNumber: string | null; metadata: unknown }> }) => {
      await apiClient.put(`/personal-incomes/slips/${args.slipId}`, args.payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-returns'] });
    }
  });
}

export function useDeleteSlip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slipId: number) => {
      await apiClient.delete(`/personal-incomes/slips/${slipId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-returns'] });
    }
  });
}

export function useCreateSlipLine(slipId: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { code?: string | null; label: string; amount: number; orderIndex?: number; metadata?: unknown }) => {
      if (!slipId) throw new Error('slipId requis');
      const { data } = await apiClient.post<{ id: number }>(`/personal-incomes/slips/${slipId}/lines`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-returns'] });
    }
  });
}

export function useUpdateSlipLine(slipId: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { lineId: number; payload: Partial<{ code: string | null; label: string; amount: number; orderIndex: number; metadata: unknown }> }) => {
      if (!slipId) throw new Error('slipId requis');
      await apiClient.put(`/personal-incomes/slips/${slipId}/lines/${args.lineId}`, args.payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-returns'] });
    }
  });
}

export function useDeleteSlipLine(slipId: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lineId: number) => {
      if (!slipId) throw new Error('slipId requis');
      await apiClient.delete(`/personal-incomes/slips/${slipId}/lines/${lineId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-returns'] });
    }
  });
}

// Generic mutations (id passed at call time) — convenient when editing multiple slips/lines
export function useMutateReturnLines() {
  const qc = useQueryClient();
  return {
    create: useMutation({
      mutationFn: async (args: { returnId: number; payload: { section: string; code?: string | null; label: string; amount: number; orderIndex?: number; metadata?: unknown } }) => {
        const { data } = await apiClient.post<{ id: number }>(`/personal-incomes/returns/${args.returnId}/lines`, args.payload);
        return data;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-returns'] })
    }),
    update: useMutation({
      mutationFn: async (args: { returnId: number; lineId: number; payload: Partial<{ section: string; code: string | null; label: string; amount: number; orderIndex: number; metadata: unknown }> }) => {
        await apiClient.put(`/personal-incomes/returns/${args.returnId}/lines/${args.lineId}`, args.payload);
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-returns'] })
    }),
    remove: useMutation({
      mutationFn: async (args: { returnId: number; lineId: number }) => {
        await apiClient.delete(`/personal-incomes/returns/${args.returnId}/lines/${args.lineId}`);
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-returns'] })
    })
  };
}

export function useMutateSlips() {
  const qc = useQueryClient();
  return {
    create: useMutation({
      mutationFn: async (args: { returnId: number; payload: { slipType: string; issuer?: string | null; accountNumber?: string | null; orderIndex?: number; metadata?: unknown } }) => {
        const { data } = await apiClient.post<{ id: number }>(`/personal-incomes/returns/${args.returnId}/slips`, args.payload);
        return data;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-returns'] })
    }),
    update: useMutation({
      mutationFn: async (args: { slipId: number; payload: Partial<{ slipType: string; issuer: string | null; accountNumber: string | null; metadata: unknown }> }) => {
        await apiClient.put(`/personal-incomes/slips/${args.slipId}`, args.payload);
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-returns'] })
    }),
    remove: useMutation({
      mutationFn: async (args: { slipId: number }) => {
        await apiClient.delete(`/personal-incomes/slips/${args.slipId}`);
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-returns'] })
    })
  };
}

export function useMutateSlipLines() {
  const qc = useQueryClient();
  return {
    create: useMutation({
      mutationFn: async (args: { slipId: number; payload: { code?: string | null; label: string; amount: number; orderIndex?: number; metadata?: unknown } }) => {
        const { data } = await apiClient.post<{ id: number }>(`/personal-incomes/slips/${args.slipId}/lines`, args.payload);
        return data;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-returns'] })
    }),
    update: useMutation({
      mutationFn: async (args: { slipId: number; lineId: number; payload: Partial<{ code: string | null; label: string; amount: number; orderIndex: number; metadata: unknown }> }) => {
        await apiClient.put(`/personal-incomes/slips/${args.slipId}/lines/${args.lineId}`, args.payload);
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-returns'] })
    }),
    remove: useMutation({
      mutationFn: async (args: { slipId: number; lineId: number }) => {
        await apiClient.delete(`/personal-incomes/slips/${args.slipId}/lines/${args.lineId}`);
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-returns'] })
    })
  };
}
