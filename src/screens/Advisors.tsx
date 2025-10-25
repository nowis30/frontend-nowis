import axios from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import TaskAltIcon from '@mui/icons-material/TaskAlt';

import {
  AdvisorAnswer,
  AdvisorEngineMode,
  AdvisorMetric,
  AdvisorQuestion,
  AdvisorResult,
  evaluateAdvisors,
  fetchAdvisorQuestions
} from '../api/advisors';

interface ConversationEntry {
  id: string;
  role: 'system' | 'user' | 'summary';
  content: string;
  meta?: { expertId?: string };
}

interface AdvisorsScreenProps {
  onUnauthorized?: () => void;
}

const expertLabels: Record<string, string> = {
  fiscaliste: 'Fiscaliste',
  comptable: 'Comptable',
  planificateur: 'Planificateur financier',
  avocat: 'Avocat corporatif'
};

function isUnauthorizedError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

function generateId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function resolvePreferredEngine(): AdvisorEngineMode | undefined {
  const value = import.meta.env.VITE_ADVISOR_ENGINE as string | undefined;
  if (value === 'gpt' || value === 'heuristic') {
    return value;
  }
  return undefined;
}

const preferredEngine = resolvePreferredEngine();

function evaluateWithPreferredEngine(answers: AdvisorAnswer[]) {
  return evaluateAdvisors(answers, preferredEngine ? { engine: preferredEngine } : undefined);
}

export default function AdvisorsScreen({ onUnauthorized }: AdvisorsScreenProps = {}) {
  const [questions, setQuestions] = useState<AdvisorQuestion[]>([]);
  const [answers, setAnswers] = useState<AdvisorAnswer[]>([]);
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<AdvisorMetric | null>(null);

  const askedQuestionsRef = useRef(new Set<string>());

  const currentQuestion = useMemo(() => result?.nextQuestion ?? null, [result?.nextQuestion]);
  const engineMeta = result?.engine;
  const engineDisplayLabel = engineMeta
    ? engineMeta.mode === 'gpt'
      ? engineMeta.isSimulated
        ? 'Mode GPT (prévisualisation)'
        : 'Mode GPT'
      : 'IA heuristique'
    : null;
  const uncertainty = result?.uncertainty ?? [];

  useEffect(() => {
    async function bootstrap() {
      try {
        setLoading(true);
        setError(null);
  const fetchedQuestions = await fetchAdvisorQuestions();
  setQuestions(fetchedQuestions);
  const initialResult = await evaluateWithPreferredEngine([]);
        setResult(initialResult);
        maybePushQuestion(initialResult.nextQuestion);
      } catch (err) {
        console.error(err);
        if (isUnauthorizedError(err)) {
          onUnauthorized?.();
          setError('Accès non autorisé. Merci de vérifier votre clé d’accès.');
        } else {
          setError("Impossible de charger les conseillers IA pour le moment.");
        }
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setInputValue('');
    setFormError(null);
  }, [currentQuestion?.id]);

  function maybePushQuestion(question: AdvisorQuestion | null) {
    if (question && !askedQuestionsRef.current.has(question.id)) {
      askedQuestionsRef.current.add(question.id);
      setConversation((prev) => [
        ...prev,
        {
          id: generateId('question'),
          role: 'system',
          content: question.label
        }
      ]);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentQuestion || submitting) {
      return;
    }

    const value = inputValue.trim();
    if (!value) {
      setFormError('Merci de fournir une réponse.');
      return;
    }

    const updatedAnswers: AdvisorAnswer[] = [...answers, { questionId: currentQuestion.id, value }];
    setAnswers(updatedAnswers);
    setConversation((prev) => [
      ...prev,
      {
        id: generateId('answer'),
        role: 'user',
        content: value
      }
    ]);

    setSubmitting(true);
    try {
      const priorCompleted = result?.completed ?? false;
  const evaluation = await evaluateWithPreferredEngine(updatedAnswers);
      setResult(evaluation);
      maybePushQuestion(evaluation.nextQuestion);

      if (evaluation.completed && !priorCompleted) {
        setConversation((prev) => [
          ...prev,
          {
            id: generateId('summary'),
            role: 'summary',
            content: evaluation.coordinatorSummary
          }
        ]);
      }
    } catch (err) {
      console.error(err);
      if (isUnauthorizedError(err)) {
        onUnauthorized?.();
        setError('Clé invalide ou expirée. Merci de la saisir à nouveau.');
      } else {
        setError("Impossible de poursuivre la simulation. Réessayez dans quelques instants.");
      }
    } finally {
      setSubmitting(false);
      setInputValue('');
    }
  }

  if (loading) {
    return (
      <Stack spacing={3}>
        <Typography variant="h4">Conseillers IA</Typography>
        <Typography variant="body1">Chargement du comité d’experts…</Typography>
      </Stack>
    );
  }

  const currentQuestionDefinition = currentQuestion
    ? questions.find((question) => question.id === currentQuestion.id) ?? currentQuestion
    : null;

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h4" gutterBottom>
          Comité d’experts IA
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Répondez aux questions du fiscaliste, comptable, planificateur et avocat. Le coordinateur fusionne leurs
          conseils pour un plan d’action clair.
        </Typography>
        {engineDisplayLabel && (
          <Stack spacing={1} sx={{ mt: 2 }}>
            <Chip label={engineDisplayLabel} color="secondary" variant="outlined" />
            {engineMeta?.note && <Alert severity="info">{engineMeta.note}</Alert>}
          </Stack>
        )}
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {uncertainty.length > 0 && (
        <Alert severity="warning" variant="outlined">
          <Stack spacing={1}>
            <Typography variant="body2">
              Certaines réponses sont à confirmer. Vous pourrez préciser ces points plus tard :
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {uncertainty.map((field) => (
                <Chip key={field.questionId} label={field.label} color="warning" variant="outlined" size="small" />
              ))}
            </Stack>
          </Stack>
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="stretch">
        <Paper elevation={3} sx={{ flex: 1, p: 3, maxHeight: 480, overflowY: 'auto' }}>
          <Stack spacing={2}>
            {conversation.map((entry) => (
              <Box
                key={entry.id}
                sx={{
                  alignSelf: entry.role === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: entry.role === 'user' ? 'primary.light' : 'grey.100',
                  color: entry.role === 'user' ? 'primary.contrastText' : 'text.primary',
                  px: 2,
                  py: 1.5,
                  borderRadius: 2,
                  maxWidth: '85%'
                }}
              >
                <Typography variant="body2">{entry.content}</Typography>
              </Box>
            ))}
            {!conversation.length && (
              <Typography color="text.secondary">
                Les experts se préparent à poser leurs questions. Répondez pour recevoir vos premières recommandations.
              </Typography>
            )}
          </Stack>
        </Paper>

        <Paper elevation={3} sx={{ width: { xs: '100%', md: 360 }, p: 3 }}>
          {result?.completed ? (
            <Stack spacing={2}>
              <Typography variant="h6">Diagnostic terminé</Typography>
              <Typography color="text.secondary">
                Vous pouvez réinitialiser pour recommencer avec un autre scénario.
              </Typography>
              <Button
                variant="outlined"
                onClick={async () => {
                  setAnswers([]);
                  setConversation([]);
                  askedQuestionsRef.current.clear();
                  setResult(null);
                  setInputValue('');
                  setError(null);
                  try {
                    const evaluation = await evaluateWithPreferredEngine([]);
                    setResult(evaluation);
                    maybePushQuestion(evaluation.nextQuestion);
                  } catch (err) {
                    console.error(err);
                    setError('Impossible de relancer la simulation.');
                  }
                }}
              >
                Relancer la simulation
              </Button>
            </Stack>
          ) : currentQuestionDefinition ? (
            <Stack component="form" spacing={2} onSubmit={handleSubmit}>
              <Typography variant="h6">Question suivante</Typography>
              <Typography variant="subtitle1">{currentQuestionDefinition.label}</Typography>
              {currentQuestionDefinition.description && (
                <Typography variant="body2" color="text.secondary">
                  {currentQuestionDefinition.description}
                </Typography>
              )}

              {currentQuestionDefinition.type === 'select' ? (
                <TextField
                  select
                  label="Choix"
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  required
                  fullWidth
                  helperText={currentQuestionDefinition.description}
                >
                  {currentQuestionDefinition.options?.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                (() => {
                  const isNumberQuestion = currentQuestionDefinition.type === 'number';
                  const questionUncertainty = uncertainty.find(
                    (field) => field.questionId === currentQuestionDefinition.id
                  );
                  let helperText =
                    formError ??
                    (isNumberQuestion
                      ? "Inscrivez un montant estimé (ex. 250000) ou tapez 'je ne sais pas'."
                      : currentQuestionDefinition.description);
                  if (!formError && questionUncertainty) {
                    helperText = helperText
                      ? `${helperText} | Réponse actuelle à confirmer : vous pourrez préciser ce point plus tard.`
                      : 'Réponse actuelle à confirmer : vous pourrez préciser ce point plus tard.';
                  }
                  return (
                    <TextField
                      label="Votre réponse"
                      placeholder={currentQuestionDefinition.placeholder}
                      type="text"
                      inputProps={
                        isNumberQuestion
                          ? {
                              inputMode: 'decimal',
                              'aria-label': 'Réponse numérique ou texte'
                            }
                          : undefined
                      }
                      value={inputValue}
                      onChange={(event) => setInputValue(event.target.value)}
                      required
                      fullWidth
                      helperText={helperText}
                      error={Boolean(formError)}
                    />
                  );
                })()
              )}

              <Button type="submit" variant="contained" disabled={submitting} startIcon={<QuestionAnswerIcon />}>
                Envoyer
              </Button>
            </Stack>
          ) : (
            <Typography color="text.secondary">En attente des réponses…</Typography>
          )}
        </Paper>
      </Stack>

      {result?.completed && (
        <Stack spacing={4}>
          <Box>
            <Typography variant="h5" gutterBottom>
              Synthèse du coordinateur
            </Typography>
            <Paper elevation={1} sx={{ p: 3 }}>
              <Typography variant="body1">{result.coordinatorSummary}</Typography>
            </Paper>
          </Box>

          <Box>
            <Typography variant="h5" gutterBottom>
              Recommandations par expert
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
              {result.recommendations.map((recommendation) => (
                <Card key={recommendation.expertId} sx={{ flex: 1, minWidth: 220 }}>
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <PsychologyIcon color="primary" />
                        <Typography variant="subtitle2" color="text.secondary">
                          {expertLabels[recommendation.expertId] ?? recommendation.expertId}
                        </Typography>
                      </Stack>
                      <Typography variant="h6">{recommendation.title}</Typography>
                      <Typography variant="body2">{recommendation.summary}</Typography>
                      <Divider />
                      <List dense>
                        {recommendation.rationale.map((item, index) => (
                          <ListItem key={index} disableGutters>
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              <TipsAndUpdatesIcon fontSize="small" color="action" />
                            </ListItemIcon>
                            <ListItemText primary={item} primaryTypographyProps={{ variant: 'body2' }} />
                          </ListItem>
                        ))}
                      </List>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography variant="h5" gutterBottom>
              Indicateurs clés
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
              {result.metrics.map((metric) => (
                <Card
                  key={metric.id}
                  sx={{ flex: '1 1 220px', cursor: 'pointer' }}
                  onClick={() => setSelectedMetric(metric)}
                >
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">
                      {metric.label}
                    </Typography>
                    <Typography variant="h6" sx={{ mt: 1 }}>
                      {metric.value}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                      {metric.expertIds.map((expertId) => (
                        <Chip
                          key={expertId}
                          size="small"
                          label={expertLabels[expertId] ?? expertId}
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
              {!result.metrics.length && (
                <Typography color="text.secondary">Aucun indicateur retenu pour ce scénario.</Typography>
              )}
            </Stack>
          </Box>

          <Box>
            <Typography variant="h5" gutterBottom>
              Pistes de suivi
            </Typography>
            <Paper elevation={1} sx={{ p: 3 }}>
              <List>
                {result.followUps.map((followUp, index) => (
                  <ListItem key={index} disableGutters>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <TaskAltIcon color="success" />
                    </ListItemIcon>
                    <ListItemText primary={followUp} />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Box>
        </Stack>
      )}

      <Dialog open={Boolean(selectedMetric)} onClose={() => setSelectedMetric(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Explication détaillée</DialogTitle>
        <DialogContent dividers>
          {selectedMetric && (
            <Stack spacing={2}>
              <Typography variant="subtitle1">{selectedMetric.label}</Typography>
              <Typography variant="h4">{selectedMetric.value}</Typography>
              <Typography variant="body1">{selectedMetric.explanation}</Typography>
              <Stack direction="row" spacing={1}>
                {selectedMetric.expertIds.map((expertId) => (
                  <Chip key={expertId} label={expertLabels[expertId] ?? expertId} />
                ))}
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedMetric(null)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
