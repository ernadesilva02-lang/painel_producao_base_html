export type FailureCategory = 'security' | 'vercel' | 'auth' | 'database' | 'realtime';

export interface AuditItem {
  id: string;
  category: FailureCategory;
  title: string;
  severity: 'high' | 'medium' | 'info';
  symptom: string;
  cause: string;
  solution: string;
  codeSnippet?: string;
  checked?: boolean;
}

export interface PresetTemplate {
  id: string;
  title: string;
  category: string;
  sampleCodeOrError: string;
  analysis: {
    problem: string;
    risk: string;
    fixTitle: string;
    fixedCode: string;
    recommendation: string;
  };
}

export interface AnalysisResult {
  detectedCategory: string;
  title: string;
  status: 'warning' | 'danger' | 'info' | 'success';
  summary: string;
  recommendations: string[];
  suggestedFix?: string;
}
