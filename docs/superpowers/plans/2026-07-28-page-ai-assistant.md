# Page-Level AI Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable 380–400px AI chat workspace to every Portal page that currently exposes an “AI 助手” button, while keeping each page's employee configuration, messages, and session isolated.

**Architecture:** `@mate/shared` will provide reusable presentational components plus an instance-local `usePageAssistant` hook. Each Portal page creates its own controller, wraps its existing content in `AIAssistantWorkspace`, and connects its existing button through `AIAssistantTrigger`; there is no Context, global store, or cross-route session state.

**Tech Stack:** React 19, TypeScript 5.7 strict mode, lucide-react, nanoid, CSS using existing Mate theme variables, Playwright E2E, pnpm/Vite.

---

## File map

**Create**

- `metaplatform-frontend/packages/shared/src/components/assistant/types.ts` — public configuration, message, and controller contracts.
- `metaplatform-frontend/packages/shared/src/components/assistant/usePageAssistant.ts` — instance-local session/message state and simulated reply lifecycle.
- `metaplatform-frontend/packages/shared/src/components/assistant/AIAssistantPanel.tsx` — accessible chat header, welcome state, messages, suggestions, thinking indicator, and composer.
- `metaplatform-frontend/packages/shared/src/components/assistant/AIAssistantWorkspace.tsx` — side-by-side page layout and panel mounting.
- `metaplatform-frontend/packages/shared/src/components/assistant/AIAssistantTrigger.tsx` — consistent AI entry button and active state.
- `metaplatform-frontend/packages/shared/src/components/assistant/assistant.css` — 400px/380px layout, message styling, themes, motion, and focus states.
- `metaplatform-frontend/packages/shared/src/components/assistant/index.ts` — assistant feature exports.
- `metaplatform-frontend/tests/e2e/ai-assistant.spec.ts` — opening, shrinking, chat input, clear, close, and module isolation coverage.

**Modify**

- `metaplatform-frontend/packages/shared/src/index.ts` — export the assistant feature.
- `metaplatform-frontend/apps/portal/src/pages/arch/ArchBusinessPage.tsx` — architecture employee/session integration.
- `metaplatform-frontend/apps/portal/src/pages/apps/AppsListPage.tsx` — application-design employee/session integration.
- `metaplatform-frontend/apps/portal/src/pages/ontology/OntologyModelingPage.tsx` — ontology-modeling employee/session integration.
- `metaplatform-frontend/apps/portal/src/pages/ontology/OntologyDatacenterPage.tsx` — ontology-data employee/session integration.
- `metaplatform-frontend/apps/portal/src/pages/knowledge/KnowledgeBasePage.tsx` — knowledge-governance employee/session integration.
- `metaplatform-frontend/apps/portal/src/pages/mcp/McpToolsPage.tsx` — MCP-tools employee/session integration.

## Task 1: Add a failing browser contract for the first page

**Files:**
- Create: `metaplatform-frontend/tests/e2e/ai-assistant.spec.ts`

- [ ] **Step 1: Write the authentication setup and the failing architecture-page test**

```ts
import { expect, test } from '@playwright/test';

const portalUrl = process.env.PORTAL_E2E_URL ?? 'http://localhost:9200';

async function authenticate(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('mate_platform_token', 'e2e-token');
    localStorage.setItem('mate_platform_user', JSON.stringify({
      id: 'e2e-user',
      username: 'e2e',
      realName: 'E2E User',
      tenantId: 'default',
      roles: ['admin'],
    }));
  });
}

test.describe('page-level AI assistant', () => {
  test.beforeEach(async ({ page }) => authenticate(page));

  test('opens beside business architecture content and preserves messages while closed', async ({ page }) => {
    await page.goto(`${portalUrl}/arch`);
    const content = page.getByTestId('assistant-page-content');
    const before = await content.boundingBox();

    await page.getByRole('button', { name: /AI 助手/ }).click();
    const panel = page.getByTestId('ai-assistant-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-employee-id', 'architecture-planner');

    const panelBox = await panel.boundingBox();
    const after = await content.boundingBox();
    expect(panelBox?.width).toBeGreaterThanOrEqual(380);
    expect(panelBox?.width).toBeLessThanOrEqual(400);
    expect(after!.width).toBeLessThan(before!.width - 350);

    const composer = page.getByLabel('向架构规划数字员工发送消息');
    await composer.fill('帮我分析当前业务架构');
    await composer.press('Enter');
    await expect(page.getByText('帮我分析当前业务架构', { exact: true })).toBeVisible();
    await expect(page.getByText('正在思考')).toBeVisible();
    await expect(page.getByTestId('assistant-message-assistant').last()).toBeVisible();

    await page.getByRole('button', { name: '关闭 AI 助手' }).click();
    await expect(panel).not.toBeVisible();
    await page.getByRole('button', { name: /AI 助手/ }).click();
    await expect(page.getByText('帮我分析当前业务架构', { exact: true })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test and verify the contract is red**

Run from `metaplatform-frontend` while Portal is available on port 9200:

```powershell
$env:PORTAL_E2E_URL='http://localhost:9200'; pnpm exec playwright test tests/e2e/ai-assistant.spec.ts --project=portal --grep "opens beside"
```

Expected: FAIL because `assistant-page-content` / `ai-assistant-panel` do not exist and the current button has no click behavior.

- [ ] **Step 3: Commit the red test**

```powershell
git add metaplatform-frontend/tests/e2e/ai-assistant.spec.ts
git commit -m "test: define page AI assistant interaction contract"
```

## Task 2: Build the reusable page-local assistant primitives

**Files:**
- Create: `metaplatform-frontend/packages/shared/src/components/assistant/types.ts`
- Create: `metaplatform-frontend/packages/shared/src/components/assistant/usePageAssistant.ts`
- Create: `metaplatform-frontend/packages/shared/src/components/assistant/AIAssistantPanel.tsx`
- Create: `metaplatform-frontend/packages/shared/src/components/assistant/AIAssistantWorkspace.tsx`
- Create: `metaplatform-frontend/packages/shared/src/components/assistant/AIAssistantTrigger.tsx`
- Create: `metaplatform-frontend/packages/shared/src/components/assistant/assistant.css`
- Create: `metaplatform-frontend/packages/shared/src/components/assistant/index.ts`
- Modify: `metaplatform-frontend/packages/shared/src/index.ts`

- [ ] **Step 1: Define stable public types**

```ts
import type { ReactNode } from 'react';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface PageAssistantConfig {
  employeeId: string;
  employeeName: string;
  employeeAvatar?: ReactNode;
  employeeDescription: string;
  moduleLabel: string;
  welcomeMessage: string;
  suggestions: string[];
  createReply?: (content: string) => string;
  replyDelayMs?: number;
}

export interface PageAssistantController extends PageAssistantConfig {
  isOpen: boolean;
  sessionId: string;
  messages: AssistantMessage[];
  isThinking: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  sendMessage: (content: string) => void;
  clearSession: () => void;
}
```

- [ ] **Step 2: Implement an instance-local hook with cleanup**

Use `nanoid(8)` for session/message suffixes, trim blank input, set `isThinking`, append one simulated assistant message after `replyDelayMs ?? 650`, and clear pending timers on unmount or `clearSession`. `clearSession` must generate a new `${employeeId}-${nanoid(10)}` value. Do not use Context, module-level mutable state, localStorage, or Zustand.

```ts
const createSessionId = (employeeId: string) => `${employeeId}-${nanoid(10)}`;
const defaultReply = (employeeName: string, content: string) =>
  `${employeeName}已收到你的问题：“${content}”。当前为界面演示，后续将接入该模块对应的数字员工服务。`;
```

Return a `PageAssistantController` whose config values are copied from the hook argument.

- [ ] **Step 3: Implement `AIAssistantTrigger`**

The component must render the current AI avatar treatment, expose `aria-expanded`, `aria-controls="page-ai-assistant"`, `aria-label="AI 助手"`, and set both `v-btn` and `ai-assistant-trigger--active` while open. The button calls the page controller's `toggle` callback.

- [ ] **Step 4: Implement the panel UI**

`AIAssistantPanel` receives `{ assistant: PageAssistantController }`, keeps only the draft text locally, and renders:

```tsx
<aside
  id="page-ai-assistant"
  className="ai-assistant-panel"
  data-testid="ai-assistant-panel"
  data-employee-id={assistant.employeeId}
  aria-label={`${assistant.employeeName}聊天区域`}
>
  {/* header: avatar, name, 在线, moduleLabel, clear and close buttons */}
  {/* scrollable welcome/messages/suggestions area */}
  {/* textarea and send button */}
</aside>
```

Composer behavior:

```ts
if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
  event.preventDefault();
  submit();
}
```

Set the textarea accessible name to `向${employeeName}发送消息`. Mark message containers with `data-testid="assistant-message-user"` or `assistant-message-assistant`. Auto-scroll the message viewport when message count or `isThinking` changes.

- [ ] **Step 5: Implement the side-by-side workspace**

```tsx
export default function AIAssistantWorkspace({ assistant, children }: PropsWithChildren<{ assistant: PageAssistantController }>) {
  return (
    <div className={`ai-assistant-workspace${assistant.isOpen ? ' ai-assistant-workspace--open' : ''}`}>
      <div className="ai-assistant-workspace__content" data-testid="assistant-page-content">
        {children}
      </div>
      <div className="ai-assistant-workspace__aside" aria-hidden={!assistant.isOpen}>
        <AIAssistantPanel assistant={assistant} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Add theme-aligned CSS**

Implement these layout invariants in `assistant.css`:

```css
.ai-assistant-workspace { display:flex; flex:1; width:100%; min-width:0; min-height:0; overflow:hidden; }
.ai-assistant-workspace__content { display:flex; flex:1 1 auto; min-width:0; min-height:0; }
.ai-assistant-workspace__aside { flex:0 0 auto; width:0; min-width:0; opacity:0; overflow:hidden; pointer-events:none; transition:width .2s ease, opacity .2s ease; }
.ai-assistant-workspace--open .ai-assistant-workspace__aside { width:400px; opacity:1; pointer-events:auto; }
.ai-assistant-panel { width:400px; height:100%; min-height:0; display:flex; flex-direction:column; border-left:1px solid var(--border); background:var(--card); }
@media (max-width:1280px) {
  .ai-assistant-workspace--open .ai-assistant-workspace__aside,
  .ai-assistant-panel { width:380px; }
}
@media (prefers-reduced-motion:reduce) {
  .ai-assistant-workspace__aside { transition:none; }
}
```

Add focused class rules for header, avatar, status, message bubbles, suggestion buttons, thinking dots, composer, active trigger, focus-visible states, and hidden panel visibility. Use existing variables such as `--background`, `--card`, `--border`, `--foreground`, `--muted`, `--muted-foreground`, `--success`, and `--primary`.

- [ ] **Step 7: Export the feature and run TypeScript checks**

`components/assistant/index.ts` exports all four runtime modules and public types. `packages/shared/src/index.ts` adds:

```ts
export * from './components/assistant';
```

Run:

```powershell
pnpm --filter @mate/portal typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 8: Commit shared primitives**

```powershell
git add metaplatform-frontend/packages/shared/src/components/assistant metaplatform-frontend/packages/shared/src/index.ts
git commit -m "feat: add reusable page AI assistant components"
```

## Task 3: Integrate the business architecture page and make the first test green

**Files:**
- Modify: `metaplatform-frontend/apps/portal/src/pages/arch/ArchBusinessPage.tsx:1-15,138-260,548-555`
- Test: `metaplatform-frontend/tests/e2e/ai-assistant.spec.ts`

- [ ] **Step 1: Import the common feature and create the page controller**

Add imports for `AIAssistantTrigger`, `AIAssistantWorkspace`, and `usePageAssistant`, then create this controller inside `ArchBusinessPage`:

```ts
const assistant = usePageAssistant({
  employeeId: 'architecture-planner',
  employeeName: '架构规划数字员工',
  employeeDescription: '协助分析业务能力、流程分层与架构演进关系。',
  moduleLabel: '业务架构',
  welcomeMessage: '你好，我是架构规划数字员工。可以帮你分析 L1-L4 业务架构及其演进关系。',
  suggestions: ['分析当前业务能力短板', '梳理 L1 到 L4 的依赖关系', '给出下一阶段架构演进建议'],
  createReply: (content) => `我会结合当前业务架构视图分析“${content}”。当前为模拟回复，重点会覆盖能力、流程和业务对象之间的关系。`,
});
```

- [ ] **Step 2: Wrap existing page JSX without changing its internal behavior**

```tsx
return (
  <AIAssistantWorkspace assistant={assistant}>
    <>
      {/* existing style block, page content, and process Drawer */}
    </>
  </AIAssistantWorkspace>
);
```

The existing process detail `<Drawer>` remains inside the page fragment. Its open/expanded state must not share assistant state.

- [ ] **Step 3: Replace only the AI button**

```tsx
<AIAssistantTrigger open={assistant.isOpen} onClick={assistant.toggle} />
```

Keep “展开全部” and every layer/process action unchanged.

- [ ] **Step 4: Run the focused Playwright test**

```powershell
$env:PORTAL_E2E_URL='http://localhost:9200'; pnpm exec playwright test tests/e2e/ai-assistant.spec.ts --project=portal --grep "opens beside"
```

Expected: PASS. The panel width is 380–400px, content shrinks, sending produces thinking then a reply, closing hides the panel, and reopening preserves the user message.

- [ ] **Step 5: Commit the first integration**

```powershell
git add metaplatform-frontend/apps/portal/src/pages/arch/ArchBusinessPage.tsx metaplatform-frontend/tests/e2e/ai-assistant.spec.ts
git commit -m "feat: add architecture page AI assistant"
```

## Task 4: Integrate the other five independent employees

**Files:**
- Modify: `metaplatform-frontend/apps/portal/src/pages/apps/AppsListPage.tsx`
- Modify: `metaplatform-frontend/apps/portal/src/pages/ontology/OntologyModelingPage.tsx`
- Modify: `metaplatform-frontend/apps/portal/src/pages/ontology/OntologyDatacenterPage.tsx`
- Modify: `metaplatform-frontend/apps/portal/src/pages/knowledge/KnowledgeBasePage.tsx`
- Modify: `metaplatform-frontend/apps/portal/src/pages/mcp/McpToolsPage.tsx`

- [ ] **Step 1: Integrate the application list**

Use:

```ts
{
  employeeId: 'application-designer',
  employeeName: '应用设计数字员工',
  employeeDescription: '协助规划应用类型、数据模型、流程和发布方案。',
  moduleLabel: '应用中心',
  welcomeMessage: '你好，我是应用设计数字员工。可以从业务需求出发协助你规划应用。',
  suggestions: ['根据业务需求推荐应用类型', '梳理应用发布前检查项', '分析现有应用组合'],
}
```

Wrap the existing root in `AIAssistantWorkspace` and replace only its AI button with `AIAssistantTrigger`.

- [ ] **Step 2: Integrate Ontology modeling**

Use `employeeId: 'ontology-modeler'`, name `本体建模数字员工`, module `Ontology 建模`, and suggestions covering concept design, relationship modeling, and model validation.

- [ ] **Step 3: Integrate Ontology data center**

Use `employeeId: 'ontology-data-steward'`, name `本体数据数字员工`, module `Ontology 数据中心`, and suggestions covering entity quality, relationship completeness, and data synchronization.

- [ ] **Step 4: Integrate the knowledge base**

Use `employeeId: 'knowledge-governor'`, name `知识治理数字员工`, module `知识库`, and suggestions covering document ingestion, retrieval quality, and index maintenance.

- [ ] **Step 5: Integrate MCP tools**

Use `employeeId: 'mcp-tool-specialist'`, name `MCP 工具数字员工`, module `MCP 工具注册`, and suggestions covering tool schema, permissions, and debugging.

Each step uses a page-specific `createReply` string that names the module. Do not extract these six business configurations into a global map: keeping the configuration adjacent to its page preserves employee ownership.

- [ ] **Step 6: Run typecheck and build**

```powershell
pnpm --filter @mate/portal typecheck
pnpm --filter @mate/portal build
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit the remaining page integrations**

```powershell
git add metaplatform-frontend/apps/portal/src/pages/apps/AppsListPage.tsx metaplatform-frontend/apps/portal/src/pages/ontology/OntologyModelingPage.tsx metaplatform-frontend/apps/portal/src/pages/ontology/OntologyDatacenterPage.tsx metaplatform-frontend/apps/portal/src/pages/knowledge/KnowledgeBasePage.tsx metaplatform-frontend/apps/portal/src/pages/mcp/McpToolsPage.tsx
git commit -m "feat: add independent AI assistants to portal modules"
```

## Task 5: Cover keyboard, clear-session, and module isolation behavior

**Files:**
- Modify: `metaplatform-frontend/tests/e2e/ai-assistant.spec.ts`

- [ ] **Step 1: Add a keyboard and clear-session test**

The test must:

1. open `/arch`;
2. record the panel's `data-session-id` (add that attribute to the panel if absent);
3. enter `第一行`, press `Shift+Enter`, enter `第二行`, and assert the composer contains both lines before sending;
4. press Enter and assert one user message contains both lines;
5. click `清空会话`;
6. assert the user message is gone and `data-session-id` changed.

- [ ] **Step 2: Run the new test and verify it fails before any missing attribute/behavior is added**

```powershell
$env:PORTAL_E2E_URL='http://localhost:9200'; pnpm exec playwright test tests/e2e/ai-assistant.spec.ts --project=portal --grep "keyboard and clear"
```

Expected: FAIL if `data-session-id`, multiline behavior, or clear-session behavior is incomplete.

- [ ] **Step 3: Make the minimum component adjustment and rerun**

Add `data-session-id={assistant.sessionId}` to `AIAssistantPanel` if needed. Keep clear-session behavior in the page-local hook.

Run the same command. Expected: PASS.

- [ ] **Step 4: Add an independent-employee test**

Open `/arch`, send a uniquely named message, navigate to `/knowledge`, open its AI assistant, and assert:

```ts
await expect(panel).toHaveAttribute('data-employee-id', 'knowledge-governor');
await expect(page.getByText('知识治理数字员工', { exact: true })).toBeVisible();
await expect(page.getByText(uniqueArchitectureMessage, { exact: true })).toHaveCount(0);
```

This proves that different pages render different employees and do not share current messages.

- [ ] **Step 5: Run the full assistant E2E spec**

```powershell
$env:PORTAL_E2E_URL='http://localhost:9200'; pnpm exec playwright test tests/e2e/ai-assistant.spec.ts --project=portal
```

Expected: all assistant tests PASS.

- [ ] **Step 6: Commit behavior coverage**

```powershell
git add metaplatform-frontend/tests/e2e/ai-assistant.spec.ts metaplatform-frontend/packages/shared/src/components/assistant/AIAssistantPanel.tsx
git commit -m "test: cover AI assistant session isolation"
```

## Task 6: Final verification and visual inspection

**Files:**
- Verify all files above; modify only when a check exposes a defect.

- [ ] **Step 1: Run targeted static and production checks**

```powershell
pnpm --filter @mate/portal typecheck
pnpm --filter @mate/portal build
```

Expected: both commands exit 0.

- [ ] **Step 2: Run all assistant browser tests**

```powershell
$env:PORTAL_E2E_URL='http://localhost:9200'; pnpm exec playwright test tests/e2e/ai-assistant.spec.ts --project=portal
```

Expected: all tests pass with no retries.

- [ ] **Step 3: Inspect the running Portal at desktop size**

At `http://localhost:9200/arch`, verify:

- the panel is visually 380–400px wide;
- the page content visibly shrinks instead of being covered;
- the panel reaches the usable content height;
- the header and composer remain visible while messages scroll;
- active/hover/focus states match the current dark theme;
- the existing process Drawer still opens while assistant state remains independent.

Repeat a smoke check at `/apps`, `/ontology`, `/ontology/data`, `/knowledge`, and `/mcp/tools` using the actual route definitions from `App.tsx`.

- [ ] **Step 4: Check the final diff for accidental scope**

```powershell
git diff --check
git status --short
git diff --stat HEAD~4..HEAD
```

Expected: no whitespace errors; only the assistant feature, six page integrations, E2E test, and plan/spec files are included. Pre-existing unrelated untracked files remain untouched.

- [ ] **Step 5: Commit any verification-only fixes**

Only if Step 1–3 required code changes:

```powershell
git add <only-the-files-fixed-during-verification>
git commit -m "fix: polish page AI assistant interactions"
```