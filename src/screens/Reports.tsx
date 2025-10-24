import { useMemo } from 'react';
import {
  Box,
  CircularProgress,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';

import { useReportsOverview } from '../api/reports';
import { MetricCard } from '../components/MetricCard';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(value);
}

export default function ReportsScreen() {
  const { data, isLoading } = useReportsOverview();

  const sortedActivity = useMemo(() => data?.recentActivity ?? [], [data]);

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
        Aucun rapport disponible pour le moment.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h4">Rapports et indicateurs avancés</Typography>
        <Typography variant="body2" color="text.secondary">
          Vue consolidée des utilisateurs, rôles et mouvements corporatifs récents.
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Données générées le {new Date(data.generatedAt).toLocaleString('fr-CA')}
        </Typography>
      </Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <MetricCard label="Utilisateurs" value={data.totals.users.toString()} />
        </Grid>
        <Grid item xs={12} md={3}>
          <MetricCard label="Entreprises" value={data.totals.companies.toString()} />
        </Grid>
        <Grid item xs={12} md={3}>
          <MetricCard label="Immeubles" value={data.totals.properties.toString()} />
        </Grid>
        <Grid item xs={12} md={3}>
          <MetricCard label="États financiers" value={data.totals.statements.toString()} />
        </Grid>
        <Grid item xs={12} md={3}>
          <MetricCard label="Résolutions" value={data.totals.resolutions.toString()} />
        </Grid>
        <Grid item xs={12} md={3}>
          <MetricCard label="Revenus cumulés" value={formatCurrency(data.totals.revenue)} />
        </Grid>
        <Grid item xs={12} md={3}>
          <MetricCard label="Dépenses cumulées" value={formatCurrency(data.totals.expenses)} />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Répartition des rôles
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Rôle</TableCell>
                  <TableCell align="right">Assignations</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.roles.map((role) => (
                  <TableRow key={role.roleId}>
                    <TableCell>{role.roleName}</TableCell>
                    <TableCell align="right">{role.assignments}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Sociétés les plus capitalisées
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Société</TableCell>
                  <TableCell>Période</TableCell>
                  <TableCell align="right">Équité</TableCell>
                  <TableCell align="right">Bénéfice net</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.topCompaniesByEquity.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>Aucune donnée disponible.</TableCell>
                  </TableRow>
                ) : (
                  data.topCompaniesByEquity.map((company) => (
                    <TableRow key={`${company.companyId}-${company.periodEnd}`}>
                      <TableCell>{company.companyName}</TableCell>
                      <TableCell>{new Date(company.periodEnd).toLocaleDateString('fr-CA')}</TableCell>
                      <TableCell align="right">{formatCurrency(company.totalEquity)}</TableCell>
                      <TableCell align="right">{formatCurrency(company.netIncome)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Activités récentes
        </Typography>
        {sortedActivity.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Aucun mouvement corporatif récent.
          </Typography>
        ) : (
          <List>
            {sortedActivity.map((item) => (
              <ListItem key={`${item.type}-${item.id}`}> 
                <ListItemText
                  primary={`${item.type === 'STATEMENT' ? 'État' : 'Résolution'} · ${item.companyName}`}
                  secondary={`${new Date(item.date).toLocaleDateString('fr-CA')} · ${item.label}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
}
