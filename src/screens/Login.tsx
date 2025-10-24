import { useState, type FormEvent, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Paper, TextField, Typography, Alert } from '@mui/material';

import { apiClient } from '../api/client';
import { useAuthStore, type AuthState } from '../store/authStore';

function LoginScreen() {
  const navigate = useNavigate();
  const setToken = useAuthStore((state: AuthState) => state.setToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data } = await apiClient.post<{ token: string }>('/auth/login', { email, password });
      setToken(data.token);
      navigate('/dashboard');
    } catch (error) {
      console.error('Login failed', error);
      setError("Échec de l'authentification. Vérifie tes identifiants.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Paper component="form" onSubmit={handleSubmit} sx={{ p: 4, width: 360 }} elevation={3}>
        <Typography variant="h5" component="h1" gutterBottom>
          Connexion Nowis IA
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
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          disabled={loading}
          sx={{ mt: 3 }}
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </Button>
      </Paper>
    </Box>
  );
}

export default LoginScreen;
