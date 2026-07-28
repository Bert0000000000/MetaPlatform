import type { ReactNode } from 'react';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface PageAssistantConfig {
  employeeId: string;
  employeeName: string;
  employeeAvatar?: ReactNode;
  employeeDescription: string;
  moduleLabel: string;
  welcomeMessage: string;
  suggestions: string[];
  createReply?: (content: string) => string;
  replyDelayMs?: number;
}

export interface PageAssistantController extends PageAssistantConfig {
  isOpen: boolean;
  sessionId: string;
  messages: AssistantMessage[];
  isThinking: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  sendMessage: (content: string) => void;
  clearSession: () => void;
}