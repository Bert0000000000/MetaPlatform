import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Plus, ChevronDown, ChevronRight, User, Sparkles, Paperclip, Send,
  Copy, RefreshCw, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { SubTabs, FormDrawer } from '@mate/shared';

// MOCK
const conversations = [
  { id: 1, title: '客户数据分析报告', time: '今天 14:32', model: 'GPT-4o' },
  { id: 2, title: '销售预测模型优化方案', time: '今天 11:20', model: 'Claude' },
  { id: 3, title: '客户数据趋势分析', time: '今天 10:15', model: 'GPT-4o' },
  { id: 4, title: '产品需求文档生成', time: '昨天 16:48', model: 'Gemini' },
  { id: 5, title: '技术方案评审讨论', time: '昨天 09:22', model: 'Claude' },
  { id: 6, title: '周报自动生成', time: '7月18日', model: 'GPT-4o' },
  { id: 7, title: '代码审查与重构建议', time: '7月17日', model: 'Claude' },
  { id: 8, title: '竞品分析报告', time: '7月15日', model: 'GPT-4o' },
];

const models = ['GPT-4o', 'Claude', 'Gemini'];

const SUPERAI_TABS = [
  { label: '对话', path: '/superai' },
];

export default function SuperAIPage() {
  const location = useLocation();
  const [temperature, setTemperature] = useState(0.7);
  const [inputText, setInputText] = useState('');
  const [selectedConv, setSelectedConv] = useState(2); // 0-indexed, 3rd item active
  const [selectedModel, setSelectedModel] = useState('GPT-4o');
  const [thinkingExpanded, setThinkingExpanded] = useState<Record<number, boolean>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [inputText]);

  const toggleThinking = (index: number) => {
    setThinkingExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <>
      <style>{`
        .sa-layout { display: flex; min-height: 0; align-self: stretch; }
        .sa-conv-panel { width: 240px; min-width: 240px; background: var(--background); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
        .sa-conv-header { display: flex; align-items: center; justify-content: space-between; padding: 0 20px; border-bottom: 1px solid var(--border); height: 64px; flex-shrink: 0; position: sticky; top: 0; z-index: 30; background: var(--background); }
        .sa-chat-header { display: flex; align-items: center; justify-content: space-between; padding: 0 24px; border-bottom: 1px solid var(--border); height: 64px; flex-shrink: 0; gap: 16px; background: var(--background); position: sticky; top: 0; z-index: 30; }
        .sa-conv-header h2 { font-size: 14px; font-weight: 600; margin: 0; }
        .sa-conv-list { flex: 1; overflow-y: auto; padding: 12px 8px; }
        .sa-conv-item { padding: 10px 12px; border-radius: var(--radius); cursor: pointer; margin-bottom: 2px; transition: background .15s; }
        .sa-conv-item.active { background: var(--muted); }
        .sa-conv-item:hover:not(.active) { background: var(--card); }
        .sa-conv-item-title { font-size: 13px; font-weight: 500; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sa-conv-item-time { font-size: 11px; color: var(--muted-foreground); }
        .sa-conv-item-model { display: inline-block; font-size: 10px; padding: 1px 6px; border-radius: 4px; background: var(--card); border: 1px solid var(--border); color: var(--muted-foreground); margin-top: 4px; }
        .sa-conv-footer { padding: 0 20px; border-top: 1px solid var(--border); height: 64px; display: flex; align-items: center; flex-shrink: 0; position: sticky; bottom: 0; z-index: 30; background: var(--background); }
        .sa-model-dropdown { width: 100%; background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius); color: var(--foreground); font-size: 13px; padding: 8px 10px; outline: none; font-family: var(--font-sans); appearance: none; cursor: pointer; }
        .sa-chat-area { flex: 1; display: flex; flex-direction: column; background: var(--background); min-width: 0; }
        .sa-messages { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 20px; }
        .sa-model-selector { display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .sa-model-selector-label { font-size: 14px; font-weight: 500; }
        .sa-model-selector-badge { font-size: 11px; color: var(--muted-foreground); background: var(--muted); border-radius: 4px; padding: 2px 8px; }
        .sa-temp-control { display: flex; align-items: center; gap: 12px; }
        .sa-temp-label { font-size: 12px; color: var(--muted-foreground); }
        .sa-temp-slider { -webkit-appearance: none; appearance: none; width: 100px; height: 4px; background: var(--border); border-radius: 2px; outline: none; cursor: pointer; }
        .sa-temp-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--foreground); cursor: pointer; }
        .sa-temp-value { font-family: var(--font-mono); font-size: 12px; min-width: 28px; text-align: right; }
        .sa-messages { flex-shrink: 0; padding: 24px; display: flex; flex-direction: column; gap: 20px; }
        .sa-msg-row { display: flex; flex-direction: column; }
        .sa-msg-row.user { align-items: flex-end; }
        .sa-msg-row.ai { align-items: flex-start; }
        .sa-msg-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .sa-msg-avatar { width: 24px; height: 24px; border-radius: 50%; background: var(--muted); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sa-msg-avatar svg { width: 14px; height: 14px; color: var(--muted-foreground); }
        .sa-msg-sender { font-size: 12px; font-weight: 500; color: var(--muted-foreground); }
        .sa-msg-time { font-size: 11px; color: var(--muted-foreground); }
        .sa-msg-bubble { max-width: 680px; padding: 14px 18px; border-radius: var(--radius); font-size: 14px; line-height: 1.7; }
        .sa-msg-row.user .sa-msg-bubble { background: var(--muted); color: var(--foreground); }
        .sa-msg-row.ai .sa-msg-bubble { background: var(--card); color: var(--card-foreground); border: 1px solid var(--border); }
        .sa-thinking-toggle { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted-foreground); cursor: pointer; padding: 8px 0 4px; user-select: none; }
        .sa-thinking-toggle svg { width: 14px; height: 14px; transition: transform 0.2s; }
        .sa-thinking-toggle.expanded svg { transform: rotate(90deg); }
        .sa-thinking-content { font-size: 12px; color: var(--muted-foreground); line-height: 1.6; padding: 8px 0 12px; border-bottom: 1px solid var(--border); margin-bottom: 12px; display: none; }
        .sa-thinking-content.show { display: block; }
        .sa-thinking-indicator { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted-foreground); padding: 8px 0 4px; }
        .sa-thinking-dots span { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--muted-foreground); margin-right: 3px; animation: sa-pulse 1.4s infinite ease-in-out; }
        .sa-thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
        .sa-thinking-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes sa-pulse { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
        .sa-msg-actions { display: flex; align-items: center; gap: 4px; margin-top: 8px; }
        .sa-msg-action { display: flex; align-items: center; gap: 4px; background: transparent; border: none; color: var(--muted-foreground); font-size: 12px; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-family: var(--font-sans); transition: color .15s, background .15s; }
        .sa-msg-action:hover { color: var(--foreground); background: var(--muted); }
        .sa-msg-action svg { width: 14px; height: 14px; }
        .sa-input-bar { position: sticky; bottom: 0; z-index: 5; background: var(--card); border-top: 1px solid var(--border); padding: 16px 24px; display: flex; align-items: center; gap: 12px; }
        .sa-input-wrapper { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .sa-textarea { width: 100%; min-height: 40px; max-height: 160px; resize: none; background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius); color: var(--foreground); font-size: 14px; font-family: var(--font-sans); padding: 10px 14px; outline: none; line-height: 1.5; transition: border-color .15s; }
        .sa-textarea:focus { border-color: var(--foreground); }
        .sa-textarea::placeholder { color: var(--muted-foreground); }

        .sa-btn-icon { background: transparent; color: var(--muted-foreground); border: 1px solid var(--border); border-radius: var(--radius); height: 40px; width: 40px; padding: 0; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: background .15s, color .15s; flex-shrink: 0; }
        .sa-btn-icon:hover { background: var(--muted); color: var(--foreground); }
        .sa-btn-icon svg { width: 16px; height: 16px; }
        .sa-btn-send { background: var(--primary); color: var(--primary-foreground); border: none; border-radius: var(--radius); height: 40px; width: 40px; padding: 0; cursor: pointer; font-family: var(--font-sans); display: inline-flex; align-items: center; justify-content: center; transition: opacity .15s; flex-shrink: 0; }
        .sa-btn-send:hover { opacity: 0.9; }
        .sa-btn-send svg { width: 16px; height: 16px; }
      `}</style>
      <div className="sa-layout" style={{ minHeight: 0, height: '100vh', flex: 'none' }}>
        {/* Conversation Panel */}
        <div className="sa-conv-panel">
          <div className="sa-conv-header">
            <h2>会话</h2>
            <button className="v-btn" style={{ height: 32, padding: '0 12px', fontSize: 12, gap: 4, display: 'inline-flex', alignItems: 'center' }} onClick={() => { setInputText(''); setSelectedConv(-1); setThinkingExpanded({}); }}>
              <Plus style={{ width: 14, height: 14 }} />新建
            </button>
          </div>
          <div className="sa-conv-list">
            {conversations.map((conv, idx) => (
              <div
                key={conv.id}
                className={`sa-conv-item${idx === selectedConv ? ' active' : ''}`}
                onClick={() => setSelectedConv(idx)}
              >
                <div className="sa-conv-item-title">{conv.title}</div>
                <div className="sa-conv-item-time">{conv.time}</div>
                <div className="sa-conv-item-model">{conv.model}</div>
              </div>
            ))}
          </div>
          <div className="sa-conv-footer">
            <select
              className="sa-model-dropdown"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {models.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Chat Area */}
        <div className="sa-chat-area">
          {/* Header: SubTabs + 模型选择 + 温度控制 */}
          <div className="sa-chat-header">
            <SubTabs items={SUPERAI_TABS} activePath={location.pathname} embedded />
            <div className="sa-temp-control" style={{ flexShrink: 0 }}>
              <span className="sa-temp-label">Temperature</span>
              <input
                type="range"
                className="sa-temp-slider"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
              />
              <span className="sa-temp-value">{temperature.toFixed(1)}</span>
            </div>
          </div>

          {/* Messages */}
          <div className="sa-messages">
            {/* Msg 1: User */}
            <div className="sa-msg-row user">
              <div className="sa-msg-header">
                <div className="sa-msg-avatar"><User /></div>
                <span className="sa-msg-sender">Admin</span>
                <span className="sa-msg-time">10:15</span>
              </div>
              <div className="sa-msg-bubble">请帮我分析一下上季度的客户数据趋势</div>
            </div>

            {/* Msg 2: AI */}
            <div className="sa-msg-row ai">
              <div className="sa-msg-header">
                <div className="sa-msg-avatar"><Sparkles /></div>
                <span className="sa-msg-sender">GPT-4o</span>
                <span className="sa-msg-time">10:15</span>
              </div>
              <div className="sa-msg-bubble">
                <div
                  className={`sa-thinking-toggle${thinkingExpanded[1] ? ' expanded' : ''}`}
                  onClick={() => toggleThinking(1)}
                >
                  <ChevronRight />
                  <span>思考过程</span>
                  <span style={{ marginLeft: 'auto' }}>8s</span>
                </div>
                <div className={`sa-thinking-content${thinkingExpanded[1] ? ' show' : ''}`}>
                  用户请求分析上季度客户数据趋势。需要从 Ontology 引擎获取客户实体数据，包括客户数量变化、活跃度、转化率等指标。结合时间序列数据，识别关键趋势节点和异常波动。
                </div>
                好的，我来为你分析上季度的客户数据趋势。根据 Ontology 引擎中的客户数据模型，我梳理了以下几个关键维度：
                <br /><br />
                <strong>1. 客户总量增长</strong><br />
                上季度末客户总数达到 12,847，环比增长 8.3%，其中新客获取 1,204 人，高于预期目标 15%。
                <br /><br />
                <strong>2. 活跃客户占比</strong><br />
                月活跃客户（MAU）稳定在 68%-72% 区间，较上季度提升 3.2 个百分点。
                <div className="sa-msg-actions">
                  <button className="sa-msg-action"><Copy />复制</button>
                  <button className="sa-msg-action"><RefreshCw />重新生成</button>
                  <button className="sa-msg-action"><ThumbsUp /></button>
                  <button className="sa-msg-action"><ThumbsDown /></button>
                </div>
              </div>
            </div>

            {/* Msg 3: User */}
            <div className="sa-msg-row user">
              <div className="sa-msg-header">
                <div className="sa-msg-avatar"><User /></div>
                <span className="sa-msg-sender">Admin</span>
                <span className="sa-msg-time">10:22</span>
              </div>
              <div className="sa-msg-bubble">重点关注新客户转化率的变化</div>
            </div>

            {/* Msg 4: AI */}
            <div className="sa-msg-row ai">
              <div className="sa-msg-header">
                <div className="sa-msg-avatar"><Sparkles /></div>
                <span className="sa-msg-sender">GPT-4o</span>
                <span className="sa-msg-time">10:22</span>
              </div>
              <div className="sa-msg-bubble">
                <div
                  className={`sa-thinking-toggle${thinkingExpanded[2] ? ' expanded' : ''}`}
                  onClick={() => toggleThinking(2)}
                >
                  <ChevronRight />
                  <span>思考过程</span>
                  <span style={{ marginLeft: 'auto' }}>12s</span>
                </div>
                <div className={`sa-thinking-content${thinkingExpanded[2] ? ' show' : ''}`}>
                  深入拆解新客户转化漏斗，需要从试用转付费环节定位核心问题。关联分析试用用户行为路径数据，识别流失节点。
                </div>
                关于新客户转化率，我进一步拆解了转化漏斗数据：
                <br /><br />
                <strong>新客户转化漏斗分析</strong>
                <br /><br />
                注册 → 激活：<strong>78.4%</strong>（环比 +2.1%）<br />
                激活 → 试用：<strong>52.7%</strong>（环比 -0.8%）<br />
                试用 → 付费：<strong>31.2%</strong>（环比 -3.6%）
                <br /><br />
                核心问题出现在「试用转付费」环节。建议下一步调取试用用户操作日志，通过行为路径分析定位流失节点。
                <div className="sa-msg-actions">
                  <button className="sa-msg-action"><Copy />复制</button>
                  <button className="sa-msg-action"><RefreshCw />重新生成</button>
                  <button className="sa-msg-action"><ThumbsUp /></button>
                  <button className="sa-msg-action"><ThumbsDown /></button>
                </div>
              </div>
            </div>

            {/* Msg 5: User */}
            <div className="sa-msg-row user">
              <div className="sa-msg-header">
                <div className="sa-msg-avatar"><User /></div>
                <span className="sa-msg-sender">Admin</span>
                <span className="sa-msg-time">10:30</span>
              </div>
              <div className="sa-msg-bubble">帮我把这些数据整理成一份报告，用 Markdown 格式输出</div>
            </div>

            {/* Msg 6: AI (latest - thinking indicator) */}
            <div className="sa-msg-row ai">
              <div className="sa-msg-header">
                <div className="sa-msg-avatar"><Sparkles /></div>
                <span className="sa-msg-sender">GPT-4o</span>
                <span className="sa-msg-time">10:30</span>
              </div>
              <div className="sa-msg-bubble">
                <div className="sa-thinking-indicator">
                  <div className="sa-thinking-dots"><span /><span /><span /></div>
                  <span>正在思考...</span>
                </div>
                <div
                  className={`sa-thinking-toggle${thinkingExpanded[3] ? ' expanded' : ''}`}
                  onClick={() => toggleThinking(3)}
                >
                  <ChevronRight />
                  <span>思考过程</span>
                  <span style={{ marginLeft: 'auto' }}>进行中</span>
                </div>
                <div className={`sa-thinking-content${thinkingExpanded[3] ? ' show' : ''}`}>
                  正在整理数据报告结构，规划 Markdown 章节布局...
                </div>
                好的，正在为你生成 Markdown 格式的客户数据分析报告。报告将包含以下章节：
                <br /><br />
                1. 概述与核心发现<br />
                2. 客户增长趋势<br />
                3. 活跃度分析<br />
                4. 转化漏斗深度拆解<br />
                5. 关键风险与建议<br />
                <br />
                <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>正在生成完整内容...</span>
                <div className="sa-msg-actions">
                  <button className="sa-msg-action"><Copy />复制</button>
                  <button className="sa-msg-action"><RefreshCw />重新生成</button>
                  <button className="sa-msg-action"><ThumbsUp /></button>
                  <button className="sa-msg-action"><ThumbsDown /></button>
                </div>
              </div>
            </div>
          </div>

          {/* Input Bar */}
          <div className="sa-input-bar">
            <button className="sa-btn-icon"><Paperclip /></button>
            <div className="sa-input-wrapper">
              <textarea
                ref={textareaRef}
                className="sa-textarea"
                rows={1}
                placeholder="输入消息，Enter 发送，Shift + Enter 换行..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </div>
            <button className="sa-btn-send"><Send /></button>
          </div>
        </div>
      </div>

      <FormDrawer open={drawerOpen} title="新建会话" onCancel={() => setDrawerOpen(false)} onOk={() => setDrawerOpen(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6 }}>会话标题</span>
            <input type="text" placeholder="请输入会话标题" style={{ width: '100%', height: 36, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }} />
          </label>
          <label>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6 }}>模型</span>
            <select style={{ width: '100%', height: 36, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }}>
              <option>GPT-4o</option>
              <option>Claude</option>
              <option>Gemini</option>
            </select>
          </label>
          <label>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6 }}>描述</span>
            <textarea placeholder="请输入会话描述（可选）" rows={3} style={{ width: '100%', minHeight: 80, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, fontSize: 13, color: 'var(--foreground)', outline: 'none', resize: 'vertical' }} />
          </label>
        </div>
      </FormDrawer>
    </>
  );
}
