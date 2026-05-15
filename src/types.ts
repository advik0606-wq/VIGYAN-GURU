export interface Message {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface ProblemStep {
  title: string;
  description: string;
  completed: boolean;
}

export interface AppState {
  problemImage: string | null;
  problemMimeType: string | null;
  messages: Message[];
  steps: ProblemStep[];
  isAnalyzing: boolean;
}
