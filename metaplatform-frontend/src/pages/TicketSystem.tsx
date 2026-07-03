import React, { useEffect, useState, useCallback } from "react";
import { listObjectTypes, createObjectInstance, listObjectInstances } from "../api/ontologyApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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
      case "open": return "\u5F85\u5904\u7406";
      case "in_progress": return "\u5904\u7406\u4E2D";
      case "resolved": return "\u5DF2\u89E3\u51B3";
      case "closed": return "\u5DF2\u5173\u95ED";
      default: return status;
    }
  };

  const getPriorityIcon = (p: string) => {
    switch (p) {
      case "high": return "\u{1F534}";
      case "medium": return "\u{1F7E1}";
      case "low": return "\u{1F7E2}";
      default: return "\u26AA";
    }
  };

  const FILTER_OPTIONS = [
    { value: "all", label: "\u5168\u90E8" },
    { value: "open", label: "\u5F85\u5904\u7406" },
    { value: "in_progress", label: "\u5904\u7406\u4E2D" },
    { value: "resolved", label: "\u5DF2\u89E3\u51B3" },
    { value: "closed", label: "\u5DF2\u5173\u95ED" },
  ];

  const getFilterCount = (s: string) => {
    if (s === "all") return tickets.length;
    return tickets.filter(t => t.state === s || getFieldValue(t, "status") === s).length;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">\u5DE5\u5355\u7CFB\u7EDF</h1>
          <p className="text-sm text-muted-foreground mt-1">\u521B\u5EFA\u3001\u8DDF\u8E2A\u548C\u7BA1\u7406\u5DE5\u5355</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          + \u65B0\u5EFA\u5DE5\u5355
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
          \u52A0\u8F7D\u4E2D...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          {objectTypeId ? "\u6682\u65E0\u5DE5\u5355\uFF0C\u70B9\u51FB\u53F3\u4E0A\u89D2\u521B\u5EFA" : "\u672A\u627E\u5230\u5DE5\u5355\u7C7B\u578B\u7684 ObjectType\uFF0C\u8BF7\u5148\u5728\u5EFA\u6A21\u5DE5\u573A\u521B\u5EFA"}
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
                    {getFieldValue(ticket, "title") || getFieldValue(ticket, "name") || "\u65E0\u6807\u9898"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {getFieldValue(ticket, "description") || getFieldValue(ticket, "content") || "\u65E0\u63CF\u8FF0"}
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground pt-1">
                    <span>\u521B\u5EFA\u65F6\u95F4: {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : "-"}</span>
                    {getFieldValue(ticket, "assignee") && <span>\u8D1F\u8D23\u4EBA: {getFieldValue(ticket, "assignee")}</span>}
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
            <DialogTitle>\u65B0\u5EFA\u5DE5\u5355</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>\u6807\u9898 *</Label>
              <Input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="\u5DE5\u5355\u6807\u9898"
              />
            </div>
            <div className="space-y-2">
              <Label>\u63CF\u8FF0</Label>
              <Textarea
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="\u8BE6\u7EC6\u63CF\u8FF0..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>\u4F18\u5148\u7EA7</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={newPriority}
                onChange={e => setNewPriority(e.target.value)}
              >
                <option value="high">{"\u{1F534} \u9AD8"}</option>
                <option value="medium">{"\u{1F7E1} \u4E2D"}</option>
                <option value="low">{"\u{1F7E2} \u4F4E"}</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>\u53D6\u6D88</Button>
            <Button onClick={handleCreate} disabled={!newTitle}>\u521B\u5EFA</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TicketSystem;
