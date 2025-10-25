import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import dayjs from 'dayjs';
import { apiClient } from '../api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

type AdvisorResponderId = 'fiscaliste' | 'comptable' | 'planificateur' | 'avocat';

type PropertyDto = {
  id: number;
  name: string;
  address?: string | null;
  acquisitionDate?: string | null;
  currentValue?: number | null;
};

type ConvoSnapshot = { properties?: Array<{ id?: number; name: string; address?: string | null; acquisitionDate?: string | null; currentValue?: number | null }>; };

type ConvoUpdate =
  | { op: 'upsertProperty'; match: { name: string }; set: { address?: string; acquisitionDate?: string; currentValue?: number } }
  | { op: 'addRevenue' | 'addExpense'; match: { propertyName: string }; set: { label: string; amount: number; frequency: 'PONCTUEL' | 'HEBDOMADAIRE' | 'MENSUEL' | 'TRIMESTRIEL' | 'ANNUEL'; startDate: string; endDate?: string | null } };

type ConvoStep = {
  completed: boolean;
  message: string;
  nextQuestion: null | { id: string; label: string; type: 'text' | 'number' | 'select'; options?: Array<{ value: string; label: string }>; placeholder?: string };
  updates: ConvoUpdate[];
};

type MessageEntry = { id: string; role: 'user' | 'assistant'; content: string };

function useProperties() {
  return useQuery<PropertyDto[]>({
    queryKey: ['properties'],
    queryFn: async () => (await apiClient.get<PropertyDto[]>('/properties')).data
  });
}

const expertLabels: Record<AdvisorResponderId, string> = {
  fiscaliste: 'Fiscaliste',
  comptable: 'Comptable',
  planificateur: 'Planificateur financier',
  avocat: 'Avocat corporatif'
};

export default function SpecialistSession() {
  const queryClient = useQueryClient();
  const { data: initialProperties } = useProperties();
  const [expert, setExpert] = useState<AdvisorResponderId>('fiscaliste');
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [propertiesMap, setPropertiesMap] = useState<Map<string, PropertyDto>>(new Map());
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialProperties) {
      const map = new Map<string, PropertyDto>();
      initialProperties.forEach((p) => map.set(p.name.trim().toLowerCase(), p));
      setPropertiesMap(map);
    }
  }, [initialProperties]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  const snapshot: ConvoSnapshot = useMemo(() => {
    return { properties: Array.from(propertiesMap.values()).map((p) => ({ id: p.id, name: p.name, address: p.address ?? null, acquisitionDate: p.acquisitionDate ?? null, currentValue: p.currentValue ?? null })) };
  }, [propertiesMap]);

  const send = async () => {
    const text = input.trim();
    if (!text || pending || completed) return;
    setError(null);
    setPending(true);
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: text }]);
    setInput('');
    try {
      const { data } = await apiClient.post<ConvoStep>('/advisors/convo', { expertId: expert, message: text, snapshot });
      // show assistant message
      if (data.message) {
        setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: data.message }]);
      }
      // apply updates
      for (const u of data.updates) {
        // Upsert property by name
        if (u.op === 'upsertProperty') {
          const key = u.match.name.trim().toLowerCase();
          const existing = propertiesMap.get(key);
          if (existing) {
            await apiClient.put(`/properties/${existing.id}`, {
              name: existing.name,
              address: u.set.address ?? existing.address ?? undefined,
              acquisitionDate: u.set.acquisitionDate ?? existing.acquisitionDate ?? undefined,
              currentValue: typeof u.set.currentValue === 'number' ? u.set.currentValue : existing.currentValue ?? undefined
            });
            const updated = (await apiClient.get<PropertyDto>(`/properties/${existing.id}`)).data;
            setPropertiesMap((prev) => new Map(prev.set(key, updated)));
          } else {
            const created = (
              await apiClient.post<PropertyDto>('/properties', {
                name: u.match.name,
                address: u.set.address,
                acquisitionDate: u.set.acquisitionDate,
                currentValue: u.set.currentValue
              })
            ).data;
            setPropertiesMap((prev) => new Map(prev.set(key, created)));
          }
          await queryClient.invalidateQueries({ queryKey: ['properties'] });
          await queryClient.invalidateQueries({ queryKey: ['summary'] });
        }
        if (u.op === 'addRevenue' || u.op === 'addExpense') {
          const pKey = u.match.propertyName.trim().toLowerCase();
          const property = propertiesMap.get(pKey);
          if (!property) continue;
          const payload = {
            propertyId: property.id,
            label: u.set.label,
            amount: u.set.amount,
            frequency: u.set.frequency,
            startDate: u.set.startDate || dayjs().format('YYYY-MM-DD'),
            endDate: u.set.endDate ?? undefined
          };
          if (u.op === 'addRevenue') {
            await apiClient.post('/revenues', payload);
          } else {
            await apiClient.post('/expenses', { ...payload, category: u.set.label });
          }
          await queryClient.invalidateQueries({ queryKey: ['revenues'] });
          await queryClient.invalidateQueries({ queryKey: ['expenses'] });
          await queryClient.invalidateQueries({ queryKey: ['summary'] });
        }
      }

      if (data.completed) {
        setCompleted(true);
      }
    } catch {
      setError("Impossible de poursuivre la session. Réessaie.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Session avec un spécialiste</Typography>
        <Typography variant="body2" color="text.secondary">
          Choisissez le professionnel, échangez en langage naturel et laissez-le remplir vos données au fur et à mesure.
        </Typography>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
        <TextField
          select
          label="Spécialiste"
          size="small"
          value={expert}
          onChange={(e) => setExpert(e.target.value as AdvisorResponderId)}
          disabled={messages.length > 0}
          helperText="Sélectionnez avant de commencer la conversation"
          sx={{ width: 280 }}
        >
          {(['fiscaliste', 'comptable', 'planificateur', 'avocat'] as AdvisorResponderId[]).map((k) => (
            <MenuItem key={k} value={k}>
              {expertLabels[k]}
            </MenuItem>
          ))}
        </TextField>
        <Chip label="Modèle: gpt-5-mini" color="secondary" variant="outlined" />
        {completed && <Chip label="Session terminée" color="success" />}
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, minHeight: 260, maxHeight: 420, overflowY: 'auto' }}>
        <Stack spacing={1.5}>
          {messages.map((m) => (
            <Box
              key={m.id}
              sx={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: m.role === 'user' ? 'primary.main' : 'grey.100',
                color: m.role === 'user' ? 'primary.contrastText' : 'text.primary',
                px: 2,
                py: 1,
                borderRadius: 2,
                maxWidth: '85%'
              }}
            >
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {m.content}
              </Typography>
            </Box>
          ))}
          {pending && (
            <Typography variant="body2" color="text.secondary">
              Le {expertLabels[expert]} réfléchit…
            </Typography>
          )}
          <div ref={bottomRef} />
        </Stack>
      </Paper>

      <Stack direction="row" spacing={1} component="form" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <TextField
          fullWidth
          label={completed ? 'Session terminée' : 'Votre message'}
          placeholder={completed ? undefined : 'Décrivez votre situation, posez une question…'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={pending || completed}
        />
        <Button type="submit" variant="contained" disabled={pending || completed}>
          Envoyer
        </Button>
      </Stack>

      {completed && (
        <Alert severity="success">
          Session terminée. Vos données ont été mises à jour. Consultez le tableau de bord ou les rapports pour voir le portefeuille et le cashflow consolidés.
        </Alert>
      )}
    </Stack>
  );
}
