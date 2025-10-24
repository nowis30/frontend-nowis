import { PropsWithChildren } from 'react';
import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';
import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/dashboard', label: 'Tableau de bord' },
  { to: '/reports', label: 'Rapports' },
  { to: '/companies', label: 'Entreprises' },
  { to: '/properties', label: 'Immeubles' },
  { to: '/revenues', label: 'Revenus' },
  { to: '/invoices', label: 'Factures' },
  { to: '/expenses', label: 'Dépenses' },
  { to: '/team', label: 'Équipe' }
];

export function AppLayout({ children }: PropsWithChildren) {
  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'grey.100' }}>
      <AppBar position="static" color="primary">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Nowis IA – Gestion immobilière
          </Typography>
          {links.map((link) => (
            <Button
              key={link.to}
              component={NavLink}
              to={link.to}
              sx={{ color: 'white', '&.active': { textDecoration: 'underline' }, ml: 2 }}
            >
              {link.label}
            </Button>
          ))}
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {children ?? <Outlet />}
      </Container>
    </Box>
  );
}
