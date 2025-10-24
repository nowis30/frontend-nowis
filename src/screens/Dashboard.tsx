import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Typography
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';

import { apiClient } from '../api/client';
import { MetricCard } from '../components/MetricCard';
import { useSummary } from '../api/summary';
import { downloadBlob } from '../utils/download';

function DashboardScreen() {
  const { data, isLoading } = useSummary();
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const navigate = useNavigate();

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
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Tableau de bord consolidé</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" onClick={handleExportCsv} disabled={exportingCsv || exportingPdf}>
            {exportingCsv ? 'Export...' : 'Exporter CSV'}
          </Button>
          <Button variant="contained" onClick={handleExportPdf} disabled={exportingCsv || exportingPdf}>
            {exportingPdf ? 'Export...' : 'Exporter PDF'}
          </Button>
        </Box>
      </Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <MetricCard
            label="Revenus"
            value={formatter.format(data.totals.grossIncome)}
            helper="Total des loyers et revenus récurrents"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            label="Dépenses"
            value={formatter.format(data.totals.operatingExpenses)}
            helper="Charges d'exploitation"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            label="Cashflow net"
            value={formatter.format(data.totals.netCashflow)}
            helper="Après service de la dette"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            label="Capital remboursé"
            value={formatter.format(data.totals.principalPortion)}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            label="Intérêts payés"
            value={formatter.format(data.totals.interestPortion)}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            label="CCA"
            value={formatter.format(data.totals.cca)}
            helper="Déduction pour amortissement"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            label="Équité"
            value={formatter.format(data.totals.equity)}
            helper="Valeur nette cumulée"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            label="Sociétés actives"
            value={data.corporate.companiesCount.toString()}
            helper="Dossiers corporatifs suivis"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            label="Transactions d'actions"
            value={data.corporate.shareTransactionsCount.toString()}
            helper={`Valeur totale ${formatter.format(data.corporate.shareTransactionsValue)}`}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            label="Bénéfice net consolidé"
            value={formatter.format(data.corporate.totalNetIncome)}
            helper="Somme des états financiers"
          />
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Performance par immeuble
            </Typography>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Revenus" fill="#1976d2" />
                <Bar dataKey="Dépenses" fill="#ef6c00" />
                <Bar dataKey="Cashflow" fill="#2e7d32" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">Dernier état financier</Typography>
            {latestStatement ? (
              <>
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
                  sx={{ alignSelf: 'flex-start' }}
                  onClick={() =>
                    navigate(
                      `/companies?companyId=${latestStatement.companyId}&statementId=${latestStatement.id}`
                    )
                  }
                >
                  Ouvrir dans Companies
                </Button>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Aucun état financier enregistré.
              </Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">Dernière résolution</Typography>
            {latestResolution ? (
              <>
                <Typography variant="subtitle1">{latestResolution.companyName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {new Date(latestResolution.resolutionDate).toLocaleDateString('fr-CA')} · {latestResolution.type}
                </Typography>
                <Typography variant="body1">{latestResolution.title}</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  sx={{ alignSelf: 'flex-start' }}
                  onClick={() =>
                    navigate(
                      `/companies?companyId=${latestResolution.companyId}&resolutionId=${latestResolution.id}`
                    )
                  }
                >
                  Ouvrir dans Companies
                </Button>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Aucune résolution en dossier.
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default DashboardScreen;
