import { useMutation } from '@tanstack/react-query';

import { apiClient } from './client';

export interface PersonalTaxPayload {
  shareholderId: number;
  taxYear: number;
  employmentIncome?: number;
  businessIncome?: number;
  eligibleDividends?: number;
  nonEligibleDividends?: number;
  capitalGains?: number;
  deductions?: number;
  otherCredits?: number;
  province?: string | null;
}

export interface PersonalTaxComputation {
  shareholderId: number;
  taxYear: number;
  taxableIncome: number;
  netIncome: number;
  federalTax: number;
  provincialTax: number;
  totalCredits: number;
  eligibleDividendGrossUp: number;
  nonEligibleDividendGrossUp: number;
  federalDividendCredits: number;
  provincialDividendCredits: number;
  balanceDue: number;
}

export function useComputePersonalTaxReturn() {
  return useMutation({
    mutationFn: async (payload: PersonalTaxPayload) => {
      const { data } = await apiClient.post<PersonalTaxComputation>('/tax/personal-tax', payload);
      return data;
    }
  });
}
