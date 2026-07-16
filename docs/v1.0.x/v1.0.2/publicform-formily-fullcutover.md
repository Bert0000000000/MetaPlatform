# PublicForm Formily 全量切换 (Sprint 2 收尾)

## 概要

v1.0.2 Sprint 2 把自研的 `PublicForm.tsx` (jsx 分支渲染) **完全替换**为 Formily 2 驱动实现，
不再保留 V1 双轨制。`PublicFormV2.tsx` 文件已**重命名**为 `PublicForm.tsx` (替代旧版)，
路由保持不变 (`/public/form/:appId`)。

## 改造前后对比

| 特性 | V1 (旧, 2024 自研) | V2 (新, Formily) |
|---|---|---|
| 渲染方式 | 12 段 JSX `if (type === ...)` 分支 | `<SchemaField schema={...} />` 声明式 |
| 字段类型 | 8 种 (input/textarea/number/select/checkbox/date/datetime/email) | 11+ 种 + lookup (复用 LookupDropdown) |
| lookup 字段 | `if (isLookupField) <LookupDropdown />` JSX | `<LookupField x-component>` (Formily 组件) |
| 联动显隐 | 不支持 | x-reactions (visibleWhen eq/neq/notEmpty/empty) |
| 表单校验 | 浏览器原生 `required` 属性 | Formily `x-validator` (required + email format) |
| 草稿持久化 | ✓ (localStorage) | ✓ (复用, `form.subscribe`) |
| 提交后保留 | ✓ (computeResubmitValues/Reset) | ✓ (复用, 通过 form.setValues) |
| 联系信息 (_name/_email) | ✓ (与业务字段平铺) | ✓ (平铺在 SchemaField 外) |
| 品牌 Hero + Badges | ✓ | ✓ |
| 提交按钮禁用直到 lookup 加载 | 部分 (loading state) | ✓ (`disabled={!lookupLoaded}`) |
| 包大小 | - | +30 KB gzip (Formily core+react+reactive+json-schema) |

## 文件结构

```
src/pages/
  PublicForm.tsx           ← 唯一公开表单 (Formily 全量)
src/components/formily/
  fields.tsx               ← 8 个 Formily 组件 (TextField/TextareaField/NumberField/DateField/CheckboxField/SelectField/LookupField/FormItem)
  schemaAdapter.ts         ← section/field → Formily JSON Schema 转换器
  schemaAdapter.test.ts    ← 46 单测
src/components/
  LookupDropdown.tsx       ← 复用: lookup 选项下拉组件
src/pages/
  preserveFormValues.ts    ← 复用: 草稿 + 保留值工具
```

## 完整数据流

```
1. 用户访问 /public/form/:appId?formId=X
   → React Router 渲染 <PublicForm /> (Formily)

2. PublicForm useEffect:
   a. GET /api/public/forms/X  → schemaJson
   b. loadDraft(X) → form.setValues(draft) (跨刷新恢复)
   c. sectionsToFormilySchema(sections) → Formily JSON Schema
   d. extractLookupConfigs(sections) → for lookup fields
      GET /api/public/forms/X/lookup-options
      indexLookupOptions → Map<fieldKey, LookupOption[]>
      form.setFieldState(fieldKey, state => state.dataSource = options)

3. <FormProvider form={form}>
     <SchemaField schema={fullSchema} />
     <联系信息 _name/_email Input (controlled) />
   </FormProvider>

4. 用户输入:
   a. 字段变化 → Formily form.values 响应式更新
   b. form.subscribe → saveDraft(formId, values) (localStorage)
   c. lookup 字段 → LookupField onChange → form.values.lookup_field = FK ID
   d. x-reactions: visibleWhen rule 命中 → field.visible=true/false → FormItem 隐藏/显示

5. 用户点击 "立即提交":
   a. await form.validate() (Formily 校验: required + email format)
   b. POST /api/public/forms/X/submit
      body: { values: form.values, submitterEmail: values._email, submitterName: values._name }
   c. 成功后: setLastSubmittedValues(form.values) + setSubmitted(true) + clearDraft(formId)
   d. 渲染"提交成功"卡片:
      - "再提交一份（保留已填值）" → computeResubmitValues → form.setValues
      - "重新填写" → computeResetValues → form.setValues
```

## Formily 核心 API 用法

```typescript
import { createForm } from "@formily/core";
import { FormProvider, createSchemaField, useField } from "@formily/react";
import { ISchema } from "@formily/json-schema";

// 1. 创建 form 实例
const form = useMemo(() => createForm(), []);

// 2. SchemaField factory (静态创建)
const SchemaField = createSchemaField({ components: FormilyComponents });

// 3. JSON Schema
const schema: ISchema = {
  type: "object",
  properties: {
    name: { type: "string", title: "Name", "x-component": "TextField", "x-decorator": "FormItem" },
    customer: {
      type: "string", title: "Customer",
      "x-component": "LookupField", "x-decorator": "FormItem",
      "x-component-props": { objectId: 5, displayField: "name" },
      "x-reactions": {
        dependencies: ["type"],
        when: "{{$values.type === 'vip'}}",
        fulfill: { state: { visible: true } },
        otherwise: { state: { visible: false } },
      },
    },
  },
};

// 4. 渲染
<FormProvider form={form}>
  <SchemaField schema={schema} />
</FormProvider>

// 5. 读取值
const values = form.values;
const errs = await form.validate();
form.setValues({ ...values, _name: "Alice" });
form.subscribe(({ values }) => saveDraft(formId, values));
form.setFieldState("customer", state => state.dataSource = [{ id: 1, label: "Alice" }]);
```

## 测试结果

| 测试 | 数量 | 状态 |
|---|---|---|
| 前端单测 (含 schemaAdapter 46 + preserveFormValues 21 + ... ) | 167 | ✓ |
| 后端单测 | 157 | ✓ |
| TypeScript 检查 | 0 errors | ✓ |
| Vite production build | OK (6.35s, 756 KB gzip) | ✓ |
| F1.4 lookup dropdown e2e | 13 | ✓ |
| F1.5+ Formily 集成 e2e | 12 | ✓ |
| F1.6 reactions visibleWhen e2e | 14 | ✓ |
| **合计 e2e** | **39** | ✓ |

## 删除/合并

| 旧 | 新 |
|---|---|
| `src/pages/PublicForm.tsx` (旧自研) | `src/pages/PublicForm.tsx` (Formily 重写) — 同名覆盖 |
| `src/pages/PublicFormV2.tsx` (试验田) | 已删除 (rename 后再合并到 PublicForm.tsx) |
| 路由 `/public/formV2/:appId` | 已删除 |
| 路由 `/public/form/:appId` | 保持, 但内部走 Formily 组件 |

## 保留的非 Formily 部分

- **`LookupDropdown`** (src/components/LookupDropdown.tsx)：是底层"lookup 选项下拉"组件，Formily `LookupField` 是它的薄包装。保留 LookupDropdown 让 Formily 之外（如 dashboard 编辑器）也能用
- **联系信息 _name/_email Input**：Formily SchemaField 处理校验很重，而 _name/_email 是表单外的 2 个简单 Input，沿用 controlled Input 保持简洁
- **品牌 Hero + 提交成功页**：非表单区域，沿用 V1 设计（Badge / 卡片 / 按钮）
- **`preserveFormValues` 工具集**：纯函数（草稿序列化、computeResubmitValues、computeResetValues）— 不属于渲染层，Formily 之外复用

## 后续优化

1. **Formily 自研 custom validator**（手机号格式、身份证格式）— 用 `x-validator: (value) => {...}`
2. **x-reactions 联动 required** — 选 lookup 后联动其他字段变必填
3. **Formily effects onFieldValueChange** — 选 lookup 后异步拉目标对象更多数据填其他字段
4. **动态 SchemaField** — FormField 拖入时通过 form.setFieldState 注入新 field（设计器场景）
5. **schemaAdapter 支持嵌套字段** (sections 内子 sections)

## 兼容性

- **后端契约 100% 不变**：仍调用 `/api/public/forms/:formId`, `/api/public/forms/:formId/lookup-options`, `/api/public/forms/:formId/submit`
- **schemaJson 兼容**：V1 schema 直接喂给 schemaAdapter，无需后端改
- **前端路由不变**：用户收藏 `/public/form/X?formId=Y` 仍然有效
- **草稿格式不变** (v1, 24h TTL)：用户既有草稿可继续恢复