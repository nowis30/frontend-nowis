import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography
} from '@mui/material';

import { useAuthStore } from '../store/authStore';

import { apiClient } from '../api/client';
import { useSummary } from '../api/summary';
import { downloadBlob } from '../utils/download';

function DashboardScreen() {
  const { data, isLoading } = useSummary();
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const navigate = useNavigate();
  const setToken = useAuthStore((state) => state.setToken);

  const chartData = useMemo(
    () =>
      data?.properties.map((property) => ({
        name: property.propertyName,
        Revenus: property.grossIncome,
        Dépenses: property.operatingExpenses,
        Cashflow: property.netCashflow
      })) ?? [],
    [data]
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!data) {
    return (
      <Typography variant="body1" sx={{ mt: 4 }}>
        Aucun indicateur disponible pour le moment.
      </Typography>
    );
  }

  const formatter = new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD'
  });

  const latestStatement = data.corporate.latestStatement;
  const latestResolution = data.corporate.latestResolution;

  const primaryMetrics = [
    {
      label: 'Revenus',
      value: formatter.format(data.totals.grossIncome),
      helper: 'Total des loyers et revenus récurrents'
    },
    {
      label: 'Dépenses',
      value: formatter.format(data.totals.operatingExpenses),
      helper: "Charges d'exploitation"
    },
    {
      label: 'Cashflow net',
      value: formatter.format(data.totals.netCashflow),
      helper: 'Après service de la dette'
    }
  ];

  const portfolioChips = [
    {
      label: 'Capital remboursé',
      value: formatter.format(data.totals.principalPortion)
    },
    {
      label: 'Intérêts payés',
      value: formatter.format(data.totals.interestPortion)
    },
    {
      label: 'CCA',
      value: formatter.format(data.totals.cca)
    },
    {
      label: 'Équité',
      value: formatter.format(data.totals.equity)
    }
  ];

  const corporateHighlights = [
    {
      label: 'Sociétés actives',
      value: data.corporate.companiesCount.toString(),
      helper: 'Dossiers corporatifs suivis'
    },
    {
      label: "Transactions d'actions",
      value: data.corporate.shareTransactionsCount.toString(),
      helper: `Valeur ${formatter.format(data.corporate.shareTransactionsValue)}`
    },
    {
      label: 'Bénéfice net consolidé',
      value: formatter.format(data.corporate.totalNetIncome),
      helper: 'Somme des états financiers'
    }
  ];

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      const response = await apiClient.get('/summary/export/csv', { responseType: 'blob' });
      const date = new Date().toISOString().split('T')[0];
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, `bilan-nowis-${date}.csv`);
    } catch (error) {
      console.error('Erreur export CSV', error);
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      setExportingPdf(true);
      const response = await apiClient.get('/summary/export/pdf', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const date = new Date().toISOString().split('T')[0];
      downloadBlob(blob, `bilan-nowis-${date}.pdf`);
    } catch (error) {
      console.error('Erreur export PDF', error);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 4,
          background: 'linear-gradient(135deg, #1e88e5 0%, #1565c0 60%, #0d47a1 100%)',
          color: 'common.white'
        }}
      >
        <Stack spacing={4}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ md: 'center' }}>
            <Stack spacing={0.5}>
              <Typography variant="h4">Tableau de bord consolidé</Typography>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                Vue d’ensemble de vos actifs, de la trésorerie et des suivis corporatifs.
              </Typography>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Button variant="contained" color="secondary" onClick={() => navigate('/advisors')}>
                Conseillers IA
              </Button>
              <Button variant="outlined" color="inherit" onClick={handleExportCsv} disabled={exportingCsv || exportingPdf}>
                {exportingCsv ? 'Export…' : 'Exporter CSV'}
              </Button>
              <Button variant="outlined" color="inherit" onClick={handleExportPdf} disabled={exportingCsv || exportingPdf}>
                {exportingPdf ? 'Export…' : 'Exporter PDF'}
              </Button>
              <Button
                variant="text"
                color="inherit"
                onClick={() => {
                  setToken(null);
                  navigate('/login');
                }}
              >
                Se déconnecter
              </Button>
            </Stack>
          </Stack>

          <Grid container spacing={3}>
            {primaryMetrics.map((metric) => (
              <Grid item xs={12} md={4} key={metric.label}>
                <Stack spacing={0.5}>
                  <Typography variant="overline" sx={{ opacity: 0.75 }}>
                    {metric.label}
                  </Typography>
                  <Typography variant="h4">{metric.value}</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.85 }}>
                    {metric.helper}
                  </Typography>
                </Stack>
              </Grid>
            ))}
          </Grid>

          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
            {portfolioChips.map((chip) => (
              <Chip
                key={chip.label}
                variant="outlined"
                color="default"
                sx={{ borderColor: 'rgba(255,255,255,0.35)', color: 'common.white' }}
                label={`${chip.label}: ${chip.value}`}
              />
            ))}
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">Performance par immeuble</Typography>
            <Typography variant="body2" color="text.secondary">
              Revenus, dépenses et cashflow net pour chaque immeuble géré.
            </Typography>
            <Box sx={{ flexGrow: 1 }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" hide={chartData.length > 6} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Revenus" fill="#1e88e5" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Dépenses" fill="#fb8c00" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Cashflow" fill="#43a047" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">Indicateurs corporatifs</Typography>
            <Divider />
            <Stack spacing={2}>
              {corporateHighlights.map((item) => (
                <Box key={item.label}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {item.label}
                  </Typography>
                  <Typography variant="h6">{item.value}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.helper}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="h6">Dernier état financier</Typography>
            <Divider />
            {latestStatement ? (
              <Stack spacing={1.5}>
                <Typography variant="subtitle1">{latestStatement.companyName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {new Date(latestStatement.periodEnd).toLocaleDateString('fr-CA')} · {latestStatement.statementType}
                </Typography>
                <Typography variant="body1">
                  Bénéfice net {formatter.format(latestStatement.netIncome)}
                </Typography>
                <Typography variant="body1">
                  Capitaux propres {formatter.format(latestStatement.totalEquity)}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    navigate(
                      `/companies?companyId=${latestStatement.companyId}&statementId=${latestStatement.id}`
                    )
                  }
                >
                  Ouvrir dans Companies
                </Button>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Aucun état financier enregistré.
              </Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="h6">Dernière résolution</Typography>
            <Divider />
            {latestResolution ? (
              <Stack spacing={1.5}>
                <Typography variant="subtitle1">{latestResolution.companyName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {new Date(latestResolution.resolutionDate).toLocaleDateString('fr-CA')} · {latestResolution.type}
                </Typography>
                <Typography variant="body1">{latestResolution.title}</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    navigate(
                      `/companies?companyId=${latestResolution.companyId}&resolutionId=${latestResolution.id}`
                    )
                  }
                >
                  Ouvrir dans Companies
                </Button>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Aucune résolution en dossier.
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
}

export default DashboardScreen;
