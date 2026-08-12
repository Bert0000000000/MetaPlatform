/**
 * 平台通用组件 manifest —— 单一数据源。
 *
 * 描述 @mate/shared 每个通用组件的名称 / 用途 / 关键 props / 用法示例，
 * 供两处消费：
 * 1. `buildPlatformComponentsSkill.ts` → 生成 SKILL.md 发布到 skillhub，
 *    使 agent 未来能按此清单发现并复用组件搭建应用；
 * 2. 后台「组件展示」页（ComponentDemoPage）可编程渲染。
 *
 * 新增通用组件时：在 @mate/shared 实现 + 导出后，在此补一条 manifest。
 */
export type ComponentCategory =
  | 'button'
  | 'navigation'
  | 'form'
  | 'layout'
  | 'data'
  | 'feedback'
  | 'renderer';

export interface ComponentPropManifest {
  name: string;
  type: string;
  default?: string;
  description: string;
}

export interface ComponentManifest {
  name: string;
  category: ComponentCategory;
  description: string;
  importPath: string;
  props?: ComponentPropManifest[];
  example?: string;
}

export const COMPONENT_MANIFEST: ComponentManifest[] = [
  {
    name: 'PlatformButton',
    category: 'button',
    description: '平台统一按钮，封装 antd Button + v-btn 样式类，支持主/次/危险/幽灵变体。',
    importPath: '@mate/shared',
    props: [
      { name: 'variant', type: "'primary' | 'default' | 'danger' | 'ghost'", default: "'default'", description: '视觉变体' },
      { name: 'size', type: "'small' | 'middle' | 'large'", description: '尺寸，small 复用 v-btn-sm' },
      { name: 'danger', type: 'boolean', description: '危险按钮（红色语义）' },
      { name: 'disabled', type: 'boolean', description: '禁用' },
    ],
    example: '<PlatformButton variant="primary">主按钮</PlatformButton>',
  },
  {
    name: 'PlatformPagination',
    category: 'navigation',
    description: '平台统一分页，封装 antd Pagination，统一 showTotal / 分页配置。',
    importPath: '@mate/shared',
    props: [
      { name: 'current', type: 'number', description: '当前页' },
      { name: 'total', type: 'number', description: '总条数' },
      { name: 'pageSize', type: 'number', description: '每页条数' },
      { name: 'onChange', type: '(page, pageSize) => void', description: '翻页回调' },
    ],
    example: '<PlatformPagination current={1} total={120} pageSize={10} />',
  },
  {
    name: 'PlatformMenu2',
    category: 'navigation',
    description: '平台通用多级菜单（一级/二级…），基于 antd Menu，自动按当前路由高亮/展开。',
    importPath: '@mate/shared',
    props: [
      { name: 'items', type: 'PlatformMenu2Item[]', description: '菜单项，children 支持二级嵌套' },
      { name: 'rootPath', type: 'string', description: '展开根路径前缀' },
      { name: 'mode', type: "'vertical' | 'inline'", default: "'inline'", description: '菜单形态' },
      { name: 'collapsed', type: 'boolean', description: '折叠态（inline 生效）' },
    ],
    example: '<PlatformMenu2 items={[{key:"a",label:"A",path:"/a",children:[{key:"a1",label:"A1",path:"/a/1"}]}]} />',
  },
  {
    name: 'Breadcrumb',
    category: 'navigation',
    description: '面包屑导航，支持层级 items。',
    importPath: '@mate/shared',
    props: [{ name: 'items', type: 'BreadcrumbItem[]', description: '面包屑项（label/href）' }],
    example: '<Breadcrumb items={[{label:"首页",href:"/"},{label:"当前页"}]} />',
  },
  {
    name: 'SubTabs',
    category: 'navigation',
    description: '页内二级 Tab，替代 antd Tabs 做轻量子页面切换。',
    importPath: '@mate/shared',
    props: [
      { name: 'items', type: 'SubTabItem[]', description: 'tab 项（key/label）' },
      { name: 'activeKey', type: 'string', description: '当前激活项' },
      { name: 'onChange', type: '(key) => void', description: '切换回调' },
    ],
    example: '<SubTabs items={[{key:"a",label:"A"},{key:"b",label:"B"}]} />',
  },
  {
    name: 'FormDrawer',
    category: 'form',
    description: '表单抽屉，自带 1/3·2/3·全屏 尺寸切换按钮（右上角）。',
    importPath: '@mate/shared',
    props: [
      { name: 'open', type: 'boolean', description: '是否打开' },
      { name: 'title', type: 'ReactNode', description: '标题' },
      { name: 'onCancel', type: '() => void', description: '取消' },
      { name: 'onOk', type: '() => void', description: '确认' },
      { name: 'size', type: "'sm' | 'md' | 'full'", description: '受控尺寸（默认 md 2/3屏）' },
    ],
    example: '<FormDrawer open={open} title="编辑" onCancel={close} onOk={save}>…</FormDrawer>',
  },
  {
    name: 'StepDrawer',
    category: 'form',
    description: '分步表单抽屉（多步向导），带尺寸切换。',
    importPath: '@mate/shared',
    props: [
      { name: 'open', type: 'boolean', description: '是否打开' },
      { name: 'steps', type: 'ReactNode[]', description: '各步内容' },
      { name: 'onCancel', type: '() => void', description: '取消' },
    ],
    example: '<StepDrawer open={open} steps={[step1, step2]} onCancel={close} />',
  },
  {
    name: 'FormModal',
    category: 'form',
    description: '表单弹窗（Modal 内嵌表单），标准确认/取消。',
    importPath: '@mate/shared',
    props: [
      { name: 'open', type: 'boolean', description: '是否打开' },
      { name: 'title', type: 'ReactNode', description: '标题' },
      { name: 'onOk', type: '() => void', description: '确认' },
      { name: 'onCancel', type: '() => void', description: '取消' },
    ],
    example: '<FormModal open={open} title="新建" onOk={save} onCancel={close}>…</FormModal>',
  },
  {
    name: 'SearchInput',
    category: 'form',
    description: '搜索输入框（带搜索图标与触发回调）。',
    importPath: '@mate/shared',
    props: [
      { name: 'value', type: 'string', description: '当前值' },
      { name: 'onSearch', type: '(v: string) => void', description: '搜索回调' },
    ],
    example: '<SearchInput onSearch={(v) => load(v)} />',
  },
  {
    name: 'PageContainer',
    category: 'layout',
    description: '页面容器，统一内边距与最大宽度。',
    importPath: '@mate/shared',
    props: [{ name: 'children', type: 'ReactNode', description: '页面内容' }],
    example: '<PageContainer>{/* page */}</PageContainer>',
  },
  {
    name: 'SectionCard',
    category: 'layout',
    description: '区块卡片（带标题），用于页面分区展示。',
    importPath: '@mate/shared',
    props: [
      { name: 'title', type: 'ReactNode', description: '标题' },
      { name: 'extra', type: 'ReactNode', description: '右侧操作区' },
      { name: 'children', type: 'ReactNode', description: '内容' },
    ],
    example: '<SectionCard title="基本信息" extra={<PlatformButton variant="primary">保存</PlatformButton>}>…</SectionCard>',
  },
  {
    name: 'PageHeader',
    category: 'layout',
    description: '页面头部（标题 + 面包屑 + 操作区）。',
    importPath: '@mate/shared',
    props: [
      { name: 'title', type: 'string', description: '标题' },
      { name: 'extra', type: 'ReactNode', description: '右侧操作区' },
    ],
    example: '<PageHeader title="列表页" extra={<PlatformButton variant="primary">新建</PlatformButton>} />',
  },
  {
    name: 'DataTable',
    category: 'data',
    description: '数据表格，透传 antd Table + PlatformPagination 分页。',
    importPath: '@mate/shared',
    props: [
      { name: 'columns', type: 'ColumnsType[]', description: '列定义' },
      { name: 'dataSource', type: 'Record<string, unknown>[]', description: '数据源' },
      { name: 'pagination', type: 'PaginationProps', description: '分页配置（透传）' },
    ],
    example: '<DataTable columns={cols} dataSource={rows} pagination={{total,pageSize}} />',
  },
  {
    name: 'PageLoading',
    category: 'feedback',
    description: '整页加载态（居中 Spin）。',
    importPath: '@mate/shared',
    example: '<PageLoading />',
  },
  {
    name: 'CardSkeleton',
    category: 'feedback',
    description: '卡片骨架屏。',
    importPath: '@mate/shared',
    example: '<CardSkeleton />',
  },
  {
    name: 'ErrorState',
    category: 'feedback',
    description: '错误态（标题 + 描述 + 重试）。',
    importPath: '@mate/shared',
    props: [
      { name: 'title', type: 'string', description: '错误标题' },
      { name: 'onRetry', type: '() => void', description: '重试回调' },
    ],
    example: '<ErrorState title="加载失败" onRetry={reload} />',
  },
  {
    name: 'EmptyState',
    category: 'feedback',
    description: '空态（描述 + 操作按钮）。',
    importPath: '@mate/shared',
    props: [{ name: 'description', type: 'string', description: '空态描述' }],
    example: '<EmptyState description="暂无数据" />',
  },
  {
    name: 'StateContainer',
    category: 'feedback',
    description: '状态容器：根据 loading/error/empty/data 自动切换渲染。',
    importPath: '@mate/shared',
    props: [
      { name: 'loading', type: 'boolean', description: '加载中' },
      { name: 'error', type: 'Error | null', description: '错误' },
      { name: 'empty', type: 'boolean', description: '空态' },
      { name: 'children', type: 'ReactNode', description: '正常内容' },
    ],
    example: '<StateContainer loading={loading} error={err} empty={rows.length===0}>{rows}</StateContainer>',
  },
  {
    name: 'MarkdownRenderer',
    category: 'renderer',
    description: 'Markdown 渲染器（AI 回复格式化），支持标题/代码/列表/表格/引用/行内格式，dark/light 两套配色。',
    importPath: '@mate/shared',
    props: [
      { name: 'content', type: 'string', description: 'Markdown 文本' },
      { name: 'variant', type: "'dark' | 'light'", default: "'light'", description: '配色主题' },
    ],
    example: '<MarkdownRenderer content={aiReply} variant="light" />',
  },
  {
    name: 'ClaimRenderer',
    category: 'renderer',
    description: 'Claim 渲染器：区分 Fact / Inference / Recommendation。',
    importPath: '@mate/shared',
    props: [{ name: 'claim', type: 'Claim', description: 'Claim 数据' }],
    example: '<ClaimRenderer claim={{type:"FACT", content:"…"}} />',
  },
  {
    name: 'EvidenceRenderer',
    category: 'renderer',
    description: '证据渲染器：展示引用证据（KB/外部等）。',
    importPath: '@mate/shared',
    props: [{ name: 'evidence', type: 'Evidence', description: '证据数据' }],
    example: '<EvidenceRenderer evidence={{type:"KB_CHUNK", title:"…"}} />',
  },
  {
    name: 'ArtifactViewer',
    category: 'renderer',
    description: '制品查看器：展示 AI 生成的 artifact（代码/JSON 等）。',
    importPath: '@mate/shared',
    props: [{ name: 'artifact', type: 'Artifact', description: '制品数据' }],
    example: '<ArtifactViewer artifact={{type:"code", content:"…"}} />',
  },
];
