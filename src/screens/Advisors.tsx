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
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import KeyboardVoiceIcon from '@mui/icons-material/KeyboardVoice';

import {
  AdvisorAnswer,
  AdvisorEngineMode,
  AdvisorConvoNextQuestion,
  AdvisorConvoStep,
  AdvisorInterviewerId,
  AdvisorMetric,
  AdvisorQuestion,
  AdvisorResult,
  AdvisorResponderId,
  askAdvisorQuestion,
  postAdvisorConversation,
  evaluateAdvisors,
  fetchAdvisorQuestions
} from '../api/advisors';

interface ConversationEntry {
  id: string;
  role: 'system' | 'user' | 'summary';
  content: string;
  meta?: { expertId?: string };
}

interface TargetedExchange {
  id: string;
  expertId: AdvisorResponderId;
  expertLabel: string;
  question: string;
  answer: string;
  keyPoints: string[];
  followUps: string[];
  metrics: AdvisorMetric[];
  engineMode: AdvisorEngineMode;
  engineNote?: string;
}

interface InterviewMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
}

interface AdvisorsScreenProps {
  onUnauthorized?: () => void;
}

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionEvent = {
  results: ArrayLike<{
    isFinal: boolean;
    [index: number]: { transcript: string };
  }>;
};

type BrowserSpeechRecognitionErrorEvent = {
  error: string;
};

const expertLabels: Record<string, string> = {
  fiscaliste: 'Fiscaliste',
  comptable: 'Comptable',
  planificateur: 'Planificateur financier',
  avocat: 'Avocat corporatif',
  group: 'Comite IA'
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
  const [targetExpert, setTargetExpert] = useState<AdvisorResponderId>('group');
  const [targetQuestion, setTargetQuestion] = useState('');
  const [targetError, setTargetError] = useState<string | null>(null);
  const [targetLoading, setTargetLoading] = useState(false);
  const [targetHistory, setTargetHistory] = useState<TargetedExchange[]>([]);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speechActiveField, setSpeechActiveField] = useState<'main' | 'target' | null>(null);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [interviewExpert, setInterviewExpert] = useState<AdvisorInterviewerId>('fiscaliste');
  const [interviewMessages, setInterviewMessages] = useState<InterviewMessage[]>([]);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [interviewError, setInterviewError] = useState<string | null>(null);
  const [interviewInput, setInterviewInput] = useState('');
  const [interviewNextQuestion, setInterviewNextQuestion] = useState<AdvisorConvoNextQuestion | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const [gptHealth, setGptHealth] = useState<{ ok: boolean; provider: 'openai' | 'azure' | 'unknown'; message?: string } | null>(null);
  const [gptChecking, setGptChecking] = useState(false);

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
    if (typeof window === 'undefined') {
      return;
    }
    const recognitionClass = (window as typeof window & {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    }).SpeechRecognition ??
      (window as typeof window & { webkitSpeechRecognition?: new () => BrowserSpeechRecognition })
        .webkitSpeechRecognition;
    setSpeechSupported(Boolean(recognitionClass));

    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    setInputValue('');
    setFormError(null);
  }, [currentQuestion?.id]);

  useEffect(() => {
    if (!interviewOpen) {
      setInterviewMessages([]);
      setInterviewStarted(false);
      setInterviewLoading(false);
      setInterviewCompleted(false);
      setInterviewError(null);
      setInterviewInput('');
      setInterviewNextQuestion(null);
    }
  }, [interviewOpen]);

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

  function pushInterviewStep(step: AdvisorConvoStep) {
    if (step.message) {
      setInterviewMessages((prev) => [
        ...prev,
        { id: generateId('interview-assistant'), role: 'assistant', content: step.message }
      ]);
    }
    setInterviewNextQuestion(step.nextQuestion);
    setInterviewCompleted(step.completed);
    if (!step.completed && step.nextQuestion?.type === 'select' && step.nextQuestion.options?.length) {
      setInterviewInput(step.nextQuestion.options[0].value);
    } else {
      setInterviewInput('');
    }
  }

  async function startInterview() {
    if (interviewLoading || interviewStarted) {
      return;
    }
    setInterviewError(null);
    setInterviewLoading(true);
    setInterviewStarted(true);
    try {
      const step = await postAdvisorConversation({
        expertId: interviewExpert,
        message:
          "Démarre l'entretien et pose-moi la première question pour collecter mes informations personnelles.",
        snapshot: {}
      });
      pushInterviewStep(step);
    } catch (err) {
      console.error('Failed to start guided interview', err);
      setInterviewError("Impossible de démarrer l'entretien. Réessayez plus tard.");
      setInterviewStarted(false);
    } finally {
      setInterviewLoading(false);
    }
  }

  async function handleInterviewSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!interviewStarted || interviewLoading || interviewCompleted) {
      return;
    }

    const value = interviewInput.trim();
    if (!value) {
      setInterviewError('Merci de répondre avant de continuer.');
      return;
    }

    setInterviewMessages((prev) => [
      ...prev,
      { id: generateId('interview-user'), role: 'user', content: value }
    ]);
    setInterviewInput('');
    setInterviewError(null);
    setInterviewLoading(true);
    try {
      const step = await postAdvisorConversation({ expertId: interviewExpert, message: value, snapshot: {} });
      pushInterviewStep(step);
    } catch (err) {
      console.error('Guided interview step failed', err);
      setInterviewError('Impossible de poursuivre pour le moment. Essayez à nouveau.');
    } finally {
      setInterviewLoading(false);
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

  function stopSpeechCapture() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn('Speech recognition already stopped', err);
      }
      recognitionRef.current = null;
    }
    setListening(false);
    setSpeechActiveField(null);
  }

  function startSpeechCapture(field: 'main' | 'target') {
    if (typeof window === 'undefined') {
      return;
    }
    const recognitionCtor =
      (window as typeof window & {
        SpeechRecognition?: new () => BrowserSpeechRecognition;
        webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
      }).SpeechRecognition ??
      (window as typeof window & { webkitSpeechRecognition?: new () => BrowserSpeechRecognition })
        .webkitSpeechRecognition;

    if (!recognitionCtor) {
      setSpeechError('La saisie vocale n’est pas prise en charge sur ce navigateur.');
      return;
    }

    stopSpeechCapture();

    try {
      const recognition = new recognitionCtor();
      recognition.lang = 'fr-FR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
        const transcript = event.results?.[0]?.[0]?.transcript ?? '';
        if (!transcript) {
          return;
        }
        if (field === 'main') {
          setInputValue((previous) => (previous ? `${previous} ${transcript}` : transcript));
        } else {
          setTargetQuestion((previous) => (previous ? `${previous} ${transcript}` : transcript));
        }
      };

      recognition.onerror = (event: BrowserSpeechRecognitionErrorEvent) => {
        let message = "Erreur lors de la saisie vocale.";
        if (event.error === 'not-allowed') {
          message = 'Accès au micro refusé. Vérifiez les permissions du navigateur.';
        } else if (event.error === 'no-speech') {
          message = 'Aucune voix détectée. Réessayez après avoir parlé clairement.';
        }
        setSpeechError(message);
      };

      recognition.onend = () => {
        stopSpeechCapture();
      };

      recognitionRef.current = recognition;
      setSpeechActiveField(field);
      setSpeechError(null);
      setListening(true);
      recognition.start();
    } catch (err) {
      console.error('Speech recognition init failed', err);
      setSpeechError("Impossible de démarrer la saisie vocale.");
      stopSpeechCapture();
    }
  }

  function handleSpeechToggle(field: 'main' | 'target') {
    if (!speechSupported) {
      setSpeechError('La saisie vocale n’est pas prise en charge sur ce navigateur.');
      return;
    }

    if (listening && speechActiveField === field) {
      stopSpeechCapture();
      return;
    }

    startSpeechCapture(field);
  }

  async function handleTargetedAsk(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (targetLoading) {
      return;
    }

    const trimmed = targetQuestion.trim();
    if (!trimmed) {
      setTargetError('Formulez une question avant de soumettre.');
      return;
    }

    setTargetError(null);
    setTargetLoading(true);
    try {
      const response = await askAdvisorQuestion({
        expertId: targetExpert,
        question: trimmed,
        answers
      });

      const responderLabel = expertLabels[response.expertId] ?? response.expertId;
      setConversation((prev) => [
        ...prev,
        {
          id: generateId('target-question'),
          role: 'user',
          content: `[${responderLabel}] ${trimmed}`
        },
        {
          id: generateId('target-answer'),
          role: 'system',
          content: response.answer,
          meta: { expertId: response.expertId === 'group' ? undefined : response.expertId }
        }
      ]);

      const exchange: TargetedExchange = {
        id: generateId('target-exchange'),
        expertId: response.expertId,
        expertLabel: responderLabel,
        question: trimmed,
        answer: response.answer,
        keyPoints: response.keyPoints,
        followUps: response.followUps,
        metrics: response.metrics,
        engineMode: response.engine.mode,
        engineNote: response.engine.note
      };

      setTargetHistory((prev) => [exchange, ...prev].slice(0, 5));
      setTargetQuestion('');
    } catch (err) {
      console.error('Targeted question failed', err);
      if (isUnauthorizedError(err)) {
        onUnauthorized?.();
        setTargetError('Acces non autorise. Merci de verifier votre cle.');
      } else if (axios.isAxiosError(err)) {
        const serverMessage = (err.response?.data as { error?: string } | undefined)?.error;
        setTargetError(serverMessage ?? 'Impossible de traiter cette question pour le moment.');
      } else {
        setTargetError('Impossible de traiter cette question pour le moment.');
      }
    } finally {
      setTargetLoading(false);
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
        <Stack spacing={1} sx={{ mt: 2 }}>
          {engineDisplayLabel && <Chip label={engineDisplayLabel} color="secondary" variant="outlined" />}
          {engineMeta?.note && <Alert severity="info">{engineMeta.note}</Alert>}
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              variant="outlined"
              onClick={async () => {
                try {
                  setGptChecking(true);
                  setGptHealth(null);
                  const { data } = await axios.get<{ engine: string; openai?: { ok: boolean; provider: 'openai' | 'azure' | 'unknown'; message?: string }; error?: string }>(
                    '/api/advisors/health'
                  );
                  setGptHealth(data.openai ?? null);
                } catch {
                  setGptHealth({ ok: false, provider: 'unknown', message: "Diagnostic impossible" });
                } finally {
                  setGptChecking(false);
                }
              }}
            >
              {gptChecking ? 'Diagnostic…' : 'Vérifier GPT'}
            </Button>
            {gptHealth && (
              <Chip
                size="small"
                color={gptHealth.ok ? 'success' : 'warning'}
                label={gptHealth.ok ? `GPT OK (${gptHealth.provider})` : `GPT indisponible (${gptHealth.provider})`}
              />
            )}
          </Stack>
          {gptHealth && gptHealth.message && !gptHealth.ok && (
            <Typography variant="caption" color="text.secondary">
              {gptHealth.message}
            </Typography>
          )}
        </Stack>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {(uncertainty.length > 0 || speechError) && (
        <Alert severity="warning" variant="outlined">
          <Stack spacing={1}>
            {uncertainty.length > 0 && (
              <>
                <Typography variant="body2">
                  Certaines réponses sont à confirmer. Vous pourrez préciser ces points plus tard :
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {uncertainty.map((field) => (
                    <Chip key={field.questionId} label={field.label} color="warning" variant="outlined" size="small" />
                  ))}
                </Stack>
              </>
            )}
            {speechError && <Typography variant="body2">{speechError}</Typography>}
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
                      InputProps={
                        speechSupported
                          ? {
                              endAdornment: (
                                <InputAdornment position="end">
                                  <Tooltip
                                    title={
                                      listening && speechActiveField === 'main'
                                        ? 'Arrêter la dictée'
                                        : 'Dicter au micro'
                                    }
                                  >
                                    <span>
                                      <IconButton
                                        onClick={() => handleSpeechToggle('main')}
                                        color={listening && speechActiveField === 'main' ? 'primary' : 'default'}
                                        aria-label="Saisie vocale pour la réponse"
                                        size="small"
                                        disabled={submitting}
                                      >
                                        <KeyboardVoiceIcon fontSize="small" />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                </InputAdornment>
                              )
                            }
                          : undefined
                      }
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

      <Paper elevation={3} sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5">Entretien guidé</Typography>
          <Typography variant="body2" color="text.secondary">
            Sélectionnez l’expert qui pilotera l’entretien et répondra à vos questions tout en collectant vos
            informations personnelles.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <TextField
              select
              label="Expert animateur"
              value={interviewExpert}
              onChange={(event) => setInterviewExpert(event.target.value as AdvisorInterviewerId)}
              sx={{ width: { xs: '100%', sm: 260 } }}
            >
              {(['fiscaliste', 'comptable', 'planificateur', 'avocat'] as AdvisorInterviewerId[]).map((option) => (
                <MenuItem key={option} value={option}>
                  {expertLabels[option] ?? option}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              startIcon={<PsychologyIcon />}
              onClick={() => setInterviewOpen(true)}
            >
              Choisir cet expert
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper elevation={3} sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5">Questions ciblees</Typography>
          <Typography variant="body2" color="text.secondary">
            Choisissez un expert ou le comite IA pour obtenir une reponse ciblee basee sur vos reponses actuelles.
          </Typography>
          {targetError && <Alert severity="error">{targetError}</Alert>}
          <Stack component="form" spacing={2} onSubmit={handleTargetedAsk}>
            <TextField
              select
              label="Destinataire"
              value={targetExpert}
              onChange={(event) => setTargetExpert(event.target.value as AdvisorResponderId)}
              helperText="Le comite IA combine les quatre experts."
              required
              fullWidth
            >
              {(['group', 'fiscaliste', 'comptable', 'planificateur', 'avocat'] as AdvisorResponderId[]).map((option) => (
                <MenuItem key={option} value={option}>
                  {expertLabels[option] ?? option}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Votre question ciblee"
              value={targetQuestion}
              onChange={(event) => setTargetQuestion(event.target.value)}
              multiline
              minRows={2}
              required
              fullWidth
              helperText="Precisez le contexte ou la decision a clarifier."
              InputProps={
                speechSupported
                  ? {
                      endAdornment: (
                        <InputAdornment position="end">
                          <Tooltip
                            title={
                              listening && speechActiveField === 'target'
                                ? 'Arrêter la dictée'
                                : 'Dicter au micro'
                            }
                          >
                            <span>
                              <IconButton
                                onClick={() => handleSpeechToggle('target')}
                                color={listening && speechActiveField === 'target' ? 'primary' : 'default'}
                                aria-label="Saisie vocale pour la question ciblee"
                                size="small"
                                disabled={targetLoading}
                              >
                                <KeyboardVoiceIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </InputAdornment>
                      )
                    }
                  : undefined
              }
            />
            <Stack direction="row" spacing={2}>
              <Button type="submit" variant="contained" disabled={targetLoading} startIcon={<QuestionAnswerIcon />}>
                {targetLoading ? 'Analyse en cours...' : 'Obtenir une reponse ciblee'}
              </Button>
              <Button
                type="button"
                variant="text"
                disabled={targetLoading}
                onClick={() => {
                  setTargetQuestion('');
                  setTargetError(null);
                }}
              >
                Effacer
              </Button>
            </Stack>
          </Stack>

          {targetHistory.length > 0 && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {targetHistory.map((exchange) => (
                <Paper key={exchange.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={exchange.expertLabel} color="primary" size="small" />
                      <Chip
                        label={exchange.engineMode === 'gpt' ? 'GPT' : 'Heuristique'}
                        size="small"
                        color={exchange.engineMode === 'gpt' ? 'secondary' : 'default'}
                      />
                      {exchange.engineNote && (
                        <Typography variant="caption" color="text.secondary">
                          {exchange.engineNote}
                        </Typography>
                      )}
                    </Stack>
                    <Typography variant="subtitle2">Question</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {exchange.question}
                    </Typography>
                    <Typography variant="subtitle2">Reponse</Typography>
                    <Typography variant="body2">{exchange.answer}</Typography>
                    {exchange.keyPoints.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2">Points a retenir</Typography>
                        <List dense>
                          {exchange.keyPoints.map((point, index) => (
                            <ListItem key={index} disableGutters>
                              <ListItemIcon sx={{ minWidth: 32 }}>
                                <TipsAndUpdatesIcon fontSize="small" color="action" />
                              </ListItemIcon>
                              <ListItemText primary={point} primaryTypographyProps={{ variant: 'body2' }} />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                    {exchange.followUps.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2">Suivis proposes</Typography>
                        <List dense>
                          {exchange.followUps.map((item, index) => (
                            <ListItem key={index} disableGutters>
                              <ListItemIcon sx={{ minWidth: 32 }}>
                                <TaskAltIcon color="success" />
                              </ListItemIcon>
                              <ListItemText primary={item} primaryTypographyProps={{ variant: 'body2' }} />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                    {exchange.metrics.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2">Indicateurs associes</Typography>
                        <Stack spacing={1}>
                          {exchange.metrics.map((metric) => (
                            <Typography key={metric.id} variant="body2">
                              {metric.label}: {metric.value}
                            </Typography>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>

      <Dialog open={interviewOpen} onClose={() => setInterviewOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Entretien guidé avec un expert</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              select
              label="Expert"
              value={interviewExpert}
              onChange={(event) => setInterviewExpert(event.target.value as AdvisorInterviewerId)}
              disabled={interviewStarted && !interviewCompleted}
            >
              {(['fiscaliste', 'comptable', 'planificateur', 'avocat'] as AdvisorInterviewerId[]).map((option) => (
                <MenuItem key={option} value={option}>
                  {expertLabels[option] ?? option}
                </MenuItem>
              ))}
            </TextField>

            {interviewError && <Alert severity="error">{interviewError}</Alert>}

            {interviewStarted ? (
              <>
                <Paper variant="outlined" sx={{ p: 2, maxHeight: 280, overflowY: 'auto' }}>
                  <Stack spacing={1.5}>
                    {interviewMessages.map((entry) => (
                      <Box
                        key={entry.id}
                        sx={{
                          alignSelf: entry.role === 'user' ? 'flex-end' : 'flex-start',
                          backgroundColor: entry.role === 'user' ? 'primary.main' : 'grey.100',
                          color: entry.role === 'user' ? 'primary.contrastText' : 'text.primary',
                          px: 2,
                          py: 1,
                          borderRadius: 2,
                          maxWidth: '85%'
                        }}
                      >
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {entry.content}
                        </Typography>
                      </Box>
                    ))}
                    {interviewLoading && (
                      <Typography variant="body2" color="text.secondary">
                        {expertLabels[interviewExpert]} réfléchit…
                      </Typography>
                    )}
                  </Stack>
                </Paper>

                {interviewNextQuestion && (
                  <Alert severity="info">
                    {interviewNextQuestion.label}
                    {interviewNextQuestion.options?.length ? ' — sélectionnez ou répondez ci-dessous.' : ''}
                  </Alert>
                )}

                {interviewCompleted && (
                  <Alert severity="success">
                    Entretien terminé. Vous pouvez fermer la fenêtre ou relancer avec un autre spécialiste.
                  </Alert>
                )}

                {!interviewCompleted && (
                  <Stack component="form" spacing={2} onSubmit={handleInterviewSubmit}>
                    {(() => {
                      const isSelectQuestion =
                        interviewNextQuestion?.type === 'select' && interviewNextQuestion.options?.length;
                      const isNumberQuestion = interviewNextQuestion?.type === 'number';
                      if (isSelectQuestion) {
                        return (
                          <TextField
                            select
                            label="Votre réponse"
                            value={interviewInput}
                            onChange={(event) => setInterviewInput(event.target.value)}
                            required
                            fullWidth
                          >
                            {interviewNextQuestion?.options?.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </TextField>
                        );
                      }
                      return (
                        <TextField
                          label="Votre réponse"
                          value={interviewInput}
                          onChange={(event) => setInterviewInput(event.target.value)}
                          required
                          fullWidth
                          placeholder={interviewNextQuestion?.placeholder}
                          type={isNumberQuestion ? 'number' : 'text'}
                          inputProps={
                            isNumberQuestion
                              ? { inputMode: 'decimal', 'aria-label': 'Réponse numérique ou texte' }
                              : undefined
                          }
                        />
                      );
                    })()}
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={interviewLoading}
                      startIcon={<QuestionAnswerIcon />}
                    >
                      Envoyer ma réponse
                    </Button>
                  </Stack>
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Choisissez un expert puis lancez l’entretien pour qu’il vous pose des questions ciblées.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInterviewOpen(false)}>Fermer</Button>
          {!interviewStarted && (
            <Button
              variant="contained"
              onClick={startInterview}
              disabled={interviewLoading}
              startIcon={<QuestionAnswerIcon />}
            >
              Lancer l’entretien
            </Button>
          )}
        </DialogActions>
      </Dialog>

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
