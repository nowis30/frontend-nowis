import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export interface DocumentDto {
  id: number;
  domain: string;
  label: string;
  notes: string | null;
  originalName: string;
  contentType: string;
  size: number;
  storagePath: string;
  checksum: string | null;
  taxYear: number | null;
  shareholderId: number | null;
  metadata?: any | null;
  createdAt: string;
  updatedAt: string;
}

export function useDocuments(params?: { domain?: string; taxYear?: number | null }) {
  const sp = new URLSearchParams();
  if (params?.domain) sp.set('domain', params.domain);
  if (params?.taxYear) sp.set('taxYear', String(params.taxYear));
  const key = ['documents', params?.domain ?? 'all', params?.taxYear ?? 'all'];
  return useQuery<DocumentDto[]>({
    queryKey: key,
    queryFn: async () => {
      const { data } = await apiClient.get<DocumentDto[]>(`/documents?${sp.toString()}`);
      return data;
    }
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, label, notes }: { id: number; label?: string; notes?: string }) => {
      const { data } = await apiClient.put<DocumentDto>(`/documents/${id}`, { label, notes });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
    }
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/documents/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
    }
  });
}

export function buildDocumentDownloadUrl(id: number): string {
  return `/api/documents/${id}/download`;
}

export interface ReingestResult {
  shareholderId?: number | null;
  taxYear?: number;
  extracted?: any[];
  createdIds?: number[];
  rentalStatements?: number[];
  documentId: number;
}

export async function reingestDocument(params: {
  documentId: number;
  domain: 'personal-income' | 'property' | 'company';
  autoCreate?: boolean;
  shareholderId?: number | null;
  taxYear?: number | null;
}): Promise<ReingestResult> {
  const sp = new URLSearchParams();
  sp.set('domain', params.domain);
  sp.set('documentId', String(params.documentId));
  if (typeof params.autoCreate === 'boolean') sp.set('autoCreate', String(params.autoCreate));
  if (params.shareholderId) sp.set('shareholderId', String(params.shareholderId));
  if (params.taxYear) sp.set('taxYear', String(params.taxYear));
  const { data } = await apiClient.post<ReingestResult>(`/ai/reingest?${sp.toString()}`);
  return data;
}
