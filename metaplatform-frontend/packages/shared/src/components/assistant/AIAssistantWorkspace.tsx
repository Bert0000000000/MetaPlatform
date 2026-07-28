import type { PropsWithChildren } from 'react';
import AIAssistantPanel from './AIAssistantPanel';
import type { PageAssistantController } from './types';

export interface AIAssistantWorkspaceProps {
  assistant: PageAssistantController;
}

export default function AIAssistantWorkspace({
  assistant,
  children,
}: PropsWithChildren<AIAssistantWorkspaceProps>) {
  return (
    <div className={`ai-assistant-workspace${assistant.isOpen ? ' ai-assistant-workspace--open' : ''}`}>
      <div className="ai-assistant-workspace__content" data-testid="assistant-page-content">
        {children}
      </div>
      <div className="ai-assistant-workspace__aside" aria-hidden={!assistant.isOpen}>
        <AIAssistantPanel assistant={assistant} />
      </div>
    </div>
  );
}