// API Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sql?: string;
  data?: {
    columns: string[];
    rows: any[][];
  };
  visualization?: 'bar' | 'line' | 'pie' | 'table';
  error?: string;
}

export interface APIRequest {
  question: string;
  org_id?: number;
  session_id?: string;
}

export interface APIResponse {
  success: boolean;
  response: string;
  sql?: string;
  data?: {
    columns: string[];
    rows: any[][];
  };
  visualization?: 'bar' | 'line' | 'pie' | 'table';
  error?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  token?: string;
  apiKey?: string;
  user?: {
    email?: string;
    name?: string;
  };
}

export interface QueryExample {
  id: string;
  text: string;
  category: string;
}

