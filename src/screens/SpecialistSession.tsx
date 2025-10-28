import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import dayjs from 'dayjs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import {
  AdvisorConvoPayload,
  AdvisorConvoSnapshot,
  
  AdvisorInterviewerId,
  AdvisorConversationDetail,
  fetchAdvisorConversationDetail,
  listAdvisorConversations,
  postAdvisorConversation,
  updateAdvisorConversationStatus
} from '../api/advisors';
import type {
  PersonalIncomeCategory,
  PersonalIncomeDto,
  PersonalIncomeShareholderDto
} from '../api/personalIncome';

type PropertyDto = {
  id: number;
  name: string;
  address?: string | null;
  acquisitionDate?: string | null;
  currentValue?: number | null;
  purchasePrice?: number | null;
  notes?: string | null;
};

type MessageEntry = { id: string; role: 'user' | 'assistant'; content: string };

function useProperties() {
  return useQuery<PropertyDto[]>({
    queryKey: ['properties'],
    queryFn: async () => (await apiClient.get<PropertyDto[]>('/properties')).data
  });
}

const expertLabels: Record<AdvisorInterviewerId, string> = {
  fiscaliste: 'Fiscaliste',
  comptable: 'Comptable',
  planificateur: 'Planificateur financier',
  avocat: 'Avocat corporatif'
};

const PERSONAL_INCOME_CATEGORY_SET = new Set<PersonalIncomeCategory>([
  'EMPLOYMENT',
  'PENSION',
  'OAS',
  'CPP_QPP',
  'RRIF_RRSP',
  'BUSINESS',
  'ELIGIBLE_DIVIDEND',
  'NON_ELIGIBLE_DIVIDEND',
  'CAPITAL_GAIN',
  'OTHER'
]);

function normalizePersonalIncomeCategory(raw: string): PersonalIncomeCategory {
  const upper = raw.trim().toUpperCase() as PersonalIncomeCategory;
  return PERSONAL_INCOME_CATEGORY_SET.has(upper) ? upper : 'OTHER';
}

export default function SpecialistSession() {
  const queryClient = useQueryClient();
  const { data: initialProperties } = useProperties();
  const [expert, setExpert] = useState<AdvisorInterviewerId>('fiscaliste');
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [shareholders, setShareholders] = useState<PersonalIncomeShareholderDto[]>([]);
  const [personalIncomes, setPersonalIncomes] = useState<PersonalIncomeDto[]>([]);
  const [propertiesMap, setPropertiesMap] = useState<Map<string, PropertyDto>>(new Map());
  const [historyActionPending, setHistoryActionPending] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const conversationsQuery = useQuery({
    queryKey: ['advisor-conversations'],
    queryFn: listAdvisorConversations,
    staleTime: 30_000
  });

  const conversationDetailQuery = useQuery({
    queryKey: ['advisor-conversation-detail', selectedConversationId],
    queryFn: () => fetchAdvisorConversationDetail(selectedConversationId as number),
    enabled: selectedConversationId !== null,
    staleTime: 15_000
  });

  const conversations = conversationsQuery.data ?? [];
  const selectedConversationDetail = (conversationDetailQuery.data ?? null) as
    | AdvisorConversationDetail
    | null;
  const selectedConversationSummary = conversations.find((item) => item.id === selectedConversationId) ?? null;

  useEffect(() => {
    if (initialProperties) {
      const map = new Map<string, PropertyDto>();
      initialProperties.forEach((p) => map.set(p.name.trim().toLowerCase(), p));
      setPropertiesMap(map);
    }
  }, [initialProperties]);

  useEffect(() => {
    let cancelled = false;

    async function loadPersonalData() {
      try {
        const { data: fetchedShareholders } = await apiClient.get<PersonalIncomeShareholderDto[]>(
          '/personal-incomes/shareholders'
        );
        if (cancelled) {
          return;
        }

        setShareholders(fetchedShareholders);

        const currentYear = dayjs().year();
        const yearsToFetch = [currentYear, currentYear - 1];
        const incomeMap = new Map<number, PersonalIncomeDto>();

        for (const shareholder of fetchedShareholders) {
          for (const year of yearsToFetch) {
            const params = new URLSearchParams({
              shareholderId: String(shareholder.id),
              taxYear: String(year)
            });
            const { data } = await apiClient.get<PersonalIncomeDto[]>(
              `/personal-incomes?${params.toString()}`
            );
            if (cancelled) {
              return;
            }
            data.forEach((income) => {
              incomeMap.set(income.id, income);
            });
          }
        }

        setPersonalIncomes(Array.from(incomeMap.values()));
      } catch (error) {
        console.warn('Impossible de charger les revenus personnels initiaux', error);
      }
    }

    loadPersonalData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  useEffect(() => {
    if (conversationId && conversationId !== selectedConversationId) {
      setSelectedConversationId(conversationId);
    }
  }, [conversationId, selectedConversationId]);

  const snapshot: AdvisorConvoSnapshot = useMemo(() => {
    return {
      properties: Array.from(propertiesMap.values()).map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address ?? null,
        acquisitionDate: p.acquisitionDate ?? null,
        currentValue: p.currentValue ?? null,
        purchasePrice: p.purchasePrice ?? null,
        notes: p.notes ?? null
      })),
      personalIncomes: personalIncomes.map((income) => ({
        id: income.id,
        shareholderName: income.shareholder?.displayName ?? null,
        taxYear: income.taxYear,
        category: income.category,
        label: income.label,
        amount: income.amount
      }))
    };
  }, [propertiesMap, personalIncomes]);

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setCompleted(false);
    setInput('');
    setError(null);
    setSelectedConversationId(null);
    setHistoryActionPending(false);
  };

  const restoreConversationMessages = (detail: AdvisorConversationDetail) => {
    const restored = detail.steps
      .filter((step) => Boolean(step.message))
      .map<MessageEntry>((step) => ({
        id: `history-${detail.id}-${step.id}`,
        role: step.role,
        content: step.message
      }));
    setMessages(restored);
  };

  const resumeConversation = (detail: AdvisorConversationDetail) => {
    restoreConversationMessages(detail);
    setConversationId(detail.id);
    setCompleted(false);
    setError(null);
    setSelectedConversationId(detail.id);
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  const send = async () => {
    const text = input.trim();
    if (!text || pending || completed) return;
    setError(null);
    setPending(true);
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: text }]);
    setInput('');
    try {
      const basePayload: AdvisorConvoPayload = {
        expertId: expert,
        message: text,
        snapshot
      };
      const convoResponse = await postAdvisorConversation(
        conversationId ? { ...basePayload, conversationId } : basePayload
      );
      setConversationId(convoResponse.conversationId ?? null);
      // show assistant message
      if (convoResponse.message) {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', content: convoResponse.message }
        ]);
      }
      // apply updates
      for (const u of convoResponse.updates) {
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
        if (u.op === 'addPersonalIncome') {
          // Resolve shareholder by name if provided, fallback to first available
          const sh = (u.match.shareholderName
            ? shareholders.find(
                (s) => s.displayName.trim().toLowerCase() === u.match.shareholderName!.trim().toLowerCase()
              )
            : shareholders[0]) as PersonalIncomeShareholderDto | undefined;
          if (!sh) continue;
          const payload = {
            shareholderId: sh.id,
            taxYear: u.set.taxYear,
            category: normalizePersonalIncomeCategory(u.set.category),
            label: u.set.label,
            source: u.set.source ?? undefined,
            slipType: u.set.slipType ?? undefined,
            amount: u.set.amount
          } as const;
          try {
            const created = (await apiClient.post<PersonalIncomeDto>('/personal-incomes', payload)).data;
            setPersonalIncomes((prev) => [...prev, created]);
            await queryClient.invalidateQueries({ queryKey: ['personal-incomes'] });
            await queryClient.invalidateQueries({ queryKey: ['personal-income-summary'] });
            await queryClient.invalidateQueries({ queryKey: ['summary'] });
          } catch {
            // Non bloquant: on ignore si la création échoue
          }
        }
      }

      if (convoResponse.completed) {
        setCompleted(true);
      }
      const targetConversationId = convoResponse.conversationId ?? conversationId ?? null;
      await queryClient.invalidateQueries({ queryKey: ['advisor-conversations'] });
      if (targetConversationId) {
        await queryClient.invalidateQueries({
          queryKey: ['advisor-conversation-detail', targetConversationId]
        });
      }
    } catch {
      setError("Impossible de poursuivre la session. Réessaie.");
    } finally {
      setPending(false);
    }
  };

  const handleRefreshHistory = async () => {
    await queryClient.invalidateQueries({ queryKey: ['advisor-conversations'] });
    if (selectedConversationId) {
      await queryClient.invalidateQueries({
        queryKey: ['advisor-conversation-detail', selectedConversationId]
      });
    }
  };

  const handleResumeFromHistory = async () => {
    if (!selectedConversationSummary) {
      return;
    }
    setHistoryActionPending(true);
    try {
      if (selectedConversationSummary.status === 'completed') {
        await updateAdvisorConversationStatus(selectedConversationSummary.id, 'active');
      }
      await queryClient.invalidateQueries({ queryKey: ['advisor-conversations'] });
      const detail = await queryClient.fetchQuery({
        queryKey: ['advisor-conversation-detail', selectedConversationSummary.id],
        queryFn: () => fetchAdvisorConversationDetail(selectedConversationSummary.id)
      });
      resumeConversation(detail);
    } catch (err) {
      console.error('Failed to resume conversation', err);
      setError("Impossible de reprendre cette conversation pour le moment.");
    } finally {
      setHistoryActionPending(false);
    }
  };

  const handleArchiveConversation = async () => {
    if (!selectedConversationSummary) {
      return;
    }
    setHistoryActionPending(true);
    try {
      await updateAdvisorConversationStatus(selectedConversationSummary.id, 'completed');
      await queryClient.invalidateQueries({ queryKey: ['advisor-conversations'] });
      await queryClient.invalidateQueries({
        queryKey: ['advisor-conversation-detail', selectedConversationSummary.id]
      });
      if (selectedConversationSummary.id === conversationId) {
        setCompleted(true);
      }
    } catch (err) {
      console.error('Failed to archive conversation', err);
      setError("Impossible d'archiver la conversation.");
    } finally {
      setHistoryActionPending(false);
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
          onChange={(e) => setExpert(e.target.value as AdvisorInterviewerId)}
          disabled={messages.length > 0}
          helperText="Sélectionnez avant de commencer la conversation"
          sx={{ width: 280 }}
        >
          {(['fiscaliste', 'comptable', 'planificateur', 'avocat'] as AdvisorInterviewerId[]).map((k) => (
            <MenuItem key={k} value={k}>
              {expertLabels[k]}
            </MenuItem>
          ))}
        </TextField>
        <Chip label="Modèle: gpt-5-mini" color="secondary" variant="outlined" />
        {completed && <Chip label="Session terminée" color="success" />}
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="stretch">
        <Stack spacing={2} flex={1}>
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

        <Paper
          variant="outlined"
          sx={{
            width: { xs: '100%', lg: 340 },
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            maxHeight: 540
          }}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Conversations</Typography>
              <Button size="small" onClick={handleRefreshHistory} disabled={conversationsQuery.isFetching}>
                Actualiser
              </Button>
            </Stack>
            <Button
              size="small"
              variant="outlined"
              onClick={startNewConversation}
              disabled={pending}
            >
              Nouvelle conversation
            </Button>
          </Stack>

          {conversationsQuery.isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={20} />
            </Box>
          ) : conversations.length ? (
            <List dense sx={{ flexGrow: 1, overflowY: 'auto' }}>
              {conversations.map((item) => (
                <ListItemButton
                  key={item.id}
                  selected={item.id === selectedConversationId}
                  onClick={() => setSelectedConversationId(item.id)}
                  sx={{ borderRadius: 1, mb: 0.5 }}
                >
                  <ListItemText
                    primary={`${expertLabels[item.expertId]} • ${item.status === 'completed' ? 'Archivée' : 'Active'}`}
                    secondary={dayjs(item.updatedAt).format('DD MMM YYYY HH:mm')}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItemButton>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Aucune conversation sauvegardée pour le moment.
            </Typography>
          )}

          {selectedConversationId && (
            <>
              <Divider />
              {conversationDetailQuery.isFetching ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={18} />
                </Box>
              ) : selectedConversationDetail ? (
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle2">
                      {expertLabels[selectedConversationDetail.expertId] ?? selectedConversationDetail.expertId}
                    </Typography>
                    <Chip
                      size="small"
                      label={selectedConversationSummary?.status === 'completed' ? 'Archivée' : 'Active'}
                      color={selectedConversationSummary?.status === 'completed' ? 'default' : 'success'}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Dernière mise à jour {dayjs(selectedConversationDetail.updatedAt).format('DD MMM YYYY HH:mm')}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleResumeFromHistory}
                      disabled={historyActionPending || pending}
                    >
                      Reprendre
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleArchiveConversation}
                      disabled={historyActionPending || selectedConversationSummary?.status === 'completed'}
                    >
                      Archiver
                    </Button>
                  </Stack>
                  <Paper variant="outlined" sx={{ maxHeight: 220, overflowY: 'auto', p: 1.5 }}>
                    <Stack spacing={1}>
                      {selectedConversationDetail.steps.map((step) => (
                        <Box
                          key={step.id}
                          sx={{
                            alignSelf: step.role === 'user' ? 'flex-end' : 'flex-start',
                            backgroundColor: step.role === 'user' ? 'primary.light' : 'grey.100',
                            color: step.role === 'user' ? 'primary.contrastText' : 'text.primary',
                            px: 1.5,
                            py: 0.75,
                            borderRadius: 1.5,
                            maxWidth: '90%'
                          }}
                        >
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {step.message}
                          </Typography>
                        </Box>
                      ))}
                      {!selectedConversationDetail.steps.length && (
                        <Typography variant="body2" color="text.secondary">
                          Aucun échange enregistré.
                        </Typography>
                      )}
                    </Stack>
                  </Paper>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Sélectionnez une conversation pour afficher les détails.
                </Typography>
              )}
            </>
          )}
        </Paper>
      </Stack>
    </Stack>
  );
}
