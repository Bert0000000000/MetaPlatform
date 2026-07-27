const fs = require("fs");
const path = "D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/TECH-AGENT/src/test/java/com/metaplatform/agent/runs/AgentRunServiceCompleteTest.java";
let src = fs.readFileSync(path, "utf8");
const NL = "\r\n";

// 1. Add TokenBudgetEnforcer import.
const importOld = ["import com.metaplatform.agent.events.RunEventService;", "import com.metaplatform.ont.draft.OntologyDraftService;"].join(NL);
const importNew = ["import com.metaplatform.agent.events.RunEventService;", "import com.metaplatform.ont.draft.OntologyDraftService;", "import com.metaplatform.agent.runs.dto.BudgetDto;"].join(NL);
if (!src.includes(importOld)) throw new Error("importOld not found");
src = src.replace(importOld, importNew);

// 2. Add field + update setUp to pass it.
const fieldOld = "    private AuthoringService authoringService;\n    private AgentRunService service;";
const fieldNew = "    private AuthoringService authoringService;\n    private TokenBudgetEnforcer tokenBudgetEnforcer;\n    private AgentRunService service;";
if (!src.includes(fieldOld)) throw new Error("fieldOld not found");
src = src.replace(fieldOld, fieldNew);

const setupOld = "        authoringService = Mockito.mock(AuthoringService.class);\n        // Use a real ObjectMapper for json() helper\n        var objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();\n        service = new AgentRunService(runRepository, objectMapper, runEventService, authoringService);";
const setupNew = "        authoringService = Mockito.mock(AuthoringService.class);\n        tokenBudgetEnforcer = Mockito.mock(TokenBudgetEnforcer.class);\n        // Allow all by default; specific tests override behavior.\n        Mockito.when(tokenBudgetEnforcer.check(Mockito.any(), Mockito.anyInt(), Mockito.anyLong()))\n                .thenReturn(TokenBudgetEnforcer.EnforcementResult.allowed());\n        // Use a real ObjectMapper for json() helper\n        var objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();\n        service = new AgentRunService(runRepository, objectMapper, runEventService, authoringService, tokenBudgetEnforcer);";
if (!src.includes(setupOld)) throw new Error("setupOld not found");
src = src.replace(setupOld, setupNew);

// 3. After the existing tests, add new tests for budget enforcement.
const helperAnchor = "// (test methods follow below)";
// We don't know if there's such a marker; instead add right before the closing class brace.
const lastBracket = "}";
const idx = src.lastIndexOf(lastBracket);
const append =
[
  "",
  "    @Test",
  "    @DisplayName(\"P-NLB-01 budget ok -> 7-arg overload mirrors 5-arg behavior\")",
  "    void budgetOkPassesThrough() {",
  "        // Save a run that has the budget recorded.",
  "        var run = AgentRunEntity.builder().runId(\"RUN-NLB-1\").tenantId(\"TENANT-01\").userId(\"user-1001\")",
  "                .agentId(\"agent-1\").runtimeType(\"DEERFLOW\").status(\"RUNNING\")",
  "                .goal(\"g\").traceId(\"t\").budget(\"{}\")",
  "                .createdAt(Instant.now()).updatedAt(Instant.now()).build();",
  "        Mockito.when(runRepository.findById(\"RUN-NLB-1\")).thenReturn(Optional.of(run));",
  "        Mockito.when(runRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));",
  "        var result = service.complete(\"RUN-NLB-1\", \"COMPLETED\", \"done\", null, null, 0L, 0L);",
  "        assertEquals(\"COMPLETED\", result.getStatus());",
  "        Mockito.verify(tokenBudgetEnforcer).check(any(), Mockito.eq(0), Mockito.eq(0L));",
  "    }",
  "",
  "    @Test",
  "    @DisplayName(\"P-NLB-01 budget violated -> run marked DEGRADED with BUDGET_EXCEEDED\")",
  "    void budgetViolationForcesDegraded() {",
  "        var run = AgentRunEntity.builder().runId(\"RUN-NLB-2\").tenantId(\"TENANT-01\").userId(\"user-1001\")",
  "                .agentId(\"agent-1\").runtimeType(\"DEERFLOW\").status(\"RUNNING\")",
  "                .goal(\"g\").traceId(\"t\").budget(\"{}\")",
  "                .createdAt(Instant.now()).updatedAt(Instant.now()).build();",
  "        Mockito.when(runRepository.findById(\"RUN-NLB-2\")).thenReturn(Optional.of(run));",
  "        Mockito.when(runRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));",
  "        Mockito.when(tokenBudgetEnforcer.check(any(), Mockito.anyInt(), Mockito.anyLong()))",
  "                .thenReturn(TokenBudgetEnforcer.EnforcementResult.denied(\"TOKENS\", 1000L));",
  "        var result = service.complete(\"RUN-NLB-2\", \"COMPLETED\", \"answer\", null, null, 5000L, 0L);",
  "        assertEquals(\"DEGRADED\", result.getStatus());",
  "        assertEquals(\"BUDGET_EXCEEDED\", result.getErrorCode());",
  "        assertTrue(result.getErrorMessage().contains(\"TOKENS\"),",
  "                \"errorMessage must surface violation name\");",
  "    }",
  "",
  "    @Test",
  "    @DisplayName(\"P-NLB-01 budget null -> enforcer check is called but allowed\")",
  "    void nullBudgetAllowed() {",
  "        var run = AgentRunEntity.builder().runId(\"RUN-NLB-3\").tenantId(\"TENANT-01\").userId(\"user-1001\")",
  "                .agentId(\"agent-1\").runtimeType(\"DEERFLOW\").status(\"RUNNING\")",
  "                .goal(\"g\").traceId(\"t\").budget((String) null)",
  "                .createdAt(Instant.now()).updatedAt(Instant.now()).build();",
  "        Mockito.when(runRepository.findById(\"RUN-NLB-3\")).thenReturn(Optional.of(run));",
  "        Mockito.when(runRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));",
  "        var result = service.complete(\"RUN-NLB-3\", \"COMPLETED\", \"done\", null, null, 100L, 100L);",
  "        assertEquals(\"COMPLETED\", result.getStatus());",
  "    }"
].join(NL);
const newSrc = src.substring(0, idx) + append + NL + src.substring(idx);
fs.writeFileSync(path, newSrc, "utf8");
console.log("complete test extended");
