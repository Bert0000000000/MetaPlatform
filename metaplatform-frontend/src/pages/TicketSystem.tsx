import React, { useEffect, useState, useCallback } from "react";
import { listObjectTypes, createObjectInstance, listObjectInstances } from "../api/ontologyApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Circle } from "lucide-react";

interface Ticket {
  id: string;
  fieldValues: Record<string, { value: unknown }>;
  state: string;
  createdAt: string;
}

const TicketSystem: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [objectTypeId, setObjectTypeId] = useState<string>("");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [filterStatus, setFilterStatus] = useState("all");

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const types = await listObjectTypes();
      const ticketType = types.find((t) =>
        t.code === "ticket" || t.code === "工单" || (t.displayName && t.displayName.includes("工单"))
      );
      if (ticketType) {
        setObjectTypeId(ticketType.id);
        const instances = await listObjectInstances(ticketType.id);
        setTickets(instances as unknown as Ticket[]);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const handleCreate = async () => {
    if (!objectTypeId || !newTitle) return;
    try {
      await createObjectInstance(objectTypeId, {
        title: newTitle,
        description: newDesc,
        priority: newPriority,
        status: "open",
      });
      setShowCreate(false);
      setNewTitle("");
      setNewDesc("");
      setNewPriority("medium");
      await loadTickets();
    } catch (e) {
      console.error("Failed to create ticket:", e);
    }
  };

  const getFieldValue = (ticket: Ticket, field: string): string => {
    const fv = ticket.fieldValues?.[field];
    return fv ? String(fv.value ?? "") : "";
  };

  const filtered = filterStatus === "all"
    ? tickets
    : tickets.filter(t => t.state === filterStatus || getFieldValue(t, "status") === filterStatus);

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "open": return "default";
      case "in_progress": return "secondary";
      case "resolved": return "default";
      case "closed": return "outline";
      default: return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "open": return "待处理";
      case "in_progress": return "处理中";
      case "resolved": return "已解决";
      case "closed": return "已关闭";
      default: return status;
    }
  };

  const getPriorityIcon = (p: string) => {
    switch (p) {
      case "high": return <Circle className="size-4 fill-red-500 text-red-500" />;
      case "medium": return <Circle className="size-4 fill-yellow-500 text-yellow-500" />;
      case "low": return <Circle className="size-4 fill-green-500 text-green-500" />;
      default: return <Circle className="size-4" />;
    }
  };

  const FILTER_OPTIONS = [
    { value: "all", label: "全部" },
    { value: "open", label: "待处理" },
    { value: "in_progress", label: "处理中" },
    { value: "resolved", label: "已解决" },
    { value: "closed", label: "已关闭" },
  ];

  const getFilterCount = (s: string) => {
    if (s === "all") return tickets.length;
    return tickets.filter(t => t.state === s || getFieldValue(t, "status") === s).length;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">工单系统</h1>
          <p className="text-sm text-muted-foreground mt-1">创建、跟踪和管理工单</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          + 新建工单
        </Button>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_OPTIONS.map(({ value, label }) => (
          <Button
            key={value}
            variant={filterStatus === value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus(value)}
          >
            {label}
            <Badge variant="secondary" className="ml-1.5">{getFilterCount(value)}</Badge>
          </Button>
        ))}
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          加载中...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          {objectTypeId ? "暂无工单，点击右上角创建" : "未找到工单类型的 ObjectType，请先在建模工场创建"}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(ticket => {
            const status = getFieldValue(ticket, "status") || ticket.state || "open";
            const priority = getFieldValue(ticket, "priority") || "medium";
            return (
              <Card key={ticket.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">#{ticket.id.slice(0, 8)}</span>
                    <Badge variant={getStatusVariant(status)}>{getStatusLabel(status)}</Badge>
                    <span className="ml-auto">{getPriorityIcon(priority)}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="font-medium">
                    {getFieldValue(ticket, "title") || getFieldValue(ticket, "name") || "无标题"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {getFieldValue(ticket, "description") || getFieldValue(ticket, "content") || "无描述"}
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground pt-1">
                    <span>创建时间: {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : "-"}</span>
                    {getFieldValue(ticket, "assignee") && <span>负责人: {getFieldValue(ticket, "assignee")}</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create ticket dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建工单</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>标题 *</Label>
              <Input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="工单标题"
              />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="详细描述..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>优先级</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={newPriority}
                onChange={e => setNewPriority(e.target.value)}
              >
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={!newTitle}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TicketSystem;
