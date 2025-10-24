import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import DashboardScreen from '../Dashboard';

const { mockGet, mockDownload } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockDownload: vi.fn()
}));

vi.mock('../../api/client', () => {
  return {
    apiClient: {
      get: mockGet
    }
  };
});

vi.mock('recharts', () => {
  const Stub = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const NullComponent = () => null;
  return {
    ResponsiveContainer: Stub,
    BarChart: Stub,
    Bar: NullComponent,
    XAxis: NullComponent,
    YAxis: NullComponent,
    Tooltip: NullComponent,
    Legend: NullComponent
  };
});

const routerFutureConfig = {
  v7_startTransition: true,
  v7_relativeSplatPath: true
} as const;

const summaryMock = {
  properties: [
    {
      propertyId: 1,
      propertyName: 'Bloc A',
      grossIncome: 12000,
      operatingExpenses: 4000,
      debtService: 3000,
      interestPortion: 1000,
      principalPortion: 2000,
      netCashflow: 5000,
      cca: 800,
      equity: 60000,
      unitsCount: 4,
      rentPotentialMonthly: 4800,
      squareFeetTotal: 2500,
      mortgageCount: 1,
      outstandingDebt: 180000,
      averageMortgageRate: 0.035,
      loanToValue: 0.72
    }
  ],
  totals: {
    grossIncome: 12000,
    operatingExpenses: 4000,
    debtService: 3000,
    interestPortion: 1000,
    principalPortion: 2000,
    netCashflow: 5000,
    cca: 800,
    equity: 60000,
    unitsCount: 4,
    rentPotentialMonthly: 4800,
    squareFeetTotal: 2500,
    mortgageCount: 1,
    outstandingDebt: 180000,
    averageMortgageRate: 0.035,
    loanToValue: 0.72
  },
  corporate: {
    companiesCount: 2,
    shareTransactionsCount: 3,
    shareTransactionsValue: 250000,
    totalNetIncome: 120000,
    latestStatement: {
      id: 11,
      companyId: 5,
      companyName: 'Bloc A Gestion Inc.',
      periodEnd: '2024-12-31',
      statementType: 'Bilan annuel',
      netIncome: 85000,
      totalEquity: 410000
    },
    latestResolution: {
      id: 7,
      companyId: 5,
      companyName: 'Bloc A Gestion Inc.',
      resolutionDate: '2025-03-20',
      type: 'Nomination',
      title: 'Nomination du nouveau directeur général'
    }
  }
};

vi.mock('../../api/summary', () => ({
  useSummary: () => ({
    data: summaryMock,
    isLoading: false
  })
}));

vi.mock('../../utils/download', () => {
  return {
    downloadBlob: mockDownload
  };
});

describe('DashboardScreen exports', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockDownload.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('telecharge le CSV du bilan', async () => {
    const csvBlob = new Blob(['Immeuble,Unités'], { type: 'text/csv' });
    mockGet.mockResolvedValueOnce({ data: csvBlob });

    render(
      <MemoryRouter future={routerFutureConfig}>
        <DashboardScreen />
      </MemoryRouter>
    );

  const [csvButton] = screen.getAllByRole('button', { name: /Exporter CSV/i });
    fireEvent.click(csvButton);

    expect(csvButton).toBeDisabled();
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/summary/export/csv', { responseType: 'blob' })
    );
    await waitFor(() =>
      expect(mockDownload).toHaveBeenCalledWith(
        csvBlob,
        expect.stringMatching(/^bilan-nowis-\d{4}-\d{2}-\d{2}\.csv$/)
      )
    );
    await waitFor(() => expect(csvButton).not.toBeDisabled());
  });

  it('telecharge le PDF du bilan', async () => {
    const pdfBlob = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    mockGet.mockResolvedValueOnce({ data: pdfBlob });

    render(
      <MemoryRouter future={routerFutureConfig}>
        <DashboardScreen />
      </MemoryRouter>
    );

  const [pdfButton] = screen.getAllByRole('button', { name: /Exporter PDF/i });
    fireEvent.click(pdfButton);

    expect(pdfButton).toBeDisabled();
    await waitFor(() =>
      expect(mockGet).toHaveBeenLastCalledWith('/summary/export/pdf', { responseType: 'blob' })
    );
    await waitFor(() =>
      expect(mockDownload).toHaveBeenLastCalledWith(
        pdfBlob,
        expect.stringMatching(/^bilan-nowis-\d{4}-\d{2}-\d{2}\.pdf$/)
      )
    );
    await waitFor(() => expect(pdfButton).not.toBeDisabled());
  });
});
