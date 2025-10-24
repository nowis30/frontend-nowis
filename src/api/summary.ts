import { useQuery } from '@tanstack/react-query';

import { apiClient } from './client';

export interface SummaryKpi {
  propertyId: number;
  propertyName: string;
  grossIncome: number;
  operatingExpenses: number;
  debtService: number;
  interestPortion: number;
  principalPortion: number;
  netCashflow: number;
  cca: number;
  equity: number;
  unitsCount: number;
  rentPotentialMonthly: number;
  squareFeetTotal: number;
  mortgageCount: number;
  outstandingDebt: number;
  averageMortgageRate: number | null;
  loanToValue: number | null;
}

export interface SummaryTotals {
  grossIncome: number;
  operatingExpenses: number;
  debtService: number;
  interestPortion: number;
  principalPortion: number;
  netCashflow: number;
  cca: number;
  equity: number;
  unitsCount: number;
  rentPotentialMonthly: number;
  squareFeetTotal: number;
  mortgageCount: number;
  outstandingDebt: number;
  averageMortgageRate: number | null;
  loanToValue: number | null;
}

export interface CorporateSummary {
  companiesCount: number;
  shareholdersCount: number;
  shareClassesCount: number;
  shareTransactionsCount: number;
  shareTransactionsValue: number;
  shareTransactionsConsideration: number;
  statementsCount: number;
  resolutionsCount: number;
  totalAssets: number;
  totalEquity: number;
  totalNetIncome: number;
  latestStatement: {
    id: number;
    companyId: number;
    companyName: string;
    periodEnd: string;
    statementType: string;
    netIncome: number;
    totalEquity: number;
  } | null;
  latestResolution: {
    id: number;
    companyId: number;
    companyName: string;
    resolutionDate: string;
    type: string;
    title: string;
  } | null;
}

export interface SummaryResponse {
  properties: SummaryKpi[];
  totals: SummaryTotals;
  corporate: CorporateSummary;
}

export function useSummary() {
  return useQuery<SummaryResponse>({
    queryKey: ['summary'],
    queryFn: async () => {
      const { data } = await apiClient.get<SummaryResponse>('/summary');
      return data;
    }
  });
}
