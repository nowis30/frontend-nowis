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

export interface AdvisorResultEngine {
  mode: AdvisorEngineMode;
  isSimulated: boolean;
  note?: string;
}

export interface AdvisorResult {
  nextQuestion: AdvisorQuestion | null;
  completed: boolean;
  coordinatorSummary: string;
  recommendations: AdvisorRecommendation[];
  metrics: AdvisorMetric[];
  followUps: string[];
  engine: AdvisorResultEngine;
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
