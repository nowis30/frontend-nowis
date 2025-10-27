import axios from 'axios';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
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
  LinearProgress,
  Skeleton,
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
  postAdvisorConversation,
  evaluateAdvisors,
  fetchAdvisorQuestions
} from '../api/advisors';
import { useSuccessionProgress } from '../api/freeze';

const visuallyHidden = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: 1,
  margin: -1,
  overflow: 'hidden',
  padding: 0,
  position: 'absolute' as const,
  whiteSpace: 'nowrap' as const,
  width: 1
};

interface ConversationEntry {
  id: string;
  role: 'system' | 'user' | 'summary';
  content: string;
  meta?: { expertId?: string };
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

const PRIORITY_QUESTION_IDS = [
  'assetProfile',
  'taxableIncome',
  'profitMargin',
  'province',
  'holdingStructure',
  'dividendIntent',
  'liquidityGoal',
  'legalConcern'
] as const;

const QUESTION_DOCUMENT_HINTS: Partial<Record<typeof PRIORITY_QUESTION_IDS[number], string>> = {
  assetProfile:
    'Organigramme ou note résumant votre structure (ex: société opérante, immeubles locatifs, holdings).',
  taxableIncome:
    'Projection ou état financier indiquant le revenu imposable prévu pour l’exercice en cours.',
  profitMargin: 'Rapport financier ou bilan synthèse montrant la marge bénéficiaire récente.',
  province: "Lettre patente ou document d’immatriculation confirmant la province principale.",
  holdingStructure: 'Organigramme montrant la présence (ou non) d’une société de gestion.',
  dividendIntent: 'Procès-verbal ou plan de distribution confirmant les dividendes prévus.',
  liquidityGoal: 'Plan de trésorerie, budget de liquidités ou projection d’investissements.',
  legalConcern: 'Note interne ou correspondance décrivant les enjeux juridiques actuels.'
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
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speechActiveField, setSpeechActiveField] = useState<'main' | null>(null);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [interviewExpert] = useState<AdvisorInterviewerId>('planificateur');
  const [interviewMessages, setInterviewMessages] = useState<InterviewMessage[]>([]);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [interviewError, setInterviewError] = useState<string | null>(null);
  const [interviewInput, setInterviewInput] = useState('');
  const [interviewNextQuestion, setInterviewNextQuestion] = useState<AdvisorConvoNextQuestion | null>(null);
  const successionProgressQuery = useSuccessionProgress();
  const successionSectionLabelId = useId();
  const successionSectionDescriptionId = useId();
  const successionNextActionId = useId();
  const conversationRegionLabel = useId();
  const [successionHintInjected, setSuccessionHintInjected] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const interviewAnsweredRef = useRef<Set<string>>(new Set());
  const [gptHealth, setGptHealth] = useState<{ ok: boolean; provider: 'openai' | 'azure' | 'unknown'; message?: string } | null>(null);
  const [gptChecking, setGptChecking] = useState(false);
  const [modeDialogOpen, setModeDialogOpen] = useState(true);
  const [activeMode, setActiveMode] = useState<'assistant' | 'advisor' | null>(null);

  const askedQuestionsRef = useRef(new Set<string>());

  const priorityQuestions = useMemo(() => {
    if (!questions.length) {
      return [];
    }
    const byId = new Map<string, AdvisorQuestion>(questions.map((question) => [question.id, question]));
    return PRIORITY_QUESTION_IDS.map((id) => byId.get(id)).filter((question): question is AdvisorQuestion => Boolean(question));
  }, [questions]);

  const priorityQuestionSummary = useMemo(() => {
    if (!priorityQuestions.length) {
      return '';
    }
    return priorityQuestions.map((question) => question.label).join(' • ');
  }, [priorityQuestions]);

  function formatPriorityList(list: AdvisorQuestion[]): string {
    return list.map((item, index) => `${index + 1}. ${item.label}`).join('\n');
  }

  function buildInitialInterviewPrompt(): string {
    const listText = priorityQuestions.length ? formatPriorityList(priorityQuestions) : '';
    const documentHints = priorityQuestions
      .map((question) => QUESTION_DOCUMENT_HINTS[question.id as typeof PRIORITY_QUESTION_IDS[number]])
      .filter((hint): hint is string => Boolean(hint));
    const instructions = [
      "Objectif: entretien rapide pour collecter les informations essentielles du dossier immobilier.",
      listText
        ? `Questions prioritaires à poser dans l'ordre:\n${listText}`
        : 'Pose uniquement les questions critiques (profil, revenus, fiscalité, objectifs) et rien de plus.',
      'Pose une seule question concise à la fois et attends ma réponse avant de poursuivre.',
      'Quand une preuve ou un justificatif serait utile, demande explicitement le document au client (ex: « Pouvez-vous ajouter votre relevé X ? ») et rappelle où l’ajouter.'
    ];
    if (documentHints.length) {
      instructions.push(
        'Documents de référence à demander si nécessaire:',
        documentHints.map((hint, index) => `${index + 1}. ${hint}`).join('\n')
      );
    }
    return instructions.join('\n');
  }

  function buildFollowUpPrompt(params: {
    answerLabel: string;
    answerValue: string;
    question: AdvisorConvoNextQuestion | null;
  }): string {
    const { answerLabel, answerValue, question } = params;
    const answered = new Set(interviewAnsweredRef.current);
    if (question) {
      answered.add(question.id);
    }
    const remaining = priorityQuestions.filter((item) => !answered.has(item.id));
    const remainingText = remaining.length
      ? `Questions prioritaires restantes:\n${formatPriorityList(remaining)}`
      : 'Toutes les questions prioritaires ont été couvertes. Fournis un bref récapitulatif et les prochaines étapes.';
    const questionLabel = question?.label ?? 'la question précédente';
    const currentDocHint = question
      ? QUESTION_DOCUMENT_HINTS[question.id as typeof PRIORITY_QUESTION_IDS[number]]
      : undefined;
    const remainingDocHints = remaining
      .map((item) => QUESTION_DOCUMENT_HINTS[item.id as typeof PRIORITY_QUESTION_IDS[number]])
      .filter((hint): hint is string => Boolean(hint));
    const documentsGuidance = [
      currentDocHint
        ? `Document recommandé pour "${questionLabel}": ${currentDocHint}. Demande-le si ce n’est pas déjà fourni.`
        : null,
      remainingDocHints.length
        ? `Documents à récupérer prochainement:\n${remainingDocHints.map((hint) => `- ${hint}`).join('\n')}`
        : null
    ]
      .filter(Boolean)
      .join('\n');
    return [
      'Rappel: entretien accéléré, limite-toi aux informations clés.',
      remainingText,
      `Réponse fournie pour "${questionLabel}": ${answerLabel} (valeur brute: ${answerValue}).`,
      documentsGuidance,
      remaining.length
        ? 'Passe immédiatement à la prochaine question prioritaire restante.'
        : 'Conclue avec un résumé clair et les actions à prioriser.'
    ].join('\n');
  }

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

  const successionProgressReport = successionProgressQuery.data ?? null;
  const successionCompletionPercent = successionProgressReport
    ? Math.round(successionProgressReport.completionRatio * 100)
    : null;
  const successionBlockers = useMemo(
    () =>
      successionProgressReport
        ? successionProgressReport.steps
            .filter((step) => Array.isArray(step.blockers) && step.blockers.length > 0)
            .flatMap((step) => (step.blockers ?? []).map((blocker) => ({ stepLabel: step.label, blocker })))
            .slice(0, 3)
        : [],
    [successionProgressReport]
  );
  const successionLatestSimulation = successionProgressReport?.latestSimulation ?? null;

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
    if (successionHintInjected || !successionProgressReport) {
      return;
    }

    const blockers = successionProgressReport.steps
      .filter((step) => Array.isArray(step.blockers) && step.blockers.length > 0)
      .flatMap((step) => step.blockers ?? [])
      .slice(0, 3);

    const messageParts = [
      `Suivi succession : ${Math.round(successionProgressReport.completionRatio * 100)} % complété.`,
      `Prochaine étape : ${successionProgressReport.nextAction.label}. ${successionProgressReport.nextAction.suggestion}`
    ];

    if (blockers.length) {
      messageParts.push(`Bloqueurs à lever : ${blockers.join(' • ')}.`);
    }

    if (successionProgressReport.latestSimulation) {
      const { generatedAt, inputs } = successionProgressReport.latestSimulation;
      messageParts.push(
        `Dernière simulation : ${new Date(generatedAt).toLocaleDateString('fr-CA')} (horizon ${inputs.targetFreezeYear}).`
      );
    }

    setConversation((prev) => [
      ...prev,
      {
        id: generateId('succession-progress'),
        role: 'system',
        content: messageParts.join(' ')
      }
    ]);
    setSuccessionHintInjected(true);
  }, [successionHintInjected, successionProgressReport]);

  useEffect(() => {
    if (!interviewOpen) {
      setInterviewMessages([]);
      setInterviewStarted(false);
      setInterviewLoading(false);
      setInterviewCompleted(false);
      setInterviewError(null);
      setInterviewInput('');
      setInterviewNextQuestion(null);
      interviewAnsweredRef.current = new Set();
    }
  }, [interviewOpen]);

  useEffect(() => {
    if (activeMode === 'assistant') {
      setInterviewOpen(true);
    }
  }, [activeMode]);

  useEffect(() => {
    if (!activeMode) {
      setModeDialogOpen(true);
    }
  }, [activeMode]);

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

  function upsertAnswer(questionId: string, value: string): AdvisorAnswer[] {
    let nextAnswers: AdvisorAnswer[] = [];
    setAnswers((previous) => {
      const index = previous.findIndex((entry) => entry.questionId === questionId);
      if (index === -1) {
        nextAnswers = [...previous, { questionId, value }];
        return nextAnswers;
      }
      nextAnswers = [...previous];
      nextAnswers[index] = { questionId, value };
      return nextAnswers;
    });
    return nextAnswers;
  }

  function pushInterviewStep(step: AdvisorConvoStep) {
    if (step.message) {
      setInterviewMessages((prev) => [
        ...prev,
        { id: generateId('interview-assistant'), role: 'assistant', content: step.message }
      ]);
    }
    if (step.nextQuestion) {
      const mapped: AdvisorQuestion = {
        id: step.nextQuestion.id,
        label: step.nextQuestion.label,
        type: step.nextQuestion.type,
        options: step.nextQuestion.options
      };
      maybePushQuestion(mapped);
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
    interviewAnsweredRef.current = new Set();
    try {
      const prompt = buildInitialInterviewPrompt();
      const step = await postAdvisorConversation({
        expertId: interviewExpert,
        message: prompt,
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

    const activeQuestion = interviewNextQuestion;
    const questionType = activeQuestion?.type;
    const rawValue = questionType === 'select' ? interviewInput : interviewInput.trim();
    if (!rawValue) {
      setInterviewError('Merci de répondre avant de continuer.');
      return;
    }

    const displayValue =
      questionType === 'select'
        ? activeQuestion?.options?.find((option) => option.value === rawValue)?.label ?? rawValue
        : rawValue;

    const prompt = buildFollowUpPrompt({
      answerLabel: displayValue,
      answerValue: rawValue,
      question: activeQuestion
    });

    setInterviewMessages((prev) => [
      ...prev,
      { id: generateId('interview-user'), role: 'user', content: displayValue }
    ]);
    setInterviewError(null);
    setInterviewLoading(true);

    try {
      const step = await postAdvisorConversation({ expertId: interviewExpert, message: prompt, snapshot: {} });
      setInterviewInput('');
      pushInterviewStep(step);
    } catch (err) {
      console.error('Guided interview step failed', err);
      setInterviewError('Impossible de poursuivre pour le moment. Essayez à nouveau.');
      setInterviewLoading(false);
      return;
    }

    if (activeQuestion) {
      const updatedAnswers = upsertAnswer(activeQuestion.id, rawValue);
      const updatedSet = new Set(interviewAnsweredRef.current);
      updatedSet.add(activeQuestion.id);
      interviewAnsweredRef.current = updatedSet;
      setConversation((prev) => [
        ...prev,
        {
          id: generateId('interview-answer'),
          role: 'user',
          content: displayValue
        }
      ]);

      try {
        const priorCompleted = result?.completed ?? false;
        const evaluation = await evaluateWithPreferredEngine(updatedAnswers);
        setResult(evaluation);
        maybePushQuestion(evaluation.nextQuestion);
        if (evaluation.completed && !priorCompleted) {
          setConversation((prev) => [
            ...prev,
            {
              id: generateId('interview-summary'),
              role: 'summary',
              content: evaluation.coordinatorSummary
            }
          ]);
        }
      } catch (err) {
        console.error('Evaluation failed during guided interview', err);
        if (isUnauthorizedError(err)) {
          onUnauthorized?.();
          setError('Clé invalide ou expirée. Merci de la saisir à nouveau.');
        } else {
          setError("Impossible de poursuivre la simulation. Réessayez dans quelques instants.");
        }
      }
    } else {
      setConversation((prev) => [
        ...prev,
        {
          id: generateId('interview-freeform'),
          role: 'user',
          content: displayValue
        }
      ]);
    }

    setInterviewLoading(false);
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

  function startSpeechCapture(field: 'main') {
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
        setInputValue((previous) => (previous ? `${previous} ${transcript}` : transcript));
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

  function handleSpeechToggle(field: 'main') {
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
        {activeMode ? (
          <Alert
            severity="info"
            sx={{ mt: 2 }}
            action={
              <Button
                variant="outlined"
                size="small"
                onClick={() => setModeDialogOpen(true)}
              >
                Changer d’option
              </Button>
            }
          >
            Mode actif&nbsp;: {activeMode === 'assistant' ? 'Conseiller Assistant (GPT-5-mini-2025-01-13)' : 'Conseiller IA (GPT-5)'}
          </Alert>
        ) : (
          <Alert
            severity="info"
            sx={{ mt: 2 }}
            action={
              <Button variant="contained" size="small" onClick={() => setModeDialogOpen(true)}>
                Choisir
              </Button>
            }
          >
            Sélectionnez votre mode d’assistance pour démarrer.
          </Alert>
        )}
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

      <Paper
        component="section"
        variant="outlined"
        aria-labelledby={successionSectionLabelId}
        aria-describedby={successionSectionDescriptionId}
        sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
          <Stack spacing={0.5}>
            <Typography variant="h6" id={successionSectionLabelId}>
              Suivi succession
            </Typography>
            <Typography variant="body2" color="text.secondary" id={successionSectionDescriptionId}>
              Synthèse des étapes gel successoral pour orienter la prochaine réponse.
            </Typography>
          </Stack>
          {successionCompletionPercent !== null && (
            <Chip
              label={`${successionCompletionPercent} % complété`}
              color={successionCompletionPercent >= 100 ? 'success' : 'primary'}
            />
          )}
        </Stack>

        {successionProgressQuery.isLoading ? (
          <Skeleton variant="rectangular" height={8} sx={{ borderRadius: 999 }} />
        ) : successionProgressQuery.isError ? (
          <Alert severity="warning">Impossible de récupérer la progression succession pour le moment.</Alert>
        ) : successionProgressReport ? (
          <Stack spacing={2}>
            <LinearProgress
              variant="determinate"
              value={Math.min(successionProgressReport.completionRatio * 100, 100)}
              sx={{ height: 8, borderRadius: 999 }}
              aria-labelledby={successionSectionLabelId}
              aria-describedby={successionNextActionId}
            />
            <Typography variant="body2" id={successionNextActionId}>
              <strong>{successionProgressReport.nextAction.label}</strong> · {successionProgressReport.nextAction.suggestion}
            </Typography>
            {successionBlockers.length > 0 && (
              <Stack spacing={0.5}>
                <Typography variant="subtitle2" color="warning.main">
                  Bloqueurs prioritaires
                </Typography>
                <List dense disablePadding>
                  {successionBlockers.map((entry, index) => (
                    <ListItem key={`succession-blocker-${index}`} disableGutters sx={{ alignItems: 'flex-start', py: 0.25 }}>
                      <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                        <TaskAltIcon color="warning" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={entry.blocker}
                        secondary={entry.stepLabel}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Stack>
            )}
            {successionLatestSimulation && (
              <Typography variant="caption" color="text.secondary">
                Dernière simulation générée le {new Date(successionLatestSimulation.generatedAt).toLocaleDateString('fr-CA')} · Horizon{' '}
                {successionLatestSimulation.inputs.targetFreezeYear}
              </Typography>
            )}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Aucune donnée de progression disponible.
          </Typography>
        )}
      </Paper>

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
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setActiveMode('assistant');
                    setModeDialogOpen(false);
                    setInterviewOpen(true);
                  }}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Utiliser le conseiller assistant
                </Button>
              </>
            )}
            {speechError && <Typography variant="body2">{speechError}</Typography>}
          </Stack>
        </Alert>
      )}

      {activeMode === 'advisor' && (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="stretch">
          <Paper
            component="section"
            role="log"
            aria-live="polite"
            aria-labelledby={conversationRegionLabel}
            tabIndex={0}
            elevation={3}
            sx={{ flex: 1, p: 3, maxHeight: 480, overflowY: 'auto' }}
          >
            <Typography id={conversationRegionLabel} component="h2" sx={visuallyHidden}>
              Historique de la conversation avec les experts IA
            </Typography>
            <Stack component="ul" spacing={2} sx={{ listStyle: 'none', p: 0, m: 0 }}>
              {conversation.map((entry) => (
                <Box
                  component="li"
                  key={entry.id}
                  sx={{
                    alignSelf: entry.role === 'user' ? 'flex-end' : 'flex-start',
                    backgroundColor: entry.role === 'user' ? 'primary.light' : 'grey.100',
                    color: entry.role === 'user' ? 'primary.contrastText' : 'text.primary',
                    px: 2,
                    py: 1.5,
                    borderRadius: 2,
                    maxWidth: '85%',
                    listStyle: 'none'
                  }}
                >
                  <Typography variant="body2">{entry.content}</Typography>
                </Box>
              ))}
              {!conversation.length && (
                <Typography component="li" color="text.secondary" sx={{ listStyle: 'none' }}>
                  Les experts se préparent à poser leurs questions. Répondez pour recevoir vos premières recommandations.
                </Typography>
              )}
            </Stack>
          </Paper>

          <Paper elevation={3} sx={{ width: { xs: '100%', md: 360 }, p: 3 }}>
            <Stack spacing={2}>
              <Alert severity="info" variant="outlined">
                Besoin d’une précision ?
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    setActiveMode('assistant');
                    setModeDialogOpen(false);
                    setInterviewOpen(true);
                  }}
                  sx={{ ml: 1 }}
                >
                  Ouvrir le conseiller assistant
                </Button>
              </Alert>
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
            </Stack>
          </Paper>
        </Stack>
      )}

      <Paper elevation={3} sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5">Conseiller Assistant (GPT-5-mini-2025-01-13)</Typography>
          <Typography variant="body2" color="text.secondary">
            Utilisez cet assistant pour collecter toutes les informations nécessaires. Il détecte les données manquantes
            et vous invite à les préciser dans la zone de réponse.
          </Typography>
          {priorityQuestionSummary && (
            <Alert severity="info" variant="outlined">
              Questions prioritaires : {priorityQuestionSummary}
            </Alert>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <Button
              variant="contained"
              startIcon={<PsychologyIcon />}
              onClick={() => {
                setActiveMode('assistant');
                setModeDialogOpen(false);
                setInterviewOpen(true);
              }}
            >
              Ouvrir l’assistant IA
            </Button>
            <Button variant="outlined" onClick={() => setModeDialogOpen(true)}>
              Changer d’option
            </Button>
          </Stack>
        </Stack>
      </Paper>


      <Dialog
        open={modeDialogOpen}
        onClose={() => {
          if (activeMode) {
            setModeDialogOpen(false);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Choisir le conseiller IA</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Paper
              variant="outlined"
              sx={{ p: 2, borderColor: activeMode === 'assistant' ? 'primary.main' : undefined }}
            >
              <Stack spacing={1.5}>
                <Typography variant="h6">Conseiller Assistant</Typography>
                <Typography variant="body2" color="text.secondary">
                  Collecte des informations manquantes via GPT-5-mini-2025-01-13. L’assistant vous demande de préciser
                  les éléments qu’il ne connaît pas.
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    onClick={() => {
                      setActiveMode('assistant');
                      setModeDialogOpen(false);
                      setInterviewOpen(true);
                    }}
                  >
                    Ouvrir l’assistant
                  </Button>
                </Stack>
              </Stack>
            </Paper>
            <Paper
              variant="outlined"
              sx={{ p: 2, borderColor: activeMode === 'advisor' ? 'primary.main' : undefined }}
            >
              <Stack spacing={1.5}>
                <Typography variant="h6">Conseiller IA</Typography>
                <Typography variant="body2" color="text.secondary">
                  Analyse stratégique générée par GPT-5. Vérifie les informations manquantes et redirige vers
                  l’assistant si nécessaire.
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => {
                      setActiveMode('advisor');
                      setModeDialogOpen(false);
                    }}
                  >
                    Consulter le diagnostic
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions>
          {activeMode && (
            <Button onClick={() => setModeDialogOpen(false)}>Fermer</Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={interviewOpen} onClose={() => setInterviewOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Entretien guidé avec un expert</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="info" variant="outlined">
              Conseiller Assistant piloté par {expertLabels[interviewExpert]}. Modèle : GPT-5-mini-2025-01-13.
            </Alert>

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

      {activeMode === 'advisor' && result?.completed && (
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
