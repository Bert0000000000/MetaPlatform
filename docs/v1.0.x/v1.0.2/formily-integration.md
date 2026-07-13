# Formily 2 集成报告

## 概要

v1.0.2 Sprint 2 在 MetaPlatform 公开表单中引入了 **Formily 2**（阿里统一前端表单方案），
不替换既有 `PublicForm.tsx`，而是以**试验田**方式新增 `PublicFormV2.tsx`，通过 schema adapter
把现有 section/field schema 转 Formily JSON Schema。

## 安装的包

| 包 | 版本 | 用途 |
|---|---|---|
| `@formily/core` | ^2.3.7 | 表单状态机（createForm） |
| `@formily/react` | ^2.3.7 | FormProvider / SchemaField factory / connect / mapProps |
| `@formily/json-schema` | ^2.3.7 | ISchema 类型 + SchemaField 注入 |
| `@formily/reactive` | ^2.3.7 | MobX-like 反应式系统 |
| `@formily/reactive-react` | ^2.3.7 | observer / 响应式 hook |
| `@formily/path` | ^2.3.7 | 路径表达式 |
| `@formily/shared` | ^2.3.7 | 工具函数 |

**未引入**： `@formily/antd` `@formily/antd-v5` `@formily/next` `@formily/element`
等组件库适配（MetaPlatform 自研 Radix/Tailwind 组件集）。

## 集成架构

```
┌──────────────────────────────────────────────────────────────┐
│ PublicFormV2.tsx                                              │
│  ┌────────────────────────────────────────────────────┐      │
│  │ <FormProvider form={form}>                          │      │
│  │   <SchemaField schema={formilySchema} />            │      │
│  │ </FormProvider>                                     │      │
│  └────────────────────────────────────────────────────┘      │
│                            ▲                                  │
│                            │ form.values                      │
│  ┌─────────────────────────┴─────────────────────────┐        │
│  │ schemaAdapter.ts                                    │        │
│  │   sections/fields  →  Formily JSON Schema           │        │
│  │   field.widget/type → x-component                   │        │
│  │   field.required    → x-validator                   │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ formily/fields.tsx (自研组件集)                       │    │
│  │   FormItem (decorator) - title + required + errors    │    │
│  │   TextField, TextareaField, NumberField              │    │
│  │   DateField, CheckboxField, SelectField              │    │
│  │   LookupField (复用 /components/LookupDropdown)     │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## 关键发现与设计决策

### 1. SchemaField 是 factory 不是单例

`@formily/react` 的 `SchemaField` 必须用 `createSchemaField({ components })` 创建实例：

```typescript
import { createSchemaField } from "@formily/react";

const SchemaField = createSchemaField({
  components: FormilyComponents,  // 注册我们的组件集
});
```

### 2. 自研组件必须用 `connect` + `mapProps` 桥接 Formily

Formily 通过 `field.setValue / field.value / field.disabled` 与组件通信：

```typescript
import { connect, mapProps } from "@formily/react";

export const TextField = connect(
  (props: TextFieldProps) => <Input {...props} />,
  mapProps((props, field) => ({
    value: props.value,
    onChange: field?.setValue,
    disabled: field?.disabled ?? props.disabled,
  })),
);
```

### 3. Schema 映射：widget/type → x-component

`schemaAdapter.widgetToComponent()` 把现有 widget 名映射到 Formily 组件：

| widget | Formily 组件 | schema type |
|---|---|---|
| text/input/string/email/phone | TextField | string |
| longtext/textarea/richtext | TextareaField | string |
| number/currency/percent | NumberField | number |
| date/datetime | DateField | string |
| boolean/switch/checkbox | CheckboxField | boolean |
| select/radio | SelectField | string |
| lookup | LookupField | string |

### 4. lookup 字段复用现有 LookupDropdown

`LookupField` 是 `LookupDropdown` 的薄包装：

```typescript
export const LookupField: React.FC<LookupFieldProps> = connect(
  ({ objectId, displayField, options, loading, value, onChange }) => (
    <LookupDropdown config={{...}} options={options ?? []} loading={loading} />
  ),
  mapProps((props, field) => ({
    value: props.value,
    onChange: field?.setValue,
    objectId: props.objectId,
    displayField: props.displayField,
    options: props.options ?? field?.dataSource ?? [],
    loading: field?.loading ?? props.loading,
  })),
);
```

`options` 通过 `form.setFieldState(field, state => state.dataSource = ...)` 注入。

### 5. 表单提交

```typescript
const v = form.values;  // Formily 自动收集所有 field 值
await appServiceApi.public.submitForm(formId, v);
```

## 测试结果

| 测试 | 数量 | 状态 |
|---|---|---|
| `schemaAdapter.test.ts` | 30 | ✓ |
| 前端全量单测 | 151 | ✓ |
| 后端全量单测 | 157 | ✓ |
| TypeScript 检查 | 0 errors | ✓ |
| Vite build (production) | OK | ✓ |
| E2E 集成测试 | 12 | ✓ |

## 文件清单

| 类型 | 文件 |
|---|---|
| 新增 | `src/components/formily/fields.tsx` |
| 新增 | `src/components/formily/schemaAdapter.ts` |
| 新增 | `src/components/formily/schemaAdapter.test.ts` |
| 新增 | `src/pages/PublicFormV2.tsx` |
| 修改 | `src/App.tsx` (新增路由 `/public/formV2/:appId`) |
| 修改 | `package.json` (7 个 @formily/* 依赖) |

## 渐进式迁移策略

Formily 集成**不破坏**现有 PublicForm：

1. **现状**：`/public/form/:appId` 仍走 `PublicForm.tsx`（自研渲染）
2. **试验田**：`/public/formV2/:appId` 走 `PublicFormV2.tsx`（Formily）
3. **下一步**：通过 A/B 或 feature flag 切换
4. **长期**：将自研渲染分支重构为 SchemaField markup（`<SchemaField.String x-component="TextField" />`）

## 下一步建议

| 优先级 | 任务 |
|---|---|
| P0 | 把 PublicForm 的 lookup 字段分支替换为 LookupField（最小改动） |
| P1 | 加 Formily x-reactions 支持（字段联动，例如选了某 lookup 显隐其他字段） |
| P1 | 把 `FormLowCodeEditor` 的预览区用 Formily SchemaField 渲染（统一运行时） |
| P2 | 引入 `@formily/designable` 做可视化设计器（替代自研 FormLowCodeEditor） |
| P2 | x-validator 自定义（手机号格式、邮箱格式等） |

## 已知限制

1. **未做自定义校验**（手机号/邮箱 regex）：当前只用了 `required`
2. **未做联动**（x-reactions）：字段间联动需要 Sprint 2+ 单独做
3. **公开表单 listData 没解析 lookup**：F1.4 只在 listInstances 解析（这是 B1.5 行为，公开 data 接口保持 FK ID）
4. **bundle size 增加 ~30 KB** (gzipped)：Formily core + reactive 是核心开销；后续可优化 tree-shaking