import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Typography
} from '@mui/material';
import EmojiObjectsOutlinedIcon from '@mui/icons-material/EmojiObjectsOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import TroubleshootOutlinedIcon from '@mui/icons-material/TroubleshootOutlined';

import AdvisorsScreen from './Advisors';
import { getAdvisorPortalKey, setAdvisorPortalKey } from '../utils/advisorPortalKey';

function usePortalKey() {
  const storedKey = useMemo(() => getAdvisorPortalKey(), []);
  const [key, setKey] = useState<string | null>(storedKey);

  const updateKey = useCallback((value: string | null) => {
    setAdvisorPortalKey(value);
    setKey(value);
  }, []);

  return { key, updateKey } as const;
}

export default function AdvisorPortalPage() {
  const { key: portalKey, updateKey } = usePortalKey();
  const [submittedKey, setSubmittedKey] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = submittedKey.trim();
    if (!trimmed) {
      setFormError('Merci d’entrer la clé fournie par votre administrateur.');
      return;
    }
    updateKey(trimmed);
    setSubmittedKey('');
    setFormError(null);
    setAuthError(null);
  };

  const handleUnauthorized = () => {
    setAuthError('La clé fournie est invalide ou expirée. Veuillez en saisir une nouvelle.');
    updateKey(null);
  };

  const hero = (
    <Box
      sx={{
        background: (theme) =>
          `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.main})`,
        color: 'primary.contrastText',
        py: { xs: 6, md: 8 },
        mb: { xs: 4, md: 6 }
      }}
    >
      <Container maxWidth="lg">
        <Stack spacing={2} sx={{ maxWidth: 760 }}>
          <Typography variant="overline" sx={{ letterSpacing: 2, opacity: 0.85 }}>
            Portail Conseillers IA
          </Typography>
          <Typography variant="h3">Un comité d’experts virtuel pour vos clients</Typography>
          <Typography variant="h6" sx={{ opacity: 0.9 }}>
            Guidez vos entrepreneurs à travers les étapes clés de leur plan fiscal, comptable et légal en quelques
            minutes.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
            <Button
              variant="contained"
              color="secondary"
              size="large"
              onClick={() => updateKey(null)}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Changer de clé
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              size="large"
              href="mailto:info@nowis.ca?subject=Support%20Portail%20Conseillers"
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Contacter l’équipe soutien
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );

  const featureCards = (
    <Container maxWidth="lg" sx={{ mb: { xs: 4, md: 6 } }}>
      <Paper elevation={4} sx={{ p: { xs: 3, md: 4 } }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Stack spacing={1.5}>
              <EmojiObjectsOutlinedIcon color="primary" fontSize="large" />
              <Typography variant="h6">Insights instantanés</Typography>
              <Typography color="text.secondary">
                Le coordinateur IA consolide les recommandations du fiscaliste, comptable, planificateur et avocat pour
                une feuille de route claire.
              </Typography>
            </Stack>
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack spacing={1.5}>
              <TroubleshootOutlinedIcon color="primary" fontSize="large" />
              <Typography variant="h6">Questionnaire guidé</Typography>
              <Typography color="text.secondary">
                Posez les bonnes questions à vos clients et clarifiez les enjeux financiers grâce à une séquence de
                questions dynamique.
              </Typography>
            </Stack>
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack spacing={1.5}>
              <ShieldOutlinedIcon color="primary" fontSize="large" />
              <Typography variant="h6">Clé sécurisée</Typography>
              <Typography color="text.secondary">
                Chaque cabinet dispose d’une clé d’accès dédiée. Vous pouvez la régénérer en tout temps via votre
                administrateur.
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );

  if (!portalKey) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: 'grey.100' }}>
        <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            <Typography variant="h6" color="primary">
              Nowis IA – Portail Conseillers
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Accès réservé · Clé requise
            </Typography>
          </Toolbar>
        </AppBar>
        <Box sx={{ display: 'flex', alignItems: 'center', py: { xs: 6, md: 10 } }}>
          <Container maxWidth="sm">
            <Paper elevation={6} sx={{ p: { xs: 4, md: 5 } }}>
              <Stack spacing={3} component="form" onSubmit={handleSubmit}>
                <Typography variant="h4">Déverrouiller le comité d’experts</Typography>
                <Typography variant="body1" color="text.secondary">
                  Entrez la clé fournie par votre administrateur pour accéder au diagnostic IA.
                </Typography>
                {authError && <Alert severity="error">{authError}</Alert>}
                <TextField
                  label="Clé d’accès"
                  value={submittedKey}
                  onChange={(event) => setSubmittedKey(event.target.value)}
                  error={Boolean(formError)}
                  helperText={formError ?? 'La clé distingue les majuscules et minuscules.'}
                  autoFocus
                  fullWidth
                />
                <Button type="submit" variant="contained" size="large">
                  Accéder au portail
                </Button>
                <Divider>
                  <Typography variant="caption" color="text.secondary">
                    Besoin d’une clé ? Contactez votre administrateur.
                  </Typography>
                </Divider>
              </Stack>
            </Paper>
          </Container>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'grey.100' }}>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <Typography variant="h6" color="primary" sx={{ flexGrow: 1 }}>
            Nowis IA – Portail Conseillers
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Clé active : {portalKey}
          </Typography>
        </Toolbar>
      </AppBar>
      {hero}
      {featureCards}
      <Container maxWidth="lg" sx={{ pb: { xs: 6, md: 8 } }}>
        <Paper elevation={3} sx={{ p: { xs: 3, md: 4 }, mb: 3 }}>
          <Stack spacing={1.5}>
            <Typography variant="h5">Diagnostic interactif</Typography>
            <Typography color="text.secondary">
              Répondez en temps réel aux questions du comité. Une fois la simulation complétée, vous obtiendrez une
              synthèse actionnable et des indicateurs clés prêt à être partagés.
            </Typography>
          </Stack>
        </Paper>
        <AdvisorsScreen onUnauthorized={handleUnauthorized} />
      </Container>
    </Box>
  );
}
