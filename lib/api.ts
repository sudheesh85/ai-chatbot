import axios, { AxiosInstance } from 'axios';
import { APIRequest, APIResponse } from '@/types';

class APIClient {
  private client: AxiosInstance;
  private baseURL: string;
  private streamingURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';
    this.streamingURL = process.env.NEXT_PUBLIC_API_STREAMING_URL || `${this.baseURL}/ask/question/stream`;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Set authentication token/API key
  setAuth(token?: string, apiKey?: string) {
    if (token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else if (apiKey) {
      this.client.defaults.headers.common['X-API-Key'] = apiKey;
    } else {
      delete this.client.defaults.headers.common['Authorization'];
      delete this.client.defaults.headers.common['X-API-Key'];
    }
  }

  // Non-streaming request
  async askQuestion(request: APIRequest): Promise<APIResponse> {
    try {
      const response = await this.client.post<APIResponse>('/ask/question', request);
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(error.response.data?.error || error.response.data?.message || 'API request failed');
      } else if (error.request) {
        throw new Error('Unable to connect to the server. Please check your connection.');
      } else {
        throw new Error(error.message || 'An unexpected error occurred');
      }
    }
  }

  // Streaming request using Server-Sent Events
  async askQuestionStream(
    request: APIRequest,
    onChunk: (chunk: string) => void,
    onComplete: (response: APIResponse) => void,
    onError: (error: Error) => void
  ) {
    const token = this.client.defaults.headers.common['Authorization']?.toString().replace('Bearer ', '');
    const apiKey = this.client.defaults.headers.common['X-API-Key']?.toString();
    
    const url = new URL(this.streamingURL);
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    try {
      const response = await fetch(this.streamingURL, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.chunk) {
                onChunk(parsed.chunk);
              }
              if (parsed.complete) {
                onComplete(parsed);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error: any) {
      onError(new Error(error.message || 'Streaming request failed'));
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

export const apiClient = new APIClient();

