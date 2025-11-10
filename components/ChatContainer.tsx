'use client';

import { useState, useEffect, useRef } from 'react';
import { ChatMessage as MessageType } from '@/types';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { apiClient } from '@/lib/api';
import { storageService } from '@/lib/storage';
import { LogOut, Trash2, HelpCircle } from 'lucide-react';
import { authService } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function ChatContainer() {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState<string>(() => `session-${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load chat history on mount
  useEffect(() => {
    const history = storageService.loadChatHistory();
    if (history.length > 0) {
      setMessages(history);
    }
  }, []);

  // Save chat history whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      storageService.saveChatHistory(messages);
    }
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    // Add user message
    const userMessage: MessageType = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Add placeholder assistant message
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: MessageType = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const request = {
        question: content,
        session_id: sessionId,
      };

      // Check if streaming is enabled (you can make this configurable)
      const useStreaming = process.env.NEXT_PUBLIC_USE_STREAMING !== 'false';

      if (useStreaming) {
        // Streaming response
        let fullResponse = '';
        
        await apiClient.askQuestionStream(
          request,
          (chunk: string) => {
            fullResponse += chunk;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: fullResponse }
                  : msg
              )
            );
          },
          (response) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? {
                      ...msg,
                      content: response.response || fullResponse,
                      sql: response.sql,
                      data: response.data,
                      visualization: response.visualization,
                      error: response.error,
                    }
                  : msg
              )
            );
            setIsLoading(false);
          },
          (error) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? {
                      ...msg,
                      content: '',
                      error: error.message || 'Failed to get response. Please try again.',
                    }
                  : msg
              )
            );
            setIsLoading(false);
          }
        );
      } else {
        // Non-streaming response
        const response = await apiClient.askQuestion(request);
        
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: response.response || '',
                  sql: response.sql,
                  data: response.data,
                  visualization: response.visualization,
                  error: response.error,
                }
              : msg
          )
        );
        setIsLoading(false);
      }
    } catch (error: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: '',
                error: error.message || 'Something went wrong. Please try again.',
              }
            : msg
        )
      );
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    if (confirm('Are you sure you want to clear all chat history?')) {
      setMessages([]);
      storageService.clearChatHistory();
    }
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to clear your session?')) {
      authService.clearAuth();
      // Authentication is disabled, so just clear auth without redirecting
      // router.push('/login');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Data Assistant
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ask questions about your data in plain language
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearChat}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Clear chat history"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mb-4">
                <HelpCircle className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                Welcome! How can I help you?
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
                Ask questions about your data in plain language. For example, "How many students are in grade 5?" or "Show me the total sales this month."
              </p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isLoading && (
                <div className="flex gap-4 mb-6">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div className="text-gray-500 dark:text-gray-400 italic">
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Input Area */}
      <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />
    </div>
  );
}

