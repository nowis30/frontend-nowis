import { useState, type FormEvent, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Box, Button, Paper, TextField, Typography, Alert, Stack } from '@mui/material';

import { apiClient } from '../api/client';
import { useAuthStore, type AuthState } from '../store/authStore';

function LoginScreen() {
  const navigate = useNavigate();
  const setToken = useAuthStore((state: AuthState) => state.setToken);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isRegister = mode === 'register';
  const submitLabel = loading
    ? isRegister
      ? 'Création...'
      : 'Connexion...'
    : isRegister
      ? 'Créer mon compte'
      : 'Se connecter';
  const toggleLabel = isRegister
    ? 'Déjà un compte ? Se connecter'
    : 'Pas encore de compte ? Créer un accès personnel';
  const introMessage = isRegister
    ? 'Crée ton compte personnel pour gérer tes données fiscales et corporatives en toute sécurité.'
    : 'Connecte-toi avec ton courriel professionnel pour retrouver tes dossiers.';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (password !== confirmPassword) {
          setError('Les mots de passe ne correspondent pas.');
          setLoading(false);
          return;
        }

        const { data } = await apiClient.post<{ token: string }>('/auth/register', { email, password });
        setToken(data.token);
        navigate('/dashboard');
      } else {
        const { data } = await apiClient.post<{ token: string }>('/auth/login', { email, password });
        setToken(data.token);
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Login failed', error);
      if (axios.isAxiosError(error)) {
        const serverMessage = (error.response?.data as { error?: string } | undefined)?.error;
        if (serverMessage) {
          setError(serverMessage);
        } else {
          setError(
            isRegister
              ? 'Impossible de créer le compte pour le moment. Réessaie dans quelques instants.'
              : "Échec de l'authentification. Vérifie tes identifiants."
          );
        }
      } else {
        setError(
          isRegister
            ? 'Impossible de créer le compte pour le moment. Réessaie dans quelques instants.'
            : "Échec de l'authentification. Vérifie tes identifiants."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Paper component="form" onSubmit={handleSubmit} sx={{ p: 4, width: 360 }} elevation={3}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1">
            {isRegister ? 'Créer un accès personnel' : 'Connexion Nowis IA'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {introMessage}
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            label="Courriel"
            type="email"
            margin="normal"
            fullWidth
            required
            value={email}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
          />
          <TextField
            label="Mot de passe"
            type="password"
            margin="normal"
            fullWidth
            required
            value={password}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
            helperText={
              isRegister
                ? '12 caractères min., incluant majuscules, minuscules, chiffres et caractère spécial.'
                : undefined
            }
          />
          {isRegister && (
            <TextField
              label="Confirmer le mot de passe"
              type="password"
              margin="normal"
              fullWidth
              required
              value={confirmPassword}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setConfirmPassword(event.target.value)}
            />
          )}
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={loading}
            sx={{ mt: 3 }}
          >
            {submitLabel}
          </Button>
          <Button
            type="button"
            variant="text"
            color="secondary"
            onClick={() => {
              setMode((prev) => (prev === 'login' ? 'register' : 'login'));
              setError(null);
              setConfirmPassword('');
            }}
          >
            {toggleLabel}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

export default LoginScreen;
