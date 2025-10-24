import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './client';

export interface CompanyCountsDto {
  properties: number;
  shareholders: number;
  shareClasses: number;
  shareTransactions: number;
  statements: number;
  resolutions: number;
}

export interface CompanySummaryDto {
  id: number;
  name: string;
  province: string | null;
  fiscalYearEnd: string | null;
  neq: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  counts: CompanyCountsDto;
}

export interface CompanyPropertyDto {
  id: number;
  name: string;
  address: string | null;
  acquisitionDate: string | null;
  purchasePrice: number | null;
  currentValue: number | null;
  notes: string | null;
}

export interface ShareholderDto {
  id: number;
  type: string;
  displayName: string;
  contactEmail: string | null;
  contactPhone: string | null;
}

export interface ShareholderLinkDto {
  id: number;
  role: string | null;
  votingPercent: number | null;
  shareholder: ShareholderDto;
}

export interface ShareClassDto {
  id: number;
  code: string;
  description: string | null;
  hasVotingRights: boolean;
  participatesInGrowth: boolean;
  dividendPolicy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShareTransactionDto {
  id: number;
  type: string;
  transactionDate: string;
  quantity: number | null;
  pricePerShare: number | null;
  considerationPaid: number | null;
  fairMarketValue: number | null;
  notes: string | null;
  shareholder: ShareholderDto | null;
  shareClass: Pick<ShareClassDto, 'id' | 'code' | 'description'> | null;
}

export interface CorporateStatementLineDto {
  id: number;
  category: string;
  label: string;
  amount: number | null;
  orderIndex: number;
  metadata: string | null;
}

export interface CorporateStatementDto {
  id: number;
  statementType: string;
  periodStart: string;
  periodEnd: string;
  isAudited: boolean;
  totals: {
    assets: number | null;
    liabilities: number | null;
    equity: number | null;
    revenue: number | null;
    expenses: number | null;
    netIncome: number | null;
  };
  metadata: string | null;
  lines: CorporateStatementLineDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CorporateResolutionDto {
  id: number;
  type: string;
  title: string;
  resolutionDate: string;
  body: string | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CorporateStatementLinePayload {
  category: string;
  label: string;
  amount: number;
  orderIndex?: number | null;
  metadata?: string | null;
}

export interface CorporateStatementPayload {
  statementType: string;
  periodStart: string;
  periodEnd: string;
  isAudited?: boolean;
  totalAssets?: number | null;
  totalLiabilities?: number | null;
  totalEquity?: number | null;
  totalRevenue?: number | null;
  totalExpenses?: number | null;
  netIncome?: number | null;
  metadata?: string | null;
  lines?: CorporateStatementLinePayload[];
}

export type CorporateStatementUpdatePayload = Partial<CorporateStatementPayload> & {
  lines?: CorporateStatementLinePayload[];
};

export interface CorporateResolutionPayload {
  type: string;
  title: string;
  resolutionDate: string;
  body?: string | null;
  metadata?: string | null;
}

export type CorporateResolutionUpdatePayload = Partial<CorporateResolutionPayload>;

export interface CompanyDetailDto extends CompanySummaryDto {
  properties: CompanyPropertyDto[];
  shareholders: ShareholderLinkDto[];
  shareClasses: ShareClassDto[];
  shareTransactions: ShareTransactionDto[];
  statements: CorporateStatementDto[];
  resolutions: CorporateResolutionDto[];
}

export interface CompanyPayload {
  name: string;
  province?: string | null;
  fiscalYearEnd?: string | null;
  neq?: string | null;
  notes?: string | null;
}

export interface ShareholderLinkPayload {
  shareholderId?: number;
  shareholder?: {
    displayName: string;
    type?: string;
    contactEmail?: string | null;
    contactPhone?: string | null;
    notes?: string | null;
  };
  role?: string | null;
  votingPercent?: number | null;
}

export interface ShareholderUpdatePayload {
  displayName?: string | null;
  type?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
}

export interface ShareholderLinkUpdatePayload {
  role?: string | null;
  votingPercent?: number | null;
  shareholder?: ShareholderUpdatePayload;
}

export interface ShareClassPayload {
  code: string;
  description?: string | null;
  hasVotingRights?: boolean;
  participatesInGrowth?: boolean;
  dividendPolicy?: string | null;
}

export interface ShareTransactionPayload {
  shareholderId: number;
  shareClassId: number;
  type: string;
  transactionDate: string;
  quantity: number;
  pricePerShare?: number | null;
  considerationPaid?: number | null;
  fairMarketValue?: number | null;
  notes?: string | null;
}

export function useCompanies() {
  return useQuery<CompanySummaryDto[]>({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data } = await apiClient.get<CompanySummaryDto[]>('/companies');
      return data;
    }
  });
}

export function useCompanyDetail(companyId?: number) {
  return useQuery<CompanyDetailDto>({
    queryKey: ['company', companyId],
    queryFn: async () => {
      const { data } = await apiClient.get<CompanyDetailDto>(`/companies/${companyId}`);
      return data;
    },
    enabled: typeof companyId === 'number'
  });
}

export function useCreateCompany(onSuccess?: (company: CompanyDetailDto) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CompanyPayload) => apiClient.post<CompanyDetailDto>('/companies', payload),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      const company = response.data;
      if (company?.id) {
        queryClient.invalidateQueries({ queryKey: ['company', company.id] });
      }
      onSuccess?.(company);
    }
  });
}

export function useUpdateCompany(companyId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CompanyPayload) =>
      apiClient.put<CompanyDetailDto>(`/companies/${companyId}`, payload),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
      return response.data;
    }
  });
}

export function useDeleteCompany(companyId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete(`/companies/${companyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.removeQueries({ queryKey: ['company', companyId] });
    }
  });
}

export async function createShareholderLink(
  companyId: number,
  payload: ShareholderLinkPayload
): Promise<ShareholderLinkDto> {
  const { data } = await apiClient.post<ShareholderLinkDto>(
    `/companies/${companyId}/shareholders`,
    payload
  );
  return data;
}

export async function updateShareholderLink(
  companyId: number,
  linkId: number,
  payload: ShareholderLinkUpdatePayload
): Promise<ShareholderLinkDto> {
  const { data } = await apiClient.put<ShareholderLinkDto>(
    `/companies/${companyId}/shareholders/${linkId}`,
    payload
  );
  return data;
}

export async function deleteShareholderLink(companyId: number, linkId: number): Promise<void> {
  await apiClient.delete(`/companies/${companyId}/shareholders/${linkId}`);
}

export async function createShareClass(
  companyId: number,
  payload: ShareClassPayload
): Promise<ShareClassDto> {
  const { data } = await apiClient.post<ShareClassDto>(
    `/companies/${companyId}/share-classes`,
    payload
  );
  return data;
}

export async function updateShareClass(
  companyId: number,
  shareClassId: number,
  payload: ShareClassPayload
): Promise<ShareClassDto> {
  const { data } = await apiClient.put<ShareClassDto>(
    `/companies/${companyId}/share-classes/${shareClassId}`,
    payload
  );
  return data;
}

export async function deleteShareClass(companyId: number, shareClassId: number): Promise<void> {
  await apiClient.delete(`/companies/${companyId}/share-classes/${shareClassId}`);
}

export async function createShareTransaction(
  companyId: number,
  payload: ShareTransactionPayload
): Promise<ShareTransactionDto> {
  const { data } = await apiClient.post<ShareTransactionDto>(
    `/companies/${companyId}/share-transactions`,
    payload
  );
  return data;
}

export async function updateShareTransaction(
  companyId: number,
  transactionId: number,
  payload: ShareTransactionPayload
): Promise<ShareTransactionDto> {
  const { data } = await apiClient.put<ShareTransactionDto>(
    `/companies/${companyId}/share-transactions/${transactionId}`,
    payload
  );
  return data;
}

export async function deleteShareTransaction(
  companyId: number,
  transactionId: number
): Promise<void> {
  await apiClient.delete(`/companies/${companyId}/share-transactions/${transactionId}`);
}

export async function createCorporateStatement(
  companyId: number,
  payload: CorporateStatementPayload
): Promise<CorporateStatementDto> {
  const { data } = await apiClient.post<CorporateStatementDto>(
    `/companies/${companyId}/statements`,
    payload
  );
  return data;
}

export async function updateCorporateStatement(
  companyId: number,
  statementId: number,
  payload: CorporateStatementUpdatePayload
): Promise<CorporateStatementDto> {
  const { data } = await apiClient.put<CorporateStatementDto>(
    `/companies/${companyId}/statements/${statementId}`,
    payload
  );
  return data;
}

export async function deleteCorporateStatement(companyId: number, statementId: number): Promise<void> {
  await apiClient.delete(`/companies/${companyId}/statements/${statementId}`);
}

export async function createCorporateResolution(
  companyId: number,
  payload: CorporateResolutionPayload
): Promise<CorporateResolutionDto> {
  const { data } = await apiClient.post<CorporateResolutionDto>(
    `/companies/${companyId}/resolutions`,
    payload
  );
  return data;
}

export async function updateCorporateResolution(
  companyId: number,
  resolutionId: number,
  payload: CorporateResolutionUpdatePayload
): Promise<CorporateResolutionDto> {
  const { data } = await apiClient.put<CorporateResolutionDto>(
    `/companies/${companyId}/resolutions/${resolutionId}`,
    payload
  );
  return data;
}

export async function deleteCorporateResolution(
  companyId: number,
  resolutionId: number
): Promise<void> {
  await apiClient.delete(`/companies/${companyId}/resolutions/${resolutionId}`);
}
