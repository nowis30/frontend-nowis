import { apiClient } from './client';

export interface AdvisorQuestionOption {
  value: string;
  label: string;
  helperText?: string;
}

export interface AdvisorQuestion {
  id: string;
  label: string;
  description?: string;
  type: 'text' | 'number' | 'select';
  placeholder?: string;
  options?: AdvisorQuestionOption[];
}

export interface AdvisorAnswer {
  questionId: string;
  value: string;
}

export interface AdvisorMetric {
  id: string;
  label: string;
  value: string;
  explanation: string;
  expertIds: string[];
}

export interface AdvisorRecommendation {
  expertId: string;
  title: string;
  summary: string;
  rationale: string[];
}

export type AdvisorEngineMode = 'heuristic' | 'gpt';

export type AdvisorResponderId = 'fiscaliste' | 'comptable' | 'planificateur' | 'avocat' | 'group';
export type AdvisorInterviewerId = Exclude<AdvisorResponderId, 'group'>;

export interface AdvisorResultEngine {
  mode: AdvisorEngineMode;
  isSimulated: boolean;
  note?: string;
}

export interface AdvisorUncertaintyField {
  questionId: string;
  label: string;
  description?: string;
}

export interface AdvisorTargetedAnswer {
  expertId: AdvisorResponderId;
  answer: string;
  keyPoints: string[];
  followUps: string[];
  metrics: AdvisorMetric[];
  engine: {
    mode: AdvisorEngineMode;
    note?: string;
  };
}

export interface AdvisorResult {
  nextQuestion: AdvisorQuestion | null;
  completed: boolean;
  coordinatorSummary: string;
  recommendations: AdvisorRecommendation[];
  metrics: AdvisorMetric[];
  followUps: string[];
  uncertainty: AdvisorUncertaintyField[];
  engine: AdvisorResultEngine;
}

export interface AdvisorConvoNextQuestion {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export type AdvisorConvoUpdate =
  | {
      op: 'upsertProperty';
      match: { name: string };
      set: {
        address?: string;
        acquisitionDate?: string;
        currentValue?: number;
        purchasePrice?: number;
        notes?: string;
      };
    }
  | {
      op: 'addRevenue' | 'addExpense';
      match: { propertyName: string };
      set: {
        label: string;
        amount: number;
        frequency: 'PONCTUEL' | 'HEBDOMADAIRE' | 'MENSUEL' | 'TRIMESTRIEL' | 'ANNUEL';
        startDate: string;
        endDate?: string | null;
      };
    }
  | {
      op: 'addPersonalIncome';
      match: { shareholderName?: string | null };
      set: {
        taxYear: number;
        category: string;
        label: string;
        amount: number;
        source?: string;
        slipType?: string;
      };
    };

export interface AdvisorConvoSnapshot {
  properties?: Array<{
    id?: number;
    name: string;
    address?: string | null;
    acquisitionDate?: string | null;
    currentValue?: number | null;
    purchasePrice?: number | null;
    notes?: string | null;
  }>;
  personalIncomes?: Array<{
    id?: number;
    shareholderName?: string | null;
    taxYear: number;
    category: string;
    label: string;
    amount: number;
  }>;
}

export interface AdvisorConvoStep {
  conversationId: number | null;
  completed: boolean;
  message: string;
  nextQuestion: AdvisorConvoNextQuestion | null;
  updates: AdvisorConvoUpdate[];
}

export type AdvisorConversationStatus = 'active' | 'completed';

export interface AdvisorConversationSummary {
  id: number;
  expertId: AdvisorInterviewerId;
  status: AdvisorConversationStatus;
  createdAt: string;
  updatedAt: string;
  lastMessage?: {
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
  };
}

export interface AdvisorConversationStepDetail {
  id: number;
  role: 'user' | 'assistant';
  message: string;
  createdAt: string;
  snapshot?: unknown;
  updates?: unknown;
  nextQuestion?: unknown;
  completed?: boolean | null;
}

export interface AdvisorConversationDetail {
  id: number;
  expertId: AdvisorInterviewerId;
  status: AdvisorConversationStatus;
  createdAt: string;
  updatedAt: string;
  steps: AdvisorConversationStepDetail[];
}

export async function fetchAdvisorQuestions(): Promise<AdvisorQuestion[]> {
  const response = await apiClient.get<{ questions: AdvisorQuestion[] }>('/advisors/questions');
  return response.data.questions;
}

export interface EvaluateAdvisorsOptions {
  engine?: AdvisorEngineMode;
}

export async function evaluateAdvisors(
  answers: AdvisorAnswer[],
  options: EvaluateAdvisorsOptions = {}
): Promise<AdvisorResult> {
  const response = await apiClient.post<AdvisorResult>(
    '/advisors/evaluate',
    { answers },
    options.engine ? { params: { engine: options.engine } } : undefined
  );
  return response.data;
}

export interface AskAdvisorPayload {
  expertId: AdvisorResponderId;
  question: string;
  answers: AdvisorAnswer[];
}

export async function askAdvisorQuestion(payload: AskAdvisorPayload): Promise<AdvisorTargetedAnswer> {
  const response = await apiClient.post<AdvisorTargetedAnswer>('/advisors/ask', payload);
  return response.data;
}

export interface AdvisorConvoPayload {
  conversationId?: number | null;
  expertId: AdvisorInterviewerId;
  message: string;
  snapshot?: AdvisorConvoSnapshot;
}

export async function postAdvisorConversation(payload: AdvisorConvoPayload): Promise<AdvisorConvoStep> {
  const response = await apiClient.post<AdvisorConvoStep>('/advisors/convo', payload);
  return response.data;
}

export async function listAdvisorConversations(): Promise<AdvisorConversationSummary[]> {
  const response = await apiClient.get<{ conversations: AdvisorConversationSummary[] }>('/advisors/convo');
  return response.data.conversations;
}

export async function fetchAdvisorConversationDetail(id: number): Promise<AdvisorConversationDetail> {
  const response = await apiClient.get<AdvisorConversationDetail>(`/advisors/convo/${id}`);
  return response.data;
}

export async function updateAdvisorConversationStatus(
  id: number,
  status: AdvisorConversationStatus
): Promise<AdvisorConversationSummary> {
  const response = await apiClient.patch<AdvisorConversationSummary>(`/advisors/convo/${id}`, { status });
  return response.data;
}
