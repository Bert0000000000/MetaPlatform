import { Outlet } from 'react-router-dom';
import { AIAssistantTrigger, AIAssistantWorkspace, usePageAssistant } from '@mate/shared';
import './ki.css';

/**
 * 知识与集成域壳：把「AI 助手」挂在域内 4 个主 tab（知识库 / MCP 工具 / A2A /
 * 检索测试）之上。
 *
 * 为什么不复用 KnowledgeLayout / McpCenterLayout：那两个是过渡期的域内 shell，
 * 各自渲染一层 tab（与壳的 PageTabs 重复）。P2b 把 tab 交回壳（domains.tsx 的 ki
 * 配置），这里只保留助手面板与浮动入口。
 */
export default function KiDomainShell() {
  const assistant = usePageAssistant({
    employeeId: 'knowledge-governor',
    employeeName: '知识治理数字员工',
    employeeDescription: '帮助你管理知识库、MCP 工具接入与检索质量',
    moduleLabel: 'Knowledge & Integrations',
    welcomeMessage: '你好，我是知识治理数字员工。可以协助你维护知识资产、治理 MCP 工具与连接。',
    suggestions: ['检查知识库索引状态', '分析最近的检索质量', '哪些 MCP 连接异常'],
  });

  return (
    <div className="mp-ki-shell">
      <AIAssistantWorkspace assistant={assistant}>
        <div className="mp-ki-shell-main">
          <Outlet />
        </div>
      </AIAssistantWorkspace>

      <div className="mp-ki-ai-dock">
        <AIAssistantTrigger open={assistant.isOpen} onClick={assistant.toggle} />
      </div>
    </div>
  );
}
