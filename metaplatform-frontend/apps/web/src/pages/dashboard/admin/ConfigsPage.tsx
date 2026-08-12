import { useEffect, useMemo, useState } from "react";
import {
  Button,
  SideSheet,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tag,
  Toast,
} from "@douyinfe/semi-ui";
import type { TagColor } from "@douyinfe/semi-ui/lib/es/tag";
import type { ColumnProps } from "@douyinfe/semi-ui/lib/es/table";
import { EditOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import {
  listConfigCategories,
  listConfigs,
  updateConfig,
} from "@/api/admin/configs";
import type { AdminSystemConfig, ConfigCategory } from "@/types";
import { AdminLayout, StatCard, StatGrid } from "./__AdminLayout";
import { formatDateTime } from "@/utils/datetime";
import { useSettings } from "@/contexts/SettingsContext";

const CATEGORY_LABEL: Record<ConfigCategory, string> = {
  SSO: "SSO 单点登录",
  LICENSE: "License",
  MESSAGE: "消息渠道",
  RATE_LIMIT: "限流",
  SECURITY: "安全",
  BRANDING: "品牌",
  AI_PROVIDER: "AI 提供方",
  OTHER: "其他",
};

const CATEGORY_COLOR: Record<ConfigCategory, TagColor> = {
  SSO: "indigo",
  LICENSE: "yellow",
  MESSAGE: "purple",
  RATE_LIMIT: "orange",
  SECURITY: "red",
  BRANDING: "cyan",
  AI_PROVIDER: "pink",
  OTHER: "grey",
};

// 轻量搜索框（antd Input.Search 无 Semi 等价物：Enter 或点击放大镜触发）
function SearchInput({
  value,
  onChange,
  onSearch,
  placeholder,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  onSearch: () => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Input
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onEnterPress={() => onSearch()}
      showClear
      suffix={<SearchOutlined style={{ cursor: "pointer" }} onClick={() => onSearch()} />}
      style={{ maxWidth: 280, ...style }}
    />
  );
}

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
      setItems(res.items ?? []);
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
        return <Tag color={cfg.value ? "green" : "grey"}>{cfg.value ? "true" : "false"}</Tag>;
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
    editForm.setValues({
      value: cfg.value ?? "",
      note: "",
    });
    setEditOpen(true);
  };

  const submit = async () => {
    if (!editTarget) return;
    const v = await editForm.validate();
    try {
      let payload = v.value;
      if (editTarget.valueType === "json" && typeof v.value === "string") {
        try {
          payload = JSON.parse(v.value);
        } catch {
          Toast.error("JSON 格式不合法");
          return;
        }
      }
      await updateConfig(editTarget.key, payload, v.note);
      Toast.success("已更新");
      setEditOpen(false);
      load();
    } catch {
      /* ignore */
    }
  };

  const columns: ColumnProps<AdminSystemConfig>[] = useMemo(
    () => [
      { title: "Key", dataIndex: "key", render: (v: string) => (<span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{v}</span>) },
      { title: "名称", dataIndex: "label" },
      { title: "分类", dataIndex: "category", render: (v: ConfigCategory) => (<Tag color={CATEGORY_COLOR[v]}>{CATEGORY_LABEL[v] ?? v}</Tag>) },
      { title: "当前值", key: "value", render: (_v, r) => renderValue(r) },
      { title: "类型", dataIndex: "valueType", render: (v: string) => <Tag>{v}</Tag> },
      { title: "敏感", dataIndex: "isSensitive", render: (v: boolean) => (v ? <Tag color="red">是</Tag> : <Tag>否</Tag>) },
      { title: "更新时间", dataIndex: "updatedAt", render: (v: string) => (<span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{formatDateTime(v, settings)}</span>) },
      { title: "更新人", dataIndex: "updatedBy", render: (v?: string) => v ?? "-" },
      { title: "操作", key: "actions", width: 100, render: (_v, r) => (<Button theme="borderless" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>) },
    ],
    [settings],
  );

  const renderValueInput = () => {
    if (!editTarget) return null;
    const t = editTarget.valueType;
    if (t === "bool") {
      return <Form.Switch field="value" label="值" />;
    }
    if (t === "int") {
      return <Form.InputNumber field="value" label="值" rules={[{ required: true }]} style={{ width: "100%" }} />;
    }
    if (t === "enum") {
      return <Form.Select field="value" label="值" rules={[{ required: true }]} optionList={editTarget.enumOptions.map((o) => ({ value: o, label: o }))} />;
    }
    if (t === "json") {
      return <Form.TextArea field="value" label="值 (JSON)" rules={[{ required: true }]} autosize={{ minRows: 4 }} placeholder='{"key": "value"}' />;
    }
    return <Form.Input field="value" label="值" rules={[{ required: true }]} mode="password" placeholder={editTarget.isSensitive ? "敏感字段，输入新值" : ""} />;
  };

  const stats = useMemo(() => {
    const enabled = items.filter((c) => (c.value === true || c.value === "true")).length;
    const disabled = items.length - enabled;
    const systemConfig = items.filter((c) => c.category === "SSO" || c.category === "SECURITY" || c.category === "LICENSE").length;
    const aiProviders = items.filter((c) => c.category === "AI_PROVIDER").length;
    return { enabled, disabled, systemConfig, aiProviders };
  }, [items]);

  return (
    <AdminLayout
      title="系统配置"
      extra={<Space><Button icon={<ReloadOutlined />} onClick={load}>刷新</Button></Space>}
    >
      <StatGrid>
        <StatCard label="配置项总数" value={total} />
        <StatCard label="已启用" value={stats.enabled} color="success" />
        <StatCard
          label="已禁用"
          value={stats.disabled}
          color={stats.disabled > 0 ? "destructive" : "default"}
        />
        <StatCard label="系统配置" value={stats.systemConfig} color="warning" />
      </StatGrid>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: 16, marginBottom: 12, display: "flex", gap: 8 }}>
        <SearchInput placeholder="搜索 Key" value={keyword} onChange={(v) => setKeyword(v)} onSearch={() => { setPage(1); load(); }} />
        <Select placeholder="分类" value={category} onChange={(v) => { setCategory(v as ConfigCategory | undefined); setPage(1); }} showClear style={{ width: 200 }} optionList={Array.isArray(categories) ? categories.map((c) => ({ value: c.value, label: (CATEGORY_LABEL[c.value as ConfigCategory] ?? c.value) + " (" + c.count + ")" })) : []} />
      </div>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={items ?? []} pagination={{ currentPage: page, pageSize, total, showSizeChanger: true, onPageChange: (p) => setPage(p), onPageSizeChange: (ps) => setPageSize(ps) }} size="middle" />
      </div>
      <SideSheet
        title={editTarget ? "编辑配置 - " + editTarget.key : ""}
        visible={editOpen}
        onCancel={() => setEditOpen(false)}
        width={520}
        footer={
          <Space>
            <Button onClick={() => setEditOpen(false)}>取消</Button>
            <Button theme="solid" type="primary" onClick={submit}>保存</Button>
          </Space>
        }
      >
        {editTarget && (
          <Form form={editForm}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 4 }}>Key</div>
                <Input value={editTarget.key} disabled />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 4 }}>名称</div>
                <Input value={editTarget.label ?? ""} disabled />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 4 }}>分类</div>
                <Tag color={CATEGORY_COLOR[editTarget.category]}>{CATEGORY_LABEL[editTarget.category] ?? editTarget.category}</Tag>
              </div>
            </div>
            {renderValueInput()}
            <Form.TextArea field="note" label="变更原因（写入审计日志）" autosize={{ minRows: 2 }} placeholder="说明本次变更的背景" />
          </Form>
        )}
      </SideSheet>
    </AdminLayout>
  );
}
