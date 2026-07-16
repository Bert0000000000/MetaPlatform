# ListPageEditor Formily 化 — v1.0.2 Sprint 2

> F1.5 ~ F1.10 一并实现, 单 PR 完成. 基于 [Formily 2 集成](./formily-integration.md) 与 [Formily x-reactions](./formily-reactions.md) 的能力.

## 1. 背景

ListPageEditor (列表页编辑器) 原本只支持"读全表 + 单条件筛选 + 列头排序 + CSV 导出"。Sprint 2 F1.5-F1.10 重写为:

| 任务  | 范围                                                              |
| ----- | ----------------------------------------------------------------- |
| F1.5  | 全局搜索 (顶部 Search 输入框 + 列过滤)                            |
| F1.6  | 列头点击切换排序: `none → asc → desc → none`                       |
| F1.7  | **9 种**过滤操作符: `eq / neq / gt / gte / lt / lte / contains / empty / in` |
| F1.8  | 列设置面板: 列显示/隐藏                                            |
| F1.9  | CSV 导出按钮 (复用过滤器/排序)                                     |
| F1.10 | URL 同步: `?filter_<field>=<opValue> & sort=<expr> & page=N & size=N` |

技术上全部用 Formily 2 (`connect + mapProps` 接入自研 `<FilterRow>`); 通过 `useSearchParams` 双向同步.

## 2. 文件清单

| 文件                                                                              | 行数  | 角色                                      |
| --------------------------------------------------------------------------------- | ----- | ----------------------------------------- |
| `metaplatform-frontend/src/components/formily/FilterRow.tsx`                      | ~160  | 过滤器行组件 (Formily connect)            |
| `metaplatform-frontend/src/components/formily/filterSerializer.ts`                | ~180  | 9 操作符 + URL 双向序列化纯函数            |
| `metaplatform-frontend/src/components/formily/filterSerializer.test.ts`           | 37 单测 | 序列化 / 反序列化 / op 渲染               |
| `metaplatform-frontend/src/pages/apps/editors/ListPageEditor.tsx`                | ~600  | F1.5-F1.10 一并重写                        |
| `tools/m3-e2e-f15-listfilter.ps1`                                                 | ~200  | 16 个 e2e 用例                            |
| `metaplatform-app-service/.../FilterParser.java`                                  | 115   | 后端纯函数 (B1.4 已就位)                  |
| `metaplatform-app-service/.../FilterParserTest.java`                              | 8+   | 后端 9 操作符单测                         |

合计前端单测 **204** (含 FilterRow/filterSerializer 37 个新增) + 后端单测 **>=8** + e2e **16** 个.

## 3. FilterRow — Formily 自研组件接入

```tsx
// FilterRow.tsx
export function FilterOpSelect({ value, onChange, disabled }: FilterOpSelectProps) {
  const field = useField<Field>(undefined, { propsToDeps: [] });
  // ... 渲染 9 种 FilterOp 下拉
}
FilterOpSelect = connect(FilterOpSelect, mapProps({ value: true, onChange: true, disabled: true }));

export function FilterValueInput({ value, onChange, disabled, visible }: FilterValueInputProps) {
  const field = useField();
  // x-reactions: 当 op='empty' 时, 整个 ValueInput 不可见
  // 由父组件 FilterRow 接收 visible prop 控制
  if (!visible) return null;
  return <Input value={value} onChange={...} disabled={disabled} />;
}
FilterValueInput = connect(FilterValueInput, mapProps({
  value: true,
  onChange: true,
  disabled: true,
  visible: true,  // Formily schema 通过 x-reactions 注入
}));
```

**为什么用 `connect + mapProps`**: 过滤器行不是 Formily `<SchemaField>` 内的字段 — 它是 ListPageEditor 父组件**自有状态** (URL 反序列化而来). 通过 `connect` 让 Input/Select 自动响应 Formily `field.setValue` 调用, 而**不需要**把它们登记到 `SchemaField` 的 components 字典里.

## 4. x-reactions: op=empty 时隐藏 value 输入

`FilterRow` 内部把"op 是否需要 value"用 `opTakesValue(op)` 算出 `valueVisible: boolean`, 然后通过 `connect(mapProps({ visible: ... }))` 传给 `FilterValueInput`:

```tsx
// FilterRow.tsx 核心
const valueVisible = op !== 'empty';

<FilterValueInput
  value={value}
  onChange={(v) => onChange({ field, op, value: v })}
  visible={valueVisible}
/>
```

Formily 收到 `visible=false` 后, `FilterValueInput` 返回 `null`, 实现"切换到 empty 时 value 输入自动隐藏"的效果.

**为什么不直接用 schema `x-reactions`**:
- FilterRow 是 ListPageEditor 父组件**驱动**的 UI (URL ↔ React state), 不是 schema 驱动的表单.
- 用 `useField` + `mapProps(visible)` 已经足够, 无需引入 SchemaField 上下文.
- 这种用法是 Formily 推荐模式: **connect 注入任意 prop, 让自研组件成为 Formily-兼容组件**.

## 5. URL 双向同步 — useSearchParams

```tsx
const [searchParams, setSearchParams] = useSearchParams();

// 反向: URL → state (首次 + 监听)
useEffect(() => {
  const parsed = parseListUrlQuery(searchParams);
  if (parsed.sort.length > 0) setSort(parsed.sort);
  if (Object.keys(parsed.filters).length > 0) setFilters(parsed.filters);
  ...
}, [searchParams]);

// 正向: state → URL
useEffect(() => {
  const next = buildListUrlQuery(sort, filters, page, size);
  const cur = new URLSearchParams(searchParams);
  let changed = false;
  for (const k of Object.keys(next)) {
    if (cur.get(k) !== next[k]) { cur.set(k, next[k]); changed = true; }
  }
  // 删除已不存在的 filter_* 键
  cur.forEach((_, k) => {
    if (k.startsWith('filter_') && !(k in next)) { cur.delete(k); changed = true; }
  });
  if (changed) setSearchParams(cur, { replace: true });
}, [sort, filters, page, size]);
```

**注意**:
- 使用 `replace: true` 而非 push, 避免每次排序都污染浏览器历史栈.
- 用 `useRef(false)` 标记是否已初次反序列化, 防止首次加载时反向/正向 effect 互相覆盖.

## 6. URL 编码格式

| 操作符  | filter_<field> 编码         | 后端 FilterParser 解析                |
| ------- | --------------------------- | -------------------------------------- |
| eq      | `filter_status==active`     | `status` + `=active`                   |
| neq     | `filter_status=!=inactive`  | `status` + `!=inactive`                |
| gt      | `filter_price=>1000`        | `price` + `>1000`                      |
| gte     | `filter_price=>=999`        | `price` + `>=999`                      |
| lt      | `filter_price=<50`          | `price` + `<50`                        |
| lte     | `filter_price=<=15`         | `price` + `<=15`                       |
| contains | `filter_name=~Pro`        | `name` + `LIKE %Pro%`                  |
| empty   | `filter_quantity=:`         | `quantity IS NULL` (无值)              |
| in      | `filter_category=in(elec,toys)` | `category IN (?, ?)` 占位符       |
| sort    | `sort=price,-name`          | `ORDER BY price ASC, name DESC`        |

**URL 编码陷阱** (e2e 调试发现):
- ❌ `category%3Din%28elec%2Ctoys%29` — 把第一个 `=` 也编码 → Spring 把整个字符串当作 column key → 400
- ✅ `category=in%28elec%2Ctoys%29` — 只编码 `(` `)` `,` → Spring 用第一个 `=` 拆分为 key=`category`, value=`in(elec,toys)`

**规则**: column/value 分隔的 `=` 必须**裸**; 值里的特殊字符才编码. 这与 [RFC 3986](https://tools.ietf.org/html/rfc3986#section-3.4) 一致 (sub-delims `(` `)` `,` 应编码, `=` 在 query value 里保留意义).

## 7. 后端 FilterParser — 9 操作符 SQL 生成

```java
public static FilterClause parse(String column, String expression) {
    if (!IDENT_PATTERN.matcher(column).matches())
        throw ApiException.badRequest("非法过滤列: " + column);
    if (expression == null || expression.isBlank()) return null;

    if (expression.startsWith("!="))  return new FilterClause(column + " != ?", List.of(expression.substring(2)));
    if (expression.startsWith(">="))  return new FilterClause(column + " >= ?", List.of(expression.substring(2)));
    if (expression.startsWith("<="))  return new FilterClause(column + " <= ?", List.of(expression.substring(2)));
    if (expression.startsWith("in(") && expression.endsWith(")")) {
        // 拆分 in(elec,toys) → in(?, ?) 占位符
        String inside = expression.substring(3, expression.length() - 1);
        for (String p : inside.split(",")) {
            if (p.contains("'")) throw ApiException.badRequest("in 表达式值不能包含单引号");
        }
        String placeholders = String.join(",", Collections.nCopies(parts.length, "?"));
        return new FilterClause(column + " IN (" + placeholders + ")", Arrays.asList(parts));
    }

    String op = expression.substring(0, 1);
    String value = expression.substring(1);
    return switch (op) {
        case ">" -> value.startsWith("=") ? ... : ...;
        case "<" -> ...;
        case "=" -> new FilterClause(column + " = ?", List.of(value));
        case "~" -> new FilterClause(column + " LIKE ?", List.of("%" + value + "%"));
        case ":" -> new FilterClause(column + " IS NULL", List.of());
        default  -> new FilterClause(column + " = ?", List.of(expression));
    };
}
```

**防 SQL 注入**:
1. 列名白名单 `^[a-z][a-z0-9_]{0,62}$`
2. 所有值通过 `PreparedStatement ?` 占位符
3. IN 操作符额外校验值不含单引号

## 8. e2e — `tools/m3-e2e-f15-listfilter.ps1`

16 个用例:

| #   | 场景                        | 期望                       |
| --- | --------------------------- | -------------------------- |
| a   | 全量                        | total=8                    |
| b   | eq status=active            | 6 rows                     |
| c   | neq status!=inactive        | 6 rows 全 active           |
| d   | gt price>1000               | 1 row MacBook Pro          |
| e   | gte price>=999              | 2 rows                     |
| f   | lt price<50                 | 3 rows                     |
| g   | lte price<=15               | 1 row Toy Car              |
| h   | contains name~Pro           | 1 row MacBook Pro          |
| i   | empty                       | FilterParserTest 单元覆盖  |
| j   | in(elec,toys)               | 5 rows                     |
| k   | sort=price asc              | 升序                       |
| l   | sort=-price desc            | 降序                       |
| m   | multi-sort category,-price  | cat asc 内 price desc      |
| n   | combo filter + sort         | active + price desc        |
| o   | 非法列名 BADCOLUMN=x        | 400                        |
| p   | DROP TABLE 注入             | 400 (PreparedStatement 拦) |

跑通:

```powershell
PS D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform> powershell -NoProfile -ExecutionPolicy Bypass -File tools/m3-e2e-f15-listfilter.ps1
==> F1.5-F1.10 ListPageEditor e2e
[PASS] (a) full: total=8
[PASS] (b) eq active: 6 rows
...
[PASS] (p) DROP TABLE injection: rejected
==> F1.5-F1.10 ALL TESTS PASSED
```

## 9. 已知 / 未来

- **全局搜索** (顶部 Search input) 当前 disabled — F1.5 把"全字段 LIKE"折叠到 F1.7 过滤器的 contains 操作符, 避免重复 UI. 后续 Sprint 可做"跨字段 OR" 全局搜索 (目前是 AND).
- **列头 inline filter** (每列下方的"过滤..." 输入框) 默认绑定 contains 操作符, 简化快速过滤场景.
- **空操作符 empty**: 数量/价格等 NOT NULL 字段无 NULL 行可测, 故 e2e 跳过, 引用 FilterParserTest 单测覆盖 SQL 生成.

## 10. 单测覆盖

```bash
# 前端
cd metaplatform-frontend && pnpm vitest run
# 204 passed (FilterRow + filterSerializer + schemaAdapter + 既有)
# TS: tsc --noEmit 0 errors
# Build: vite build OK (gzip 758 KB)

# 后端
cd metaplatform-app-service && mvn test -Dtest=FilterParserTest
# 8+ tests, all green
```

## 11. 与 Formily 2 集成的统一视图

| 组件                | Formily 角色              | 接入方式              |
| ------------------- | ------------------------- | --------------------- |
| `FormItem`          | decorator                 | `connect(mapReadPretty(FormItem))` |
| `TextField` 等基础  | component                 | `connect(mapProps(...))` |
| `LookupField`       | component (F1.4)          | `connect(mapProps(...))` + 远端加载 |
| `FilterRow` (本任务) | 自研 + Formily-兼容       | `connect(mapProps({ visible }))`    |

`ListPageEditor` 是首个**完全 Formily-化**的列表型编辑器: 列设置/过滤器 UI 都遵循 Formily 范式 (副作用绑定 = `visible` prop, 状态来源 = React useState, URL 作为状态持久化层).