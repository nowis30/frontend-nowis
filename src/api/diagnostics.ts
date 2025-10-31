import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

export type DagNodeId = 'Tax' | 'Compta' | 'Immobilier' | 'Previsions' | 'Decideur';

export interface WhyPersonalIncomeLine {
  id: number;
  section: 'INCOME' | 'DEDUCTION' | 'CREDIT' | 'CARRYFORWARD' | 'PAYMENT' | 'OTHER';
  code: string | null;
  label: string;
  amount: number;
  orderIndex: number;
}

export interface WhyPersonalIncomeSlipLine {
  id: number;
  code: string | null;
  label: string;
  amount: number;
  orderIndex: number;
}

export interface WhyPersonalIncomeSlip {
  id: number;
  slipType: string;
  issuer: string | null;
  accountNumber: string | null;
  lines: WhyPersonalIncomeSlipLine[];
}

export interface WhyPersonalIncomeJournalLine {
  id: number;
  accountCode: string;
  debit: number;
  credit: number;
  memo: string | null;
}

export interface WhyPersonalIncomeJournalEntry {
  id: number;
  entryDate: string; // ISO
  description: string | null;
  reference: string | null;
  lines: WhyPersonalIncomeJournalLine[];
}

export interface WhyPersonalIncomeResponse {
  shareholder: { id: number; displayName: string };
  taxYear: number;
  totalIncome: number;
  items: Array<{ id: number; category: string; label: string; amount: number; source?: string | null; slipType?: string | null }>;
  taxReturn: null | {
    id: number;
    taxableIncome: number;
    federalTax: number;
    provincialTax: number;
    balanceDue: number;
    lines: WhyPersonalIncomeLine[];
    slips: WhyPersonalIncomeSlip[];
  };
  journal: { entries: WhyPersonalIncomeJournalEntry[] };
}

export function useWhyPersonalIncome(shareholderId?: number | null, taxYear?: number | null) {
  return useQuery<WhyPersonalIncomeResponse>({
    queryKey: ['why-personal-income', shareholderId ?? 'all', taxYear ?? 'all'],
    enabled: Boolean(shareholderId && taxYear),
    queryFn: async () => {
      if (!shareholderId || !taxYear) throw new Error('invalid');
      const params = new URLSearchParams({ shareholderId: String(shareholderId), taxYear: String(taxYear) });
      const { data } = await apiClient.get<WhyPersonalIncomeResponse>(`/why/personal-income?${params.toString()}`);
      return data;
    }
  });
}

export interface RecentEvent {
  type: string;
  at: string; // ISO
  [key: string]: unknown;
}

export function useRecentEvents(limit = 20) {
  return useQuery<RecentEvent[]>({
    queryKey: ['recent-events', limit],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit) });
      const { data } = await apiClient.get<RecentEvent[]>(`/events/recent?${params.toString()}`);
      return data;
    }
  });
}

export function useGraphNodes() {
  return useQuery<{ nodes: DagNodeId[] }>({
    queryKey: ['graph-nodes'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ nodes: DagNodeId[] }>(`/graph/nodes`);
      return data;
    }
  });
}

export function useGraphOutputs() {
  return useQuery<Record<string, unknown>>({
    queryKey: ['graph-outputs'],
    queryFn: async () => {
      const { data } = await apiClient.get<Record<string, unknown>>(`/graph/outputs`);
      return data;
    }
  });
}

export function useGraphRecalc() {
  return useMutation({
    // Accept either a DagNodeId or an object with { source, year }
    mutationFn: async (input: DagNodeId | { source: DagNodeId; year?: number | null }) => {
      const payload = typeof input === 'string' ? { source: input } : { source: input.source, year: input.year ?? undefined };
      const { data } = await apiClient.post<{ at: string; source: DagNodeId; order: DagNodeId[] }>(`/graph/recalc`, payload);
      return data;
    }
  });
}
