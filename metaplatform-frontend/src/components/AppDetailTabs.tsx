import { NavLink, useParams } from "react-router-dom";
import { ChevronLeft, Bot, Sparkles } from "lucide-react";
import { OverflowTabs } from "@/components/OverflowTabs";
import { useWorkforce } from "@/hooks/useWorkforce";

const appTabs = [
  { key: "overview", label: "概览" },
  { key: "datamodeling", label: "业务数据建模" },
  { key: "pages", label: "页面" },
  { key: "workflows", label: "流程" },
  { key: "config", label: "应用配置" },
  { key: "publish", label: "应用发布" },
  { key: "export", label: "应用导出" },
];

interface Props {
  /** 数字员工面板是否打开 (由父 layout 控制) */
  workforceOpen: boolean;
  /** 切换数字员工面板的开关 (用于 tab 栏右侧按钮) */
  onToggleWorkforce: () => void;
}

/**
 * 应用详情页的二级 Tab 导航（应用中心用）
 * 使用 OverflowTabs 自适应换行 / 折叠，彻底移除横向滚动条
 * 右侧带"数字员工"入口按钮 (按钮文案显示该应用数字员工的名字),
 * 由父 layout 控制的嵌入式 AppWorkforcePanel 进行 AI 辅助操作.
 */
export function AppDetailTabs({ workforceOpen, onToggleWorkforce }: Props) {
  const { appId } = useParams();
  const { name: wfName } = useWorkforce(appId);
  if (!appId) return null;
  const basePath = `/apps/${appId}`;

  return (
    <div className="border-b bg-background px-4 shrink-0">
      <nav className="flex flex-wrap items-center">
        {/* 返回应用列表 */}
        <NavLink
          to="/apps"
          className="inline-flex h-11 items-center px-2 text-sm font-medium whitespace-nowrap transition-colors text-muted-foreground hover:text-foreground mr-1 self-center"
        >
          <ChevronLeft className="size-4 mr-0.5" />
          应用列表
        </NavLink>
        <div className="w-px h-5 bg-border mx-1 shrink-0 self-center" />
        <OverflowTabs
          tabs={appTabs.map((t) => ({
            key: t.key,
            label: t.label,
            to: `${basePath}/${t.key}`,
          }))}
          overflowThreshold={6}
        />
        {/* 数字员工入口按钮 — 固定在 tab 栏最右侧, 文案显示该应用数字员工的名字 */}
        <div className="ml-auto self-center">
          <button
            type="button"
            onClick={onToggleWorkforce}
            className={
              "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border transition-colors " +
              (workforceOpen
                ? "border-violet-500 bg-primary text-white"
                : "border-violet-300 bg-primary text-violet-700 hover:from-violet-100 hover:to-fuchsia-100 hover:border-violet-400")
            }
            title={`让「${wfName}」帮你修改 / 建模 / 发布`}
          >
            <Bot className="size-3.5" />
            {wfName}
            <Sparkles className="size-3" />
          </button>
        </div>
      </nav>
    </div>
  );
}
