import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { EditOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  listConfigCategories,
  listConfigs,
  updateConfig,
} from "@/api/admin/configs";
import type { AdminSystemConfig, ConfigCategory } from "@/types";
import { AdminLayout } from "./__AdminLayout";
import { formatDateTime } from "@/utils/datetime";
import { useSettings } from "@/contexts/SettingsContext";

const CATEGORY_LABEL: Record<ConfigCategory, string> = {
  SSO: "SSO 单点登录",
  LICENSE: "License",
  MESSAGE: "消息渠道",
  RATE_LIMIT: "限流",
  SECURITY: "安全",
  BRANDING: "品牌",
  OTHER: "其他",
};

const CATEGORY_COLOR: Record<ConfigCategory, string> = {
  SSO: "geekblue",
  LICENSE: "gold",
  MESSAGE: "purple",
  RATE_LIMIT: "orange",
  SECURITY: "red",
  BRANDING: "cyan",
  OTHER: "default",
};

export default function ConfigsPage() {
  const { settings } = useSettings();
  const [items, setItems] = useState<AdminSystemConfig[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [category, setCategory] = useState<ConfigCategory | undefined>();
  const [keyword, setKeyword] = useState("");
  const [editTarget, setEditTarget] = useState<AdminSystemConfig | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [categories, setCategories] = useState<{ value: string; count: number }[]>([]);
  const [editForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await listConfigs({
        category,
        keyword: keyword || undefined,
        page,
        pageSize,
      });
      setItems(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      setCategories(await listConfigCategories());
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, category]);

  const renderValue = (cfg: AdminSystemConfig) => {
    if (cfg.isSensitive) return <span style={{ fontFamily: "var(--font-mono)" }}>****</span>;
    switch (cfg.valueType) {
      case "bool":
        return <Tag color={cfg.value ? "success" : "default"}>{cfg.value ? "true" : "false"}</Tag>;
      case "int":
        return <span style={{ fontFamily: "var(--font-mono)" }}>{String(cfg.value ?? "")}</span>;
      case "enum":
        return <Tag color="blue">{String(cfg.value ?? "")}</Tag>;
      case "json":
        return (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted-foreground)" }}>
            {typeof cfg.value === "object" ? "{...}" : String(cfg.value ?? "")}
          </span>
        );
      default:
        return <span>{String(cfg.value ?? "")}</span>;
    }
  };

  const openEdit = (cfg: AdminSystemConfig) => {
    setEditTarget(cfg);
    editForm.setFieldsValue({
      value: cfg.value ?? "",
      note: "",
    });
    setEditOpen(true);
  };

  const submit = async () => {
    if (!editTarget) return;
    const v = await editForm.validateFields();
    try {
      let payload = v.value;
      if (editTarget.valueType === "json" && typeof v.value === "string") {
        try {
          payload = JSON.parse(v.value);
        } catch {
          message.error("JSON 格式不合法");
          return;
        }
      }
      await updateConfig(editTarget.key, payload, v.note);
      message.success("已更新");
      setEditOpen(false);
      load();
    } catch {
      /* ignore */
    }
  };

  const columns: ColumnsType<AdminSystemConfig> = useMemo(
    () => [
      { title: "Key", dataIndex: "key", render: (v: string) => (<span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{v}</span>) },
      { title: "名称", dataIndex: "label" },
      { title: "分类", dataIndex: "category", render: (v: ConfigCategory) => (<Tag color={CATEGORY_COLOR[v]}>{CATEGORY_LABEL[v] ?? v}</Tag>) },
      { title: "当前值", key: "value", render: (_v, r) => renderValue(r) },
      { title: "类型", dataIndex: "valueType", render: (v: string) => <Tag>{v}</Tag> },
      { title: "敏感", dataIndex: "isSensitive", render: (v: boolean) => (v ? <Tag color="red">是</Tag> : <Tag>否</Tag>) },
      { title: "更新时间", dataIndex: "updatedAt", render: (v: string) => (<span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{formatDateTime(v, settings)}</span>) },
      { title: "更新人", dataIndex: "updatedBy", render: (v?: string) => v ?? "-" },
      { title: "操作", key: "actions", width: 100, render: (_v, r) => (<Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>) },
    ],
    [settings],
  );

  const renderValueInput = () => {
    if (!editTarget) return null;
    const t = editTarget.valueType;
    if (t === "bool") {
      return <Form.Item name="value" label="值" valuePropName="checked"><Switch /></Form.Item>;
    }
    if (t === "int") {
      return <Form.Item name="value" label="值" rules={[{ required: true }]}><InputNumber style={{ width: "100%" }} /></Form.Item>;
    }
    if (t === "enum") {
      return <Form.Item name="value" label="值" rules={[{ required: true }]}><Select options={editTarget.enumOptions.map((o) => ({ value: o, label: o }))} /></Form.Item>;
    }
    if (t === "json") {
      return <Form.Item name="value" label="值 (JSON)" rules={[{ required: true }]}><Input.TextArea autoSize={{ minRows: 4 }} placeholder='{"key": "value"}' /></Form.Item>;
    }
    return <Form.Item name="value" label="值" rules={[{ required: true }]}><Input.Password placeholder={editTarget.isSensitive ? "敏感字段，输入新值" : ""} /></Form.Item>;
  };

  return (
    <AdminLayout
      title="系统配置"
      extra={<Space><Button icon={<ReloadOutlined />} onClick={load}>刷新</Button></Space>}
    >
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: 16, marginBottom: 12, display: "flex", gap: 8 }}>
        <Input.Search placeholder="搜索 Key" allowClear value={keyword} onChange={(e) => setKeyword(e.target.value)} onSearch={() => { setPage(1); load(); }} style={{ maxWidth: 280 }} />
        <Select placeholder="分类" value={category} onChange={(v) => { setCategory(v); setPage(1); }} allowClear style={{ width: 200 }} options={categories.map((c) => ({ value: c.value, label: (CATEGORY_LABEL[c.value as ConfigCategory] ?? c.value) + " (" + c.count + ")" }))} />
      </div>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={items} pagination={{ current: page, pageSize, total, showSizeChanger: true, onChange: (p, ps) => { setPage(p); setPageSize(ps); } }} size="middle" />
      </div>
      <Drawer
        title={editTarget ? "编辑配置 - " + editTarget.key : ""}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        width={520}
        extra={<Space><Button onClick={() => setEditOpen(false)}>取消</Button><Button type="primary" onClick={submit}>保存</Button></Space>}
      >
        {editTarget && (
          <Form form={editForm} layout="vertical" preserve={false}>
            <Form.Item label="Key"><Input value={editTarget.key} disabled /></Form.Item>
            <Form.Item label="名称"><Input value={editTarget.label ?? ""} disabled /></Form.Item>
            <Form.Item label="分类"><Tag color={CATEGORY_COLOR[editTarget.category]}>{CATEGORY_LABEL[editTarget.category] ?? editTarget.category}</Tag></Form.Item>
            {renderValueInput()}
            <Form.Item name="note" label="变更原因（写入审计日志）"><Input.TextArea autoSize={{ minRows: 2 }} placeholder="说明本次变更的背景" /></Form.Item>
          </Form>
        )}
      </Drawer>
    </AdminLayout>
  );
}