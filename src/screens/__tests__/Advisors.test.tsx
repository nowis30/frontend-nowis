import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Advisors from '../Advisors';

const {
  mockUseSuccessionProgress,
  mockFetchAdvisorQuestions,
  mockEvaluateAdvisors,
  mockAskAdvisorQuestion,
  mockPostAdvisorConversation
} = vi.hoisted(() => ({
  mockUseSuccessionProgress: vi.fn(),
  mockFetchAdvisorQuestions: vi.fn(),
  mockEvaluateAdvisors: vi.fn(),
  mockAskAdvisorQuestion: vi.fn(),
  mockPostAdvisorConversation: vi.fn()
}));

vi.mock('../../api/freeze', () => ({
  useSuccessionProgress: mockUseSuccessionProgress
}));

vi.mock('../../api/advisors', () => ({
  fetchAdvisorQuestions: mockFetchAdvisorQuestions,
  evaluateAdvisors: mockEvaluateAdvisors,
  askAdvisorQuestion: mockAskAdvisorQuestion,
  postAdvisorConversation: mockPostAdvisorConversation
}));

const routerFutureConfig = {
  v7_startTransition: true,
  v7_relativeSplatPath: true
} as const;

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 }
    }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={routerFutureConfig}>
        <Advisors />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const baseEvaluation = {
  nextQuestion: null,
  completed: false,
  engine: null,
  uncertainty: [],
  coordinatorSummary: '',
  recommendations: [],
  metrics: [],
  followUps: []
};

const successionSuccessMock = {
  data: {
    completionRatio: 0.5,
    steps: [
      { id: '1', label: 'Préparer les documents', status: 'done', blockers: [] },
      { id: '2', label: 'Signer chez le notaire', status: 'in_progress', blockers: ['Attente de la signature du notaire'] }
    ],
    stats: { shareholders: 1, trusts: 0, assets: 1, scenarios: 1, simulations: 1 },
    nextAction: {
      stepId: '2',
      label: 'Signer chez le notaire',
      suggestion: 'Prendre rendez-vous.'
    },
    latestSimulation: {
      id: 1,
      scenarioId: 1,
      generatedAt: '2025-04-01T00:00:00Z',
      inputs: {
        targetFreezeYear: 2030,
        generations: 1,
        reinvestmentRatePercent: 0,
        marginalTaxRatePercent: 0,
        dividendRetentionPercent: 0
      }
    }
  },
  isLoading: false,
  isError: false
} as const;

describe('Advisors succession panel', () => {
  beforeEach(() => {
    mockUseSuccessionProgress.mockReset();
    mockFetchAdvisorQuestions.mockReset();
    mockEvaluateAdvisors.mockReset();
  mockAskAdvisorQuestion.mockReset();
  mockPostAdvisorConversation.mockReset();
    mockFetchAdvisorQuestions.mockResolvedValue([]);
    mockEvaluateAdvisors.mockResolvedValue(baseEvaluation);
    mockUseSuccessionProgress.mockReturnValue(successionSuccessMock);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("affiche un message d'alerte si la progression échoue", async () => {
    mockUseSuccessionProgress.mockImplementation(() => ({
      data: undefined,
      isLoading: false,
      isError: true
    }));
    renderWithProviders();
    await waitFor(() => {
      expect(
        screen.getByText((content) => content.includes('Impossible de récupérer la progression succession pour le moment.'))
      ).toBeInTheDocument();
    });
  });

  it("affiche la liste des étapes et bloqueurs", async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(mockFetchAdvisorQuestions).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('50 % complété')).toBeInTheDocument();
      expect(screen.getAllByText('Signer chez le notaire')[0]).toBeInTheDocument();
      expect(screen.getByText('Attente de la signature du notaire')).toBeInTheDocument();
    });
  });
});
