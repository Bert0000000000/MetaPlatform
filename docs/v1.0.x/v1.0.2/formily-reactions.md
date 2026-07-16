# Formily x-reactions 联动实现 (F1.6)

## 目标

实现 lookup 字段选中后联动显隐其他字段 (典型场景：选了客户 → 显示 VIP 备注/忠诚度)。

## 数据模型

```typescript
// v1.0.2 Sprint 2 F1.6 新增
export type VisibleWhenOp = "eq" | "neq" | "notEmpty" | "empty";

export interface VisibleWhenRule {
  field: string;          // 依赖的字段 key
  op: VisibleWhenOp;      // 操作符
  value?: string | number | boolean;  // 期望值 (op=eq/neq 时使用)
}

// MetaField 加可选字段
interface MetaField {
  ...
  visibleWhen?: VisibleWhenRule | VisibleWhenRule[];  // 多规则 AND 组合
}
```

### 操作符

| op | 表达式 | 说明 |
|---|---|---|
| `eq` | `$values.field === value` | 等于（值匹配） |
| `neq` | `$values.field !== value` | 不等于 |
| `notEmpty` | `field !== undefined && field !== null && field !== ''` | 非空 |
| `empty` | `field === undefined \|\| field === null \|\| field === ''` | 空 |

## Schema 转换

`schemaAdapter.visibleWhenToReactions()` 把 `visibleWhen` 转 Formily `x-reactions`：

```typescript
// 输入
visibleWhen: [
  { field: "country", op: "eq", value: "CN" },
  { field: "tier", op: "notEmpty" },
]

// 输出 (Formily JSON Schema x-reactions)
{
  dependencies: ["country", "tier"],
  when: "{{$values.country === \"CN\" && ($values.tier !== undefined && $values.tier !== null && $values.tier !== '')}}",
  fulfill: { state: { visible: true } },
  otherwise: { state: { visible: false } },
}
```

## 组件层响应

`FormItem` 用 `connect` + `useField` 读 `field.visible`：

```typescript
export const FormItem: React.FC = connect(
  (props) => {
    const field = useField();
    const visible = field?.visible === false ? false : true;
    return <FormItemInner {...props} visible={visible} />;
  },
  mapProps((props, field) => ({
    title: props.title,
    description: props.description,
    required: field?.required ?? props.required,
    errors: field?.errors ?? props.errors,
  })),
);
```

`visible === false` 时返回 `null` 隐藏整个字段。

## 完整数据流

```
1. 后端 schemaJson 存 visibleWhen:
   {
     "field": "vip_remark", "widget": "input",
     "visibleWhen": { "field": "customer_ref", "op": "notEmpty" }
   }

2. 前端 PublicFormV2 拉 schema:
   GET /api/public/forms/{formId} -> schemaJson

3. schemaAdapter.sectionToFormilySchema() 生成 Formily JSON Schema:
   properties.vip_remark = {
     type: "string", title: "VIPRemark",
     "x-component": "TextField", "x-decorator": "FormItem",
     "x-reactions": {
       dependencies: ["customer_ref"],
       when: "{{$values.customer_ref !== undefined && ...}}",
       fulfill: { state: { visible: true } },
       otherwise: { state: { visible: false } },
     }
   }

4. SchemaField 渲染 → Formily 自动创建 field 实例

5. 用户选 lookup (customer_ref = 5) → form.values.customer_ref = 5
   → Formily 反应式系统触发 x-reactions
   → field("vip_remark").visible = true
   → FormItem 重渲染 (因为 visible 变了)
   → vip_remark 显示

6. 用户清空 lookup → customer_ref = ""
   → x-reactions otherwise 分支
   → field("vip_remark").visible = false
   → FormItem 返回 null
   → vip_remark 隐藏
```

## lookup 联动特殊点

lookup 字段在表单里**值是 FK ID (number)**，不是 displayField 的字符串。
`op=eq` 时 designer 配置 value 应该用 FK ID：

```typescript
visibleWhen: { field: "customer_ref", op: "eq", value: 5 }   // 5 是 customer 表的主键
```

`op=notEmpty` 是最常用：选了任意 customer 就显示其他字段。

## 测试覆盖

| 测试 | 数量 | 状态 |
|---|---|---|
| `schemaAdapter.test.ts` (visibleWhenToExpression) | 7 | ✓ |
| `schemaAdapter.test.ts` (visibleWhenToReactions) | 5 | ✓ |
| `schemaAdapter.test.ts` (fieldToSchema with visibleWhen) | 4 | ✓ |
| `schemaAdapter.test.ts` (合计) | 46 | ✓ |
| 前端全量单测 | 167 | ✓ |
| 后端全量单测 | 157 | ✓ |
| TypeScript 检查 | 0 errors | ✓ |
| Vite production build | OK (6.42s) | ✓ |
| F1.6 联动 e2e | 14 | ✓ |

## E2E 验证场景

| 场景 | 验证点 |
|---|---|
| visibleWhen rule 透传 (单规则) | vip_remark.visibleWhen.field=customer_ref op=notEmpty |
| visibleWhen 多规则 (AND) 透传 | loyalty.visibleWhen 是 array of 2 rules |
| lookup 必填规则透传 | customer_ref.required=true |
| submit 包含 lookup + visibleWhen 字段 | 后端接受 + listInstances 解析 lookup |
| 联动表达式生成 | `dependencies: [customer_ref]`, when: `$values.customer_ref !== undefined...` |

## 已知限制 / 后续扩展

1. **op=gt/gte/lt/lte/in** (数值/枚举范围) 暂未实现 — F1.7+ 加
2. **x-reactions 触发 required 联动** (选某 lookup 字段变必填) — 同 mechanism, 改 `state.required`
3. **跨字段异步联动** (选 lookup 后异步拉目标对象的字段填充其他字段) — 用 form.effects onFieldValueChange, F1.7+
4. **FormLowCodeEditor 加 visibleWhen 编辑 UI** — P1 任务

## 示例 schema 配置

```typescript
const formSchema = {
  sections: [{
    fields: [
      { field: "type", widget: "select", label: "Type",
        options: [{label:"VIP",value:"vip"},{label:"Standard",value:"std"}] },
      { field: "country", widget: "select", label: "Country",
        options: [{label:"China",value:"CN"},{label:"USA",value:"US"}] },
      // 显示规则 1: type === "vip" 才显示 VIP 折扣
      { field: "vip_discount", widget: "number", label: "VIP Discount",
        visibleWhen: { field: "type", op: "eq", value: "vip" } },
      // 显示规则 2: 选了 customer (lookup) 才显示
      { field: "customer_note", widget: "longtext", label: "Customer Note",
        visibleWhen: { field: "customer_ref", op: "notEmpty" } },
      // 显示规则 3: country=CN + 选了 customer 才显示国内地址
      { field: "domestic_addr", widget: "text", label: "国内地址",
        visibleWhen: [
          { field: "country", op: "eq", value: "CN" },
          { field: "customer_ref", op: "notEmpty" },
        ]},
    ]
  }]
};
```