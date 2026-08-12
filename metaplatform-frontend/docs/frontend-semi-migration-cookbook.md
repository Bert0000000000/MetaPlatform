# Semi UI 全量迁移 Cookbook（antd → Semi）

> 2026-08-13 建立，来源：knowledge/dw 模块迁移实战 + Semi 2.102.0 类型勘察。
> 迁移目标：`apps/web/src/pages/**` 全部 antd import 清零，最终移除 antd 依赖。

## 0. 铁律

1. 只改自己模块的文件，**不碰 `packages/shared`**（renderers/flow 除外，另行处理）。
2. 不改文件之外的任何行为逻辑：交互（抽屉/弹窗/表单校验）原样保留，只换 UI 库。
3. `@ant-design/icons` 的 import **原样保留**（vite alias 已指向 `packages/shared/src/icons` 自研 SVG，运行时就是自研图标）。
4. `lucide-react` 原样保留。
5. `v-card`/`v-btn`/`v-input`/`v-badge`/`v-stat-*` 等自定义 CSS 类**保留不动**（global.css 提供，P4 统一删）。
6. 内联硬编码颜色（`#0a0a0a`/`#fafafa`/`#262626` 等 monochrome 系）→ 换成映射变量：
   - `var(--background)` `var(--card)` `var(--muted)` `var(--border)` `var(--foreground)` `var(--muted-foreground)` `var(--destructive)` `var(--success)` `var(--warning)` `var(--info)` `var(--primary)`
   - 或 Semi token：`var(--semi-color-primary)` `var(--semi-color-bg-0)` 等
7. 深浅色由 `body[theme-mode]` 自动切换，**不要写死深色值**。
8. 每迁移完一个文件自查：`grep -c "from 'antd'" 文件` 应为 0。

## 1. 组件映射表

| antd | Semi | 差异点 |
|---|---|---|
| `Space size="large/middle/small"` | `spacing="loose/medium/tight"` | 无 `extraTight`/`large` |
| `Card extra=` | **`headerExtraContent=`** | 没有 `headerExtra`！底部操作区才是 `extra` |
| `Button type="primary"` | `theme="solid" type="primary"` | size 是 `'small'|'default'|'large'`（**无 `middle`**） |
| `Button iconPosition="end"` | `iconPosition="right"` | 无 `end` |
| `Button danger` | `type="danger"`（配 theme） | Semi 无 danger prop |
| `Tag color="success/processing/error/default"` | `green/blue/red/grey` | TagColor 是预设联合类型，从 `@douyinfe/semi-ui/lib/es/tag` 导入 |
| `message.success/error/warning/info` | `Toast.success/error/warning/info` | 全局命令式，无需 Provider |
| `Modal` | `Modal` | `open/onOk/onCancel/confirmLoading/width` 兼容；无 `destroyOnClose` |
| `Drawer` | **`SideSheet`** | 打开状态用 **`visible=`**（不是 open！）；无 keepDOM 类型 |
| `Drawer extra=` | 自定义 title（flex 容器里放按钮） | SideSheet 无 extra |
| `Alert` | `Banner` | 更名 |
| `Rate` | `Rating` | 更名 |
| `Row/Col` | `Row/Col` 从 **`@douyinfe/semi-ui/lib/es/grid`** 导入 | 主入口无 Grid；`gutter/span` 兼容 |
| `Statistic` | 🔴 无 | 自建 div（label + 大数字） |
| `Result` | 🔴 无 | 自建（icon + title + 描述 + Button） |
| `Segmented` | 🔴 无 | `RadioGroup type="button"` 或 Tabs |
| `Transfer` | 🔴 无 | 自建双栏 |
| `Skeleton paragraph={{rows}}` | 🔴 无 | 自建 shimmer div |
| `Empty` | `Empty` | `description` 兼容 |
| `Spin` | `Spin` | `size="small|middle|large"`；`tip` 兼容 |
| `Pagination` | `Pagination` | 受控用 `currentPage/onPageChange`（antd 是 current/onChange）；`pageSizeOpts`（不是 pageSizeOptions） |
| `Table locale={{emptyText}}` | `empty=` prop | 传 ReactNode/string |
| `Typography.Title level={4}` | `heading={4}` | |
| `Typography.Text` | `Typography.Text` | `type="tertiary"` 次要文字 |

## 2. Form API（差异最大）

```tsx
// antd
const [form] = Form.useForm();
<Form form={form} layout="vertical" preserve={false}>
  <Form.Item name="x" label="X" rules={[{required:true, message:'...'}]} initialValue="v">
    <Input />
  </Form.Item>
</Form>
await form.validateFields(); form.resetFields();

// Semi（2.102）
const [form] = Form.useForm();           // Form.useForm 存在 ✓
<Form form={form}>                        // 无 layout prop（默认垂直）；无 preserve
  <Form.Input field="x" label="X" rules={[{required:true, message:'...'}]} initValue="v" />
  <Form.Select field="y" label="Y" optionList={...} />
  <Form.TextArea field="z" label="Z" rows={3} />
  <Form.InputNumber field="n" label="N" />
</Form>
await form.validate();                   // 不是 validateFields！
form.reset();                            // 不是 resetFields！
```

- **`Form.Item` + 子组件包一层 → 直接用 `Form.Input/Form.Select/Form.TextArea/Form.InputNumber`**（它们自带 field/label/rules/initValue）。
- rules 格式与 async-validator 兼容（required/message 照抄）。

## 3. 事件/受控 API 差异（高频坑）

| antd | Semi |
|---|---|
| `Input onChange={(e) => setV(e.target.value)}` | `onChange={(value: string) => setV(value)}`（第一参数就是值！） |
| `Input onPressEnter={fn}` | `onEnterPress={fn}` |
| `Input.TextArea` | 表单内用 `Form.TextArea`；表单外用 `Input type="textarea"` 无效 |
| `Input allowClear` | `showClear` |
| `Select options={}` | **`optionList={}`** |
| `Select onChange={setX}` | `onChange={(v) => setX(v as string | undefined)}`（v 可能 string[]） |
| `Table pagination={{...}}` | 同构；onPageChange 在 pagination 对象里 |
| `Table rowKey` | 必须给，否则警告 |

## 4. 迁移顺序（每文件）

1. `import { X } from 'antd'` → `import { X } from '@douyinfe/semi-ui'`（按映射表改名）。
2. 组件名/API 按表适配。
3. `message.xxx` → `Toast.xxx`。
4. 颜色值替换（见铁律 6）。
5. `v-*` 类保留。
6. 自查 `grep -c "from 'antd'"` = 0。

## 5. 验证

```bash
cd metaplatform-frontend/apps/web && npx tsc -b --noEmit 2>&1 | grep <你的模块目录>
```
- **既有已知错误**（与迁移无关，忽略）：`superai/components/AgentChatPanel.tsx`、`ClaimRenderer`、`EvidenceRenderer` 的 Claim/Evidence 类型不匹配；`shared/components/flow/*` 两个错误。
- 注意：多个进程并发跑 tsc -b 会抢 tsbuildinfo，报错重试即可。

## 6. 语义色映射（Tag）

| antd | Semi TagColor |
|---|---|
| success / green | green |
| processing / blue | blue |
| error / red | red |
| default / grey | grey |
| warning | orange |
| gold | yellow |
| purple | purple |
