import type { FormConfig, FlowConfig } from './index';
import type { PageDesignerConfig } from '@/api/pages';

export type ArtifactType = 'form' | 'flow' | 'page';
export type AIDesignerMode = 'single' | 'full';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIFormArtifact {
  type: 'form';
  name: string;
  description?: string;
  config: FormConfig;
}

export interface AIFlowArtifact {
  type: 'flow';
  name: string;
  description?: string;
  config: FlowConfig;
}

export interface AIPageArtifact {
  type: 'page';
  name: string;
  description?: string;
  config: PageDesignerConfig;
}

export type AIArtifact = AIFormArtifact | AIFlowArtifact | AIPageArtifact;

export interface AIDesignSession {
  sessionId: string;
  title: string;
  messages: ChatMessage[];
  artifacts: AIArtifact[];
  createdAt: string;
  updatedAt: string;
}

export interface AIGeneratedModule {
  moduleId: string;
  appId: string;
  name: string;
  code: string;
  type: 'FORM' | 'FLOW' | 'PAGE';
  description?: string;
  icon?: string;
  config: FormConfig | FlowConfig | PageDesignerConfig;
  createdAt: string;
  updatedAt: string;
}

export interface AIGeneratedApp {
  appId: string;
  name: string;
  code: string;
  description?: string;
  icon?: string;
  group?: string;
  status: 'DESIGNING' | 'PUBLISHED' | 'OFFLINE';
  moduleCount: number;
  createdAt: string;
  updatedAt: string;
  modules: AIGeneratedModule[];
}
