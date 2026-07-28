import { ChevronDown } from 'lucide-react';

export interface AIAssistantTriggerProps {
  open: boolean;
  onClick: () => void;
}

export default function AIAssistantTrigger({ open, onClick }: AIAssistantTriggerProps) {
  return (
    <button
      type="button"
      className={`v-btn ai-assistant-trigger${open ? ' ai-assistant-trigger--active' : ''}`}
      onClick={onClick}
      aria-label="AI 助手"
      aria-expanded={open}
      aria-controls="page-ai-assistant"
    >
      <span className="ai-assistant-trigger__avatar" aria-hidden="true">AI</span>
      <span>AI 助手</span>
      <ChevronDown className={`ai-assistant-trigger__chevron${open ? ' ai-assistant-trigger__chevron--open' : ''}`} aria-hidden="true" />
    </button>
  );
}