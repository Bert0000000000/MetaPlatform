/**
 * DomainManageDrawer —— 业务域管理（增 / 改 / 删）。
 *
 * 业务域是应用中心的一等实体：卡片副标题、业务域 tab 都读它，所以可以在这里
 * 直接维护，不必跳到平台管理。删除受引用完整性保护（域下还有应用时后端返回
 * 409），前端把后端的原话透出来，并显示每个域下的应用数，让人知道差多少。
 *
 * 外壳复用骨架件 SheetDetail（DESIGN-SPEC §5 版式 B/E 的右侧抽屉范式）。
 */
import { useState } from 'react';
import { Button, Input, Popconfirm, Spin, Toast, Typography } from '@douyinfe/semi-ui';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import SheetDetail from '@/components/skeleton/SheetDetail';
import {
  createDomain,
  deleteDomain,
  updateDomain,
} from '@/api/apphub/apps';
import type { BusinessDomain } from '@/api/apphub/types';

interface DomainManageDrawerProps {
  open: boolean;
  onClose: () => void;
  domains: BusinessDomain[];
  /** 域码 → 归属应用数。用于展示「为什么删不掉」。 */
  appCounts: Record<string, number>;
  loading?: boolean;
  /** 增 / 改 / 删成功后回调，让列表与卡片一起刷新。 */
  onChanged: () => void | Promise<void>;
}

export default function DomainManageDrawer({
  open,
  onClose,
  domains,
  appCounts,
  loading = false,
  onChanged,
}: DomainManageDrawerProps) {
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [savingCode, setSavingCode] = useState<string | null>(null);

  const resetCreate = () => {
    setNewName('');
    setNewCode('');
  };

  const handleCreate = async () => {
    const name = newName.trim();
    const code = newCode.trim();
    if (!name || !code) {
      Toast.warning('名称和编码都要填');
      return;
    }
    setCreating(true);
    try {
      await createDomain({ name, code, sort_order: (domains.at(-1)?.sort_order ?? 0) + 10 });
      Toast.success(`业务域「${name}」已创建`);
      resetCreate();
      await onChanged();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (d: BusinessDomain) => {
    setEditingCode(d.code);
    setEditName(d.name);
  };

  const handleRename = async (d: BusinessDomain) => {
    const name = editName.trim();
    if (!name) {
      Toast.warning('名称不能为空');
      return;
    }
    if (name === d.name) {
      setEditingCode(null);
      return;
    }
    setSavingCode(d.code);
    try {
      await updateDomain(d.code, { name });
      Toast.success('已更新');
      setEditingCode(null);
      await onChanged();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : '更新失败');
    } finally {
      setSavingCode(null);
    }
  };

  const handleDelete = async (d: BusinessDomain) => {
    try {
      await deleteDomain(d.code);
      Toast.success(`业务域「${d.name}」已删除`);
      await onChanged();
    } catch (e) {
      // 域下还有应用时后端返回 409，这里把原话透出来。
      Toast.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  return (
    <SheetDetail open={open} onClose={onClose} title="管理业务域" width={420}>
      <Typography.Paragraph type="tertiary" size="small">
        业务域是应用中心的一条业务分类轴，和「技术分类」相互独立。域下还有应用时不能删除，
        需要先把那些应用改到别的域。
      </Typography.Paragraph>

      <div className="mp-domain-create">
        <Input
          value={newName}
          onChange={setNewName}
          placeholder="业务域名称，如「订单域」"
          aria-label="业务域名称"
        />
        <Input
          value={newCode}
          onChange={setNewCode}
          placeholder="编码，如 order"
          aria-label="业务域编码"
        />
        <Button
          theme="solid"
          type="primary"
          icon={<Plus size={15} strokeWidth={1.5} />}
          loading={creating}
          onClick={() => void handleCreate()}
        >
          新增
        </Button>
      </div>

      {loading && domains.length === 0 ? (
        <div className="mp-domain-loading">
          <Spin size="middle" />
        </div>
      ) : domains.length === 0 ? (
        <Typography.Paragraph type="tertiary">还没有业务域，先新增一个。</Typography.Paragraph>
      ) : (
        <ul className="mp-domain-list">
          {domains.map((d) => {
            const count = appCounts[d.code] ?? 0;
            const editing = editingCode === d.code;
            return (
              <li key={d.code} className="mp-domain-row">
                {editing ? (
                  <>
                    <Input
                      value={editName}
                      onChange={setEditName}
                      aria-label={`重命名 ${d.name}`}
                      autoFocus
                      onEnterPress={() => void handleRename(d)}
                    />
                    <Button
                      theme="borderless"
                      type="tertiary"
                      icon={<Check size={15} strokeWidth={1.5} />}
                      aria-label="保存"
                      loading={savingCode === d.code}
                      onClick={() => void handleRename(d)}
                    />
                    <Button
                      theme="borderless"
                      type="tertiary"
                      icon={<X size={15} strokeWidth={1.5} />}
                      aria-label="取消"
                      onClick={() => setEditingCode(null)}
                    />
                  </>
                ) : (
                  <>
                    <div className="mp-domain-main">
                      <div className="mp-domain-name">{d.name}</div>
                      <div className="mp-domain-code">
                        {d.code} · {count} 个应用
                      </div>
                    </div>
                    <Button
                      theme="borderless"
                      type="tertiary"
                      icon={<Pencil size={15} strokeWidth={1.5} />}
                      aria-label={`重命名 ${d.name}`}
                      onClick={() => startEdit(d)}
                    />
                    <Popconfirm
                      title="删除业务域"
                      content={
                        count > 0
                          ? `「${d.name}」下还有 ${count} 个应用，需先改到别的域。`
                          : `确定删除「${d.name}」吗？`
                      }
                      onConfirm={() => void handleDelete(d)}
                    >
                      <Button
                        theme="borderless"
                        type="tertiary"
                        icon={<Trash2 size={15} strokeWidth={1.5} />}
                        aria-label={`删除 ${d.name}`}
                      />
                    </Popconfirm>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SheetDetail>
  );
}
