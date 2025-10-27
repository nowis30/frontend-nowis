import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';

import ProfileProjectionCard from '../ProfileProjectionCard';

const { mockUseProfileDashboard } = vi.hoisted(() => ({
  mockUseProfileDashboard: vi.fn()
}));

vi.mock('../../api/profileDashboard', () => ({
  useProfileDashboard: mockUseProfileDashboard
}));

vi.mock('recharts', () => {
  const ContainerStub = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const NullComponent = () => null;
  const ChartStub = () => <div />;

  return {
    ResponsiveContainer: ContainerStub,
    AreaChart: ChartStub,
    Area: NullComponent,
    CartesianGrid: NullComponent,
    XAxis: NullComponent,
    YAxis: NullComponent,
    Tooltip: NullComponent
  };
});

function renderComponent() {
  const theme = createTheme();
  return render(
    <ThemeProvider theme={theme}>
      <ProfileProjectionCard />
    </ThemeProvider>
  );
}

describe('ProfileProjectionCard', () => {
  beforeEach(() => {
    mockUseProfileDashboard.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('affiche un message d\'alerte quand la projection échoue', () => {
    mockUseProfileDashboard.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true
    });

    renderComponent();

    expect(
      screen.getByText('Impossible de récupérer la projection pour le moment.')
    ).toBeInTheDocument();
  });

  it('affiche un état vide quand aucune donnée de projection n\'est disponible', () => {
    mockUseProfileDashboard.mockReturnValue({
      data: {
        generatedAt: '2025-04-01T00:00:00Z',
        projection: {
          timeline: [],
          assumptions: {
            baselineNetWorth: 0,
            averageMonthlyChange: 0,
            averageMonthlyGrowthRate: 0,
            monthlyExpenses: 0
          },
          notes: []
        }
      },
      isLoading: false,
      isError: false
    });

    renderComponent();

    expect(
      screen.getByText('Aucune projection n’a encore été calculée.')
    ).toBeInTheDocument();
  });

  it('affiche la projection et les hypothèses clés quand elles sont disponibles', () => {
    mockUseProfileDashboard.mockReturnValue({
      data: {
        generatedAt: '2025-04-01T00:00:00Z',
        projection: {
          timeline: [
            { month: '2025-04', projectedNetWorth: 1_000_000, projectedChange: 25_000 },
            { month: '2025-05', projectedNetWorth: 1_025_000, projectedChange: 25_000 }
          ],
          assumptions: {
            baselineNetWorth: 1_000_000,
            averageMonthlyChange: 25_000,
            averageMonthlyGrowthRate: 0.025,
            monthlyExpenses: 18_500
          },
          notes: ['Projection basée sur le gel successoral en cours.']
        }
      },
      isLoading: false,
      isError: false
    });

    renderComponent();

    expect(screen.getByText('Projection patrimoniale (12 mois)')).toBeInTheDocument();
    expect(
      screen.getByText((content) =>
        content.includes('Généré le') && content.includes('avec les hypothèses ci-dessous.')
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Valeur nette actuelle:/)).toBeInTheDocument();
    expect(screen.getByText(/Variation mensuelle moyenne:/)).toBeInTheDocument();
    expect(screen.getByText(/Dépenses mensuelles:/)).toBeInTheDocument();
    expect(screen.getByText('Points à surveiller')).toBeInTheDocument();
    expect(screen.getByText('Projection basée sur le gel successoral en cours.')).toBeInTheDocument();
  });
});
