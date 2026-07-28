import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Bot, Send, Sparkles, Trash2, X } from 'lucide-react';
import type { PageAssistantController } from './types';

export interface AIAssistantPanelProps {
  assistant: PageAssistantController;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export default function AIAssistantPanel({ assistant }: AIAssistantPanelProps) {
  const [draft, setDraft] = useState('');
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [assistant.messages.length, assistant.isThinking]);

  const submit = () => {
    const content = draft.trim();
    if (!content || assistant.isThinking) return;
    assistant.sendMessage(content);
    setDraft('');
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const isEmpty = assistant.messages.length === 0;

  return (
    <aside
      id="page-ai-assistant"
      className="ai-assistant-panel"
      data-testid="ai-assistant-panel"
      data-employee-id={assistant.employeeId}
      data-session-id={assistant.sessionId}
      aria-label={`${assistant.employeeName}聊天区域`}
    >
      <header className="ai-assistant-panel__header">
        <div className="ai-assistant-panel__identity">
          <span className="ai-assistant-panel__avatar" aria-hidden="true">
            {assistant.employeeAvatar ?? <Bot />}
          </span>
          <span className="ai-assistant-panel__identity-copy">
            <strong>{assistant.employeeName}</strong>
            <span className="ai-assistant-panel__status"><i />在线 · {assistant.moduleLabel}</span>
          </span>
        </div>
        <div className="ai-assistant-panel__actions">
          <button type="button" onClick={assistant.clearSession} aria-label="清空会话" title="清空会话">
            <Trash2 aria-hidden="true" />
          </button>
          <button type="button" onClick={assistant.close} aria-label="关闭 AI 助手" title="关闭 AI 助手">
            <X aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="ai-assistant-panel__messages" aria-live="polite">
        {isEmpty && (
          <section className="ai-assistant-welcome">
            <span className="ai-assistant-welcome__icon" aria-hidden="true"><Sparkles /></span>
            <h2>{assistant.welcomeMessage}</h2>
            <p>{assistant.employeeDescription}</p>
            <div className="ai-assistant-suggestions" aria-label="推荐问题">
              {assistant.suggestions.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  onClick={() => assistant.sendMessage(suggestion)}
                  disabled={assistant.isThinking}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </section>
        )}

        {assistant.messages.map((message) => (
          <article
            key={message.id}
            className={`ai-assistant-message ai-assistant-message--${message.role}`}
            data-testid={`assistant-message-${message.role}`}
          >
            <div className="ai-assistant-message__bubble">{message.content}</div>
            <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
          </article>
        ))}

        {assistant.isThinking && (
          <div className="ai-assistant-thinking" role="status">
            <span className="ai-assistant-thinking__dots" aria-hidden="true"><i /><i /><i /></span>
            正在思考
          </div>
        )}
        <div ref={messageEndRef} />
      </div>

      <form className="ai-assistant-composer" onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入问题，Enter 发送"
          aria-label={`向${assistant.employeeName}发送消息`}
          rows={3}
        />
        <div className="ai-assistant-composer__footer">
          <span>Shift + Enter 换行</span>
          <button
            type="submit"
            className="ai-assistant-composer__send"
            disabled={!draft.trim() || assistant.isThinking}
            aria-label="发送消息"
          >
            <Send aria-hidden="true" />
          </button>
        </div>
      </form>
    </aside>
  );
}