import { PropsWithChildren, useMemo, useState, MouseEvent } from 'react';
import {
  AppBar,
  Box,
  Button,
  Container,
  Menu,
  MenuItem,
  Toolbar,
  Typography
} from '@mui/material';
import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/dashboard', label: 'Tableau de bord' },
  { to: '/reports', label: 'Rapports' },
  { to: '/rental-tax', label: 'Fiscalité locative' },
  { to: '/leveraged-buyback', label: 'Simulation levier' },
  { to: '/valuation', label: 'Valeur familiale' },
  { to: '/advisors', label: 'Conseillers IA' },
  { to: '/session', label: 'Session spécialiste' },
  { to: '/mobile-upload', label: 'Envoi mobile' },
  { to: '/companies', label: 'Entreprises' },
  { to: '/properties', label: 'Immeubles' },
  { to: '/revenues', label: 'Revenus' },
  { to: '/invoices', label: 'Factures' },
  { to: '/expenses', label: 'Dépenses' },
  { to: '/team', label: 'Équipe' }
];

export function AppLayout({ children }: PropsWithChildren) {
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);

  const { primaryLinks, secondaryLinks } = useMemo(() => {
    const primary = links.slice(0, 4);
    const secondary = links.slice(4);
    return { primaryLinks: primary, secondaryLinks: secondary };
  }, []);

  const handleMenuOpen = (event: MouseEvent<HTMLButtonElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'grey.100' }}>
      <AppBar position="static" color="primary">
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ gap: 2, justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Nowis IA – Gestion immobilière
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
              {primaryLinks.map((link) => (
                <Button
                  key={link.to}
                  component={NavLink}
                  to={link.to}
                  sx={{
                    color: 'white',
                    '&.active': { textDecoration: 'underline', fontWeight: 600 }
                  }}
                >
                  {link.label}
                </Button>
              ))}
              {secondaryLinks.length > 0 && (
                <>
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={handleMenuOpen}
                    sx={{ borderColor: 'rgba(255, 255, 255, 0.5)' }}
                  >
                    Menu
                  </Button>
                  <Menu
                    anchorEl={menuAnchorEl}
                    open={Boolean(menuAnchorEl)}
                    onClose={handleMenuClose}
                    keepMounted
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  >
                    {secondaryLinks.map((link) => (
                      <MenuItem
                        key={link.to}
                        component={NavLink}
                        to={link.to}
                        onClick={handleMenuClose}
                        sx={{ '&.active': { fontWeight: 600 } }}
                      >
                        {link.label}
                      </MenuItem>
                    ))}
                  </Menu>
                </>
              )}
            </Box>
          </Toolbar>
        </Container>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {children ?? <Outlet />}
      </Container>
    </Box>
  );
}
