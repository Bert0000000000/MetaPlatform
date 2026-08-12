import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Typography,
  Tooltip,
} from '@douyinfe/semi-ui';
import {
  AppstoreOutlined,
  RobotOutlined,
  MessageOutlined,
  ApartmentOutlined,
  PartitionOutlined,
  ApiOutlined,
  ArrowRightOutlined,
  PlusOutlined,
  EditOutlined,
  CheckOutlined,
  DeleteOutlined,
  HolderOutlined,
  SettingOutlined,
  BellOutlined,
  FileTextOutlined,
  DashboardOutlined,
  TeamOutlined,
  DatabaseOutlined,
  CloudOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ShortcutItem } from '@/api/dashboard/types';

const { Text } = Typography;

const STORAGE_KEY = 'mate_dashboard_shortcuts';

const DEFAULT_SHORTCUTS: ShortcutItem[] = [
  { id: 'app-center', title: '应用中心', icon: 'AppstoreOutlined', link: 'http://localhost:9201/apps', color: '#1677ff' },
  { id: 'super-ai', title: '超级 AI', icon: 'MessageOutlined', link: 'http://localhost:9301/chat', color: '#722ed1' },
  { id: 'digital-worker', title: '数字员工', icon: 'RobotOutlined', link: 'http://localhost:9401/dw', color: '#52c41a' },
  { id: 'ontology-studio', title: '本体工作室', icon: 'ApartmentOutlined', link: 'http://localhost:9101/concepts', color: '#fa8c16' },
  { id: 'architecture', title: '架构中心', icon: 'PartitionOutlined', link: 'http://localhost:9206', color: '#13c2c2' },
  { id: 'mcp-hub', title: 'MCP 服务中心', icon: 'ApiOutlined', link: 'http://localhost:9501', color: '#eb2f96' },
];

const AVAILABLE_ICONS: Record<string, React.ReactNode> = {
  AppstoreOutlined: <AppstoreOutlined />,
  RobotOutlined: <RobotOutlined />,
  MessageOutlined: <MessageOutlined />,
  ApartmentOutlined: <ApartmentOutlined />,
  PartitionOutlined: <PartitionOutlined />,
  ApiOutlined: <ApiOutlined />,
  SettingOutlined: <SettingOutlined />,
  BellOutlined: <BellOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  DashboardOutlined: <DashboardOutlined />,
  TeamOutlined: <TeamOutlined />,
  DatabaseOutlined: <DatabaseOutlined />,
  CloudOutlined: <CloudOutlined />,
  RocketOutlined: <RocketOutlined />,
};

const PRESET_COLORS = [
  '#1677ff',
  '#722ed1',
  '#52c41a',
  '#fa8c16',
  '#13c2c2',
  '#eb2f96',
  '#f5222d',
  '#faad14',
  '#2f54eb',
  '#000000',
];

interface SortableShortcutCardProps {
  item: ShortcutItem;
  isEditing: boolean;
  onEdit: (item: ShortcutItem) => void;
  onDelete: (id: string) => void;
  onClick: (item: ShortcutItem) => void;
}

function SortableShortcutCard({ item, isEditing, onEdit, onDelete, onClick }: SortableShortcutCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !isEditing });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const iconNode = AVAILABLE_ICONS[item.icon] ?? <AppstoreOutlined />;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, cursor: isEditing ? 'default' : 'pointer' }}
      {...attributes}
      onClick={() => {
        if (!isEditing) {
          onClick(item);
        }
      }}
    >
      <Card
        {...(isEditing ? {} : { shadows: 'hover' as const })}
        style={{ height: '100%', position: 'relative' }}
        bodyStyle={{ padding: 16 }}
      >
        <Space vertical spacing="medium" style={{ width: '100%' }}>
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: `${item.color}15`,
                color: item.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
              }}
            >
              {iconNode}
            </div>
            {isEditing && (
              <Space>
                <Tooltip content="拖拽排序">
                  <Button
                    theme="borderless"
                    icon={<HolderOutlined style={{ cursor: 'grab' }} />}
                    {...listeners}
                  />
                </Tooltip>
                <Tooltip content="编辑">
                  <Button theme="borderless" icon={<EditOutlined />} onClick={() => onEdit(item)} />
                </Tooltip>
                <Tooltip content="删除">
                  <Button theme="borderless" type="danger" icon={<DeleteOutlined />} onClick={() => onDelete(item.id)} />
                </Tooltip>
              </Space>
            )}
          </Space>
          <div>
            <Text strong style={{ fontSize: 16 }}>
              {item.title}
            </Text>
          </div>
          {!isEditing && (
            <Text link>
              进入 <ArrowRightOutlined />
            </Text>
          )}
        </Space>
      </Card>
    </div>
  );
}

function loadShortcuts(): ShortcutItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ShortcutItem[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_SHORTCUTS;
}

function saveShortcuts(items: ShortcutItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
}

export default function ShortcutPanel() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ShortcutItem[]>(() => loadShortcuts());
  const [isEditing, setIsEditing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShortcutItem | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    saveShortcuts(items);
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const itemIds = useMemo(() => items.map((i) => i.id), [items]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex((i) => i.id === active.id);
        const newIndex = prev.findIndex((i) => i.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleClick = (item: ShortcutItem) => {
    if (item.link.startsWith('http://') || item.link.startsWith('https://')) {
      window.open(item.link, '_blank');
    } else {
      navigate(item.link);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.reset();
    form.setValues({ color: PRESET_COLORS[0], icon: 'AppstoreOutlined' });
    setIsModalOpen(true);
  };

  const handleEdit = (item: ShortcutItem) => {
    setEditingItem(item);
    form.setValues(item);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleModalOk = () => {
    form.validate().then((values) => {
      const v = values as unknown as Omit<ShortcutItem, 'id'>;
      if (editingItem) {
        setItems((prev) =>
          prev.map((i) => (i.id === editingItem.id ? { ...i, ...v } : i))
        );
      } else {
        const newItem: ShortcutItem = {
          ...v,
          id: `${Date.now()}`,
        };
        setItems((prev) => [...prev, newItem]);
      }
      setIsModalOpen(false);
    });
  };

  const handleReset = () => {
    setItems(DEFAULT_SHORTCUTS);
  };

  return (
    <Card
      title="快捷入口"
      headerExtraContent={
        <Space>
          {isEditing && (
            <Button icon={<PlusOutlined />} onClick={handleAdd}>
              添加
            </Button>
          )}
          {isEditing && (
            <Button onClick={handleReset}>恢复默认</Button>
          )}
          <Button
            icon={isEditing ? <CheckOutlined /> : <EditOutlined />}
            theme={isEditing ? 'solid' : undefined}
            type={isEditing ? 'primary' : undefined}
            onClick={() => setIsEditing((prev) => !prev)}
          >
            {isEditing ? '完成' : '编辑'}
          </Button>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={itemIds}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {items.map((item) => (
              <SortableShortcutCard
                key={item.id}
                item={item}
                isEditing={isEditing}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onClick={handleClick}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Modal
        title={editingItem ? '编辑快捷入口' : '添加快捷入口'}
        visible={isModalOpen}
        onOk={handleModalOk}
        onCancel={() => setIsModalOpen(false)}
      >
        <Form form={form}>
          <Form.Input
            field="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
            placeholder="例如：应用中心"
          />
          <Form.Input
            field="link"
            label="链接地址"
            rules={[
              { required: true, message: '请输入链接地址' },
              {
                validator: (_rule: unknown, value: unknown, callback: (error?: string | string[]) => void) => {
                  const ok =
                    typeof value === 'string' &&
                    (value.startsWith('/') ||
                      value.startsWith('http://') ||
                      value.startsWith('https://'));
                  if (ok) {
                    callback();
                    return true;
                  }
                  callback('链接需以 / 或 http(s):// 开头');
                  return new Error('链接需以 / 或 http(s):// 开头');
                },
              },
            ]}
            placeholder="/notifications 或 http://example.com"
          />
          <Form.Select
            field="icon"
            label="图标"
            rules={[{ required: true, message: '请选择图标' }]}
            placeholder="选择图标"
            optionList={Object.keys(AVAILABLE_ICONS).map((name) => ({
              value: name,
              label: (
                <Space>
                  {AVAILABLE_ICONS[name]}
                  <span>{name}</span>
                </Space>
              ),
            }))}
          />
          <Form.Select
            field="color"
            label="颜色标识"
            rules={[{ required: true, message: '请选择颜色' }]}
            placeholder="选择颜色"
            optionList={PRESET_COLORS.map((color) => ({
              value: color,
              label: (
                <Space>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      background: color,
                    }}
                  />
                  <span>{color}</span>
                </Space>
              ),
            }))}
          />
        </Form>
      </Modal>
    </Card>
  );
}
