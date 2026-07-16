/**
 * AppWorkforceManager — 数字员工模块管理页 (Per-App 数字员工人设)
 * --------------------------------------------------------------------------
 * 列出当前账号下所有应用, 每个应用显示该应用"专属数字员工"的人设:
 *   - 名字 (可点击重命名, 默认按 appId 哈希 派生出 应小帅/慧/美/强/灵/樱)
 *   - 角色 (可编辑, 默认"应用助手")
 *   - 头像 (6 种预设渐变色, 按 appId 哈希稳定分配, 可换)
 *
 * 由于不同应用有不同的业务属性 (CRM / OA / ERP / AI / 数字员工 ...),
 * 数字员工本身就是"按应用独立"的, 不再做"统一应用到全部"批量操作.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot, Pencil, Check, ChevronRight,
} from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { appsApi, type Application } from "@/lib/api";
import {
  useWorkforce, WORKFORCE_AVATARS,
  type WorkforceAvatarKey,
} from "@/hooks/useWorkforce";

export function AppWorkforceManager() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<Application[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appIdFilter, setAppIdFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const data = await appsApi.list();
        if (!cancel) setApps(data ?? []);
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : "加载应用列表失败");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const filtered = (apps ?? []).filter(a =>
    !appIdFilter.trim() || (a.name || "").toLowerCase().includes(appIdFilter.trim().toLowerCase())
  );

  if (loading) return <div className="text-center py-8 text-muted-foreground">加载中...</div>;
  if (error) return <div className="text-center py-8 text-destructive">{error}</div>;
  if (!apps || apps.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Bot className="size-12 mx-auto mb-3 opacity-30" />
          <p>暂无应用, 无法管理数字员工</p>
          <p className="text-xs mt-2">先去应用中心创建一个应用, 再回到此页面为它设置专属数字员工</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 列表区 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-1.5">
              <Bot className="size-4" /> 应用数字员工 ({filtered.length} / {apps.length})
            </CardTitle>
            <CardDescription>
              每个应用拥有 1 位专属数字员工 (默认名字: 应小帅/慧/美/强/灵/樱, 按 appId 哈希),
              进入应用后可与它对话完成各种操作
            </CardDescription>
          </div>
          <Input
            value={appIdFilter}
            onChange={(e) => setAppIdFilter(e.target.value)}
            placeholder="搜索应用名"
            className="max-w-[240px] h-8"
          />
        </CardHeader>
        <CardContent className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">没有匹配的应用</div>
          ) : filtered.map(a => (
            <AppWorkforceRow
              key={a.id}
              app={a}
              isEditing={editingId === a.id}
              onStartEdit={() => setEditingId(a.id)}
              onCancelEdit={() => setEditingId(null)}
              onJump={() => navigate(`/apps/${a.id}/overview`)}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── 单行: 每个应用一行, 内嵌 useWorkforce ── */
function AppWorkforceRow({ app, isEditing, onStartEdit, onCancelEdit, onJump }: {
  app: Application;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onJump: () => void;
}) {
  const { name, avatarMeta, avatar, role, setName, setAvatar, setRole } = useWorkforce(app.id);
  const [localName, setLocalName] = useState(name);
  useEffect(() => setLocalName(name), [name]);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border hover:border-violet-300 hover:bg-primary/40 transition-colors">
      {/* 头像 */}
      <div className={`size-10 rounded-full bg-primary ${avatarMeta.gradient} flex items-center justify-center text-white font-bold shrink-0`}>
        {avatarMeta.preview(name)}
      </div>

      {/* 名字 + 角色 */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <form
            onSubmit={(e) => { e.preventDefault(); if (localName.trim()) setName(localName); onCancelEdit(); }}
            className="flex items-center gap-2"
          >
            <Input
              autoFocus
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") onCancelEdit(); }}
              maxLength={16}
              className="h-7 text-sm max-w-[160px]"
            />
            <Button type="submit" size="icon" variant="ghost" className="size-7"><Check className="size-3.5" /></Button>
            <Button type="button" size="sm" variant="ghost" onClick={onCancelEdit}>取消</Button>
          </form>
        ) : (
          <button type="button" className="flex items-center gap-1.5 group" onClick={onStartEdit}>
            <span className="text-sm font-semibold truncate max-w-[200px]">{name}</span>
            <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            <Badge variant="outline" className="text-xs border-violet-300 text-violet-700">AI</Badge>
          </button>
        )}
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate max-w-[160px]">{app.name}</span>
          <span>·</span>
          {isEditing ? (
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="角色"
              maxLength={32}
              className="h-6 text-xs px-1.5 max-w-[140px]"
            />
          ) : (
            <span className="truncate">{role}</span>
          )}
        </div>
      </div>

      {/* 头像切换 (always visible) */}
      <div className="flex gap-1 shrink-0">
        {(Object.keys(WORKFORCE_AVATARS) as WorkforceAvatarKey[]).map(k => {
          const m = WORKFORCE_AVATARS[k];
          return (
            <button
              key={k}
              type="button"
              onClick={() => setAvatar(k)}
              className={
                "size-6 rounded-full bg-primary " + m.gradient +
                (avatar === k ? " ring-2 ring-offset-1 ring-violet-500" : " opacity-60 hover:opacity-100")
              }
              title={k}
            />
          );
        })}
      </div>

      {/* 进入应用 */}
      <Button variant="ghost" size="sm" onClick={onJump} className="text-violet-600 gap-1 shrink-0">
        进入 <ChevronRight className="size-3.5" />
      </Button>
    </div>
  );
}
