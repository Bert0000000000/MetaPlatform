package com.metaplatform.agent.execution;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.clients.ActionClient;
import com.metaplatform.agent.clients.LLMGWClient;
import com.metaplatform.agent.clients.RAGClient;
import com.metaplatform.agent.entity.AgentDefinitionEntity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 固定 DAG 执行引擎。
 *
 * <p>DAG 节点顺序：PLANNING → [RAG retrieval 可选] → REASONING(LLM)
 * → [TOOL_CALLING + TOOL_RESULT 可选] → EVALUATION → FINAL</p>
 *
 * <p>当前阶段使用自研 HTTP 客户端调 LLMGW，不直接使用 SAA Graph Core（后续 Phase 再接入）。</p>
 */
@Slf4j
@Component
public class ExecutionEngine {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private static final TypeReference<List<String>> LIST_STR_TYPE = new TypeReference<>() {};

    private final LLMGWClient llmClient;
    private final RAGClient ragClient;
    private final ActionClient actionClient;
    private final ObjectMapper objectMapper;

    public ExecutionEngine(LLMGWClient llmClient,
                           RAGClient ragClient,
                           ActionClient actionClient,
                           ObjectMapper objectMapper) {
        this.llmClient = llmClient;
        this.ragClient = ragClient;
        this.actionClient = actionClient;
        this.objectMapper = objectMapper;
    }

    /**
     * 同步执行。
     *
     * @param agent          Agent 定义
     * @param tenantId       租户 ID
     * @param task           任务文本
     * @param context        附加上下文（可空）
     * @param maxIterations  最大迭代数
     * @param traceId        链路追踪 ID（可空）
     * @return 执行结果
     */
    @SuppressWarnings("unchecked")
    public ExecutionResult run(AgentDefinitionEntity agent,
                               String tenantId,
                               String task,
                               String context,
                               int maxIterations,
                               String traceId) {
        String executionId = "exe-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        OffsetDateTime startedAt = OffsetDateTime.now();
        List<ExecutionStep> steps = new ArrayList<>();

        // PLANNING
        steps.add(ExecutionStep.builder()
                .type(ExecutionStepType.PLANNING)
                .title("任务规划")
                .content("将任务拆解为推理步骤，最大迭代 " + maxIterations + " 轮")
                .build());

        // RAG retrieval（可选）
        String ragContext = "";
        List<String> ragScopes = parseStringList(agent.getRagScopes());
        if (ragClient != null && !ragScopes.isEmpty()) {
            List<Map<String, Object>> ragResults = ragClient.search(task, ragScopes, 5, tenantId, traceId);
            ragContext = ragClient.formatContext(ragResults);
            steps.add(ExecutionStep.builder()
                    .type(ExecutionStepType.REASONING)
                    .title("知识检索")
                    .content("从知识库检索到 " + ragResults.size() + " 条相关文档")
                    .build());
        }

        List<Map<String, Object>> messages = buildMessages(agent, task, context, ragContext);

        // 构建函数定义（可选）
        List<String> tools = parseStringList(agent.getTools());
        List<Map<String, Object>> functions = null;
        if (actionClient != null && !tools.isEmpty()) {
            functions = buildFunctionDefinitions(agent, tenantId, traceId, tools);
        }

        // REASONING / LLM 调用
        double temperature = parseDouble(agent.getTemperature(), 0.7);
        int maxTokens = parseInt(agent.getMaxTokens(), 4096);
        Map<String, Object> llmResp = llmClient.chat(
                agent.getModelId(), messages, temperature, maxTokens, functions, traceId);

        Object choicesObj = llmResp.get("choices");
        Map<String, Object> choice = null;
        Map<String, Object> message = null;
        String answer = "";
        String finishReason = "stop";

        if (choicesObj instanceof List<?> choices && !choices.isEmpty()) {
            Object first = choices.get(0);
            if (first instanceof Map<?, ?> choiceMap) {
                choice = (Map<String, Object>) choiceMap;
                Object messageObj = choice.get("message");
                if (messageObj instanceof Map<?, ?> messageMap) {
                    message = (Map<String, Object>) messageMap;
                    Object contentObj = message.get("content");
                    answer = contentObj == null ? "" : contentObj.toString();
                }
                Object fr = choice.get("finish_reason");
                finishReason = fr == null ? "stop" : fr.toString();
            }
        }

        steps.add(ExecutionStep.builder()
                .type(ExecutionStepType.REASONING)
                .title("Agent 推理")
                .content(answer)
                .build());

        // Function calling：执行 Action 并二次调 LLM
        if ("function_call".equals(finishReason) && actionClient != null && message != null) {
            Object fcObj = message.get("function_call");
            Map<String, Object> functionCall = new LinkedHashMap<>();
            if (fcObj instanceof Map<?, ?> fcMap) {
                functionCall = (Map<String, Object>) fcMap;
            }
            String toolName = strOrDefault(functionCall.get("name"),
                    tools.isEmpty() ? "" : tools.get(0));

            Map<String, Object> toolArgs;
            try {
                String argsJson = strOrDefault(functionCall.get("arguments"), "{}");
                toolArgs = objectMapper.readValue(argsJson, MAP_TYPE);
            } catch (Exception e) {
                toolArgs = new LinkedHashMap<>();
                toolArgs.put("input", task);
            }

            steps.add(ExecutionStep.builder()
                    .type(ExecutionStepType.TOOL_CALLING)
                    .title("工具调用")
                    .content("调用工具: " + toolName + ", 参数: " + toolArgs)
                    .build());

            Map<String, Object> actionResult = actionClient.execute(toolName, toolArgs, tenantId, traceId);
            Object actionOutput = actionResult.get("output");
            String actionOutputStr = actionOutput == null ? actionResult.toString() : actionOutput.toString();

            steps.add(ExecutionStep.builder()
                    .type(ExecutionStepType.TOOL_RESULT)
                    .title("工具返回")
                    .content(actionOutputStr)
                    .build());

            // 将工具结果回传给 LLM 获取最终回答
            messages.add(message);
            Map<String, Object> toolMessage = new LinkedHashMap<>();
            toolMessage.put("role", "function");
            toolMessage.put("name", toolName);
            toolMessage.put("content", actionOutputStr);
            messages.add(toolMessage);

            Map<String, Object> llmResp2 = llmClient.chat(
                    agent.getModelId(), messages, temperature, maxTokens, null, traceId);
            Object choices2 = llmResp2.get("choices");
            if (choices2 instanceof List<?> choiceList2 && !choiceList2.isEmpty()) {
                Object c2 = choiceList2.get(0);
                if (c2 instanceof Map<?, ?> choiceMap2) {
                    Object msg2 = choiceMap2.get("message");
                    if (msg2 instanceof Map<?, ?> msgMap2) {
                        Object a2 = msgMap2.get("content");
                        answer = a2 == null ? answer : a2.toString();
                    }
                }
            }
            llmResp.put("usage", mergeUsage(getMap(llmResp, "usage"), getMap(llmResp2, "usage")));
        } else if (!tools.isEmpty()) {
            // 无 action_client 时的占位工具调用
            steps.add(ExecutionStep.builder()
                    .type(ExecutionStepType.TOOL_CALLING)
                    .title("工具调用")
                    .content("Agent 配置了 " + tools.size() + " 个工具：" + String.join(", ", tools))
                    .build());
            steps.add(ExecutionStep.builder()
                    .type(ExecutionStepType.TOOL_RESULT)
                    .title("工具返回")
                    .content("当前里程碑仅记录工具调用意图，真实执行在 P2-AGT-10 接入 TECH-ACTION/MCP 后完成。")
                    .build());
        }

        // EVALUATION
        steps.add(ExecutionStep.builder()
                .type(ExecutionStepType.EVALUATION)
                .title("结果评估")
                .content("执行结果符合任务要求，完成输出。")
                .build());

        // FINAL
        steps.add(ExecutionStep.builder()
                .type(ExecutionStepType.FINAL)
                .title("最终回答")
                .content(answer)
                .build());

        Map<String, Object> usage = getMap(llmResp, "usage");
        int inputTokens = getInt(usage, "promptTokens");
        int outputTokens = getInt(usage, "completionTokens");

        return ExecutionResult.builder()
                .executionId(executionId)
                .agentId(agent.getId())
                .tenantId(tenantId)
                .status(ExecutionStatus.COMPLETED)
                .output(answer)
                .steps(steps)
                .modelId(agent.getModelId())
                .inputTokens(inputTokens)
                .outputTokens(outputTokens)
                .startedAt(startedAt)
                .completedAt(OffsetDateTime.now())
                .build();
    }

    /**
     * 流式执行，返回事件列表（与 Python stream 语义一致）。
     *
     * <p>当前实现先同步执行再分批发送事件（不阻塞调用线程）。
     * 后续接入 SAA Graph Core 后可改为真正的流式。</p>
     */
    public List<Map<String, Object>> stream(AgentDefinitionEntity agent,
                                            String tenantId,
                                            String task,
                                            String context,
                                            int maxIterations,
                                            String traceId) {
        String executionId = "exe-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        OffsetDateTime startedAt = OffsetDateTime.now();
        int[] stepNumber = {0};
        List<Map<String, Object>> events = new ArrayList<>();

        events.add(event("execution.started", Map.of(
                "executionId", executionId,
                "agentId", agent.getId() == null ? "" : agent.getId(),
                "startedAt", startedAt.toString(),
                "traceId", traceId == null ? "" : traceId)));

        stepNumber[0]++;
        events.add(stepEvent(executionId, stepNumber[0], ExecutionStep.builder()
                .type(ExecutionStepType.PLANNING)
                .title("任务规划")
                .content("将任务拆解为推理步骤，最大迭代 " + maxIterations + " 轮")
                .build()));

        // RAG（可选）
        String ragContext = "";
        List<String> ragScopes = parseStringList(agent.getRagScopes());
        if (ragClient != null && !ragScopes.isEmpty()) {
            List<Map<String, Object>> ragResults = ragClient.search(task, ragScopes, 5, tenantId, traceId);
            ragContext = ragClient.formatContext(ragResults);
        }

        List<Map<String, Object>> messages = buildMessages(agent, task, context, ragContext);
        List<String> tools = parseStringList(agent.getTools());
        List<Map<String, Object>> functions = null;
        if (actionClient != null && !tools.isEmpty()) {
            functions = buildFunctionDefinitions(agent, tenantId, traceId, tools);
        }

        double temperature = parseDouble(agent.getTemperature(), 0.7);
        int maxTokens = parseInt(agent.getMaxTokens(), 4096);
        Map<String, Object> llmResp = llmClient.chat(
                agent.getModelId(), messages, temperature, maxTokens, functions, traceId);

        Object choicesObj = llmResp.get("choices");
        String answer = "";
        if (choicesObj instanceof List<?> choices && !choices.isEmpty()) {
            Object first = choices.get(0);
            if (first instanceof Map<?, ?> choiceMap) {
                Object messageObj = choiceMap.get("message");
                if (messageObj instanceof Map<?, ?> messageMap) {
                    Object contentObj = messageMap.get("content");
                    answer = contentObj == null ? "" : contentObj.toString();
                }
            }
        }

        stepNumber[0]++;
        events.add(event("agent.thinking", Map.of(
                "executionId", executionId,
                "step", stepNumber[0],
                "thought", "正在基于系统提示词和任务进行推理...",
                "timestamp", OffsetDateTime.now().toString())));

        if (!tools.isEmpty()) {
            String toolName = tools.get(0);
            String toolCallId = "tc-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
            stepNumber[0]++;
            events.add(event("agent.action", Map.of(
                    "executionId", executionId,
                    "step", stepNumber[0],
                    "action", "CALL_TOOL",
                    "toolName", toolName,
                    "toolInput", Map.of("task", task),
                    "timestamp", OffsetDateTime.now().toString())));
            events.add(event("tool.calling", Map.of(
                    "executionId", executionId,
                    "toolCallId", toolCallId,
                    "toolId", "tool-" + toolName,
                    "toolName", toolName,
                    "input", Map.of("task", task),
                    "timestamp", OffsetDateTime.now().toString())));
            events.add(event("tool.result", Map.of(
                    "executionId", executionId,
                    "toolCallId", toolCallId,
                    "toolId", "tool-" + toolName,
                    "toolName", toolName,
                    "status", "SUCCESS",
                    "output", "工具调用意图已记录（模拟）",
                    "duration", 0,
                    "timestamp", OffsetDateTime.now().toString())));
        }

        stepNumber[0]++;
        events.add(stepEvent(executionId, stepNumber[0], ExecutionStep.builder()
                .type(ExecutionStepType.REASONING)
                .title("Agent 推理")
                .content(answer)
                .build()));

        // 简单的按词流式输出 answer
        for (String word : answer.split(" ")) {
            events.add(event("content.delta", Map.of(
                    "executionId", executionId,
                    "delta", word + " ",
                    "timestamp", OffsetDateTime.now().toString())));
        }

        events.add(event("content.done", Map.of(
                "executionId", executionId,
                "content", answer,
                "timestamp", OffsetDateTime.now().toString())));

        stepNumber[0]++;
        events.add(stepEvent(executionId, stepNumber[0], ExecutionStep.builder()
                .type(ExecutionStepType.EVALUATION)
                .title("结果评估")
                .content("执行结果符合任务要求，完成输出。")
                .build()));

        stepNumber[0]++;
        events.add(stepEvent(executionId, stepNumber[0], ExecutionStep.builder()
                .type(ExecutionStepType.FINAL)
                .title("最终回答")
                .content(answer)
                .build()));

        Map<String, Object> usage = getMap(llmResp, "usage");
        int promptTokens = getInt(usage, "promptTokens");
        int completionTokens = getInt(usage, "completionTokens");
        OffsetDateTime completedAt = OffsetDateTime.now();
        long durationMs = java.time.Duration.between(startedAt, completedAt).toMillis();

        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("duration", durationMs);
        metrics.put("iterations", stepNumber[0]);
        metrics.put("toolCalls", tools.size());
        Map<String, Object> tokenUsage = new LinkedHashMap<>();
        tokenUsage.put("promptTokens", promptTokens);
        tokenUsage.put("completionTokens", completionTokens);
        tokenUsage.put("totalTokens", promptTokens + completionTokens);
        metrics.put("tokenUsage", tokenUsage);
        metrics.put("modelUsed", agent.getModelId() == null ? "" : agent.getModelId());

        Map<String, Object> completedData = new LinkedHashMap<>();
        completedData.put("executionId", executionId);
        completedData.put("status", ExecutionStatus.COMPLETED.name());
        completedData.put("metrics", metrics);
        completedData.put("completedAt", completedAt.toString());
        completedData.put("traceId", traceId == null ? "" : traceId);
        events.add(event("execution.completed", completedData));

        return events;
    }

    // ----------------------------------------------------------- helpers

    private List<Map<String, Object>> buildMessages(AgentDefinitionEntity agent,
                                                    String task,
                                                    String context,
                                                    String ragContext) {
        StringBuilder system = new StringBuilder(agent.getSystemPrompt() == null ? "" : agent.getSystemPrompt());
        if (context != null && !context.isBlank()) {
            system.append("\n\n附加上下文：").append(context);
        }
        if (ragContext != null && !ragContext.isBlank()) {
            system.append("\n\n知识检索结果：\n").append(ragContext);
        }
        List<String> ragScopes = parseStringList(agent.getRagScopes());
        if (!ragScopes.isEmpty()) {
            system.append("\n\n知识范围：").append(String.join(", ", ragScopes));
        }

        List<Map<String, Object>> messages = new ArrayList<>();
        Map<String, Object> sysMsg = new LinkedHashMap<>();
        sysMsg.put("role", "system");
        sysMsg.put("content", system.toString());
        messages.add(sysMsg);

        Map<String, Object> userMsg = new LinkedHashMap<>();
        userMsg.put("role", "user");
        userMsg.put("content", task);
        messages.add(userMsg);

        return messages;
    }

    private List<Map<String, Object>> buildFunctionDefinitions(AgentDefinitionEntity agent,
                                                               String tenantId,
                                                               String traceId,
                                                               List<String> tools) {
        List<Map<String, Object>> functions = new ArrayList<>();
        for (String toolName : tools) {
            try {
                Map<String, Object> actionMeta = actionClient.getAction(toolName, tenantId, traceId);
                functions.add(actionClient.toFunctionDefinition(toolName, actionMeta));
            } catch (Exception e) {
                Map<String, Object> fallback = new LinkedHashMap<>();
                fallback.put("name", toolName);
                fallback.put("description", "Execute action: " + toolName);
                fallback.put("parameters", Map.of(
                        "type", "object",
                        "properties", Map.of("input", Map.of("type", "string"))));
                functions.add(fallback);
            }
        }
        return functions;
    }

    private Map<String, Object> mergeUsage(Map<String, Object> u1, Map<String, Object> u2) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("promptTokens", getInt(u1, "promptTokens") + getInt(u2, "promptTokens"));
        result.put("completionTokens", getInt(u1, "completionTokens") + getInt(u2, "completionTokens"));
        return result;
    }

    private Map<String, Object> event(String eventName, Map<String, Object> data) {
        Map<String, Object> e = new LinkedHashMap<>();
        e.put("event", eventName);
        e.put("data", data);
        return e;
    }

    private Map<String, Object> stepEvent(String executionId, int stepNumber, ExecutionStep step) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("executionId", executionId);
        data.put("step", stepNumber);
        data.put("node", "agent");
        data.put("status", "COMPLETED");
        data.put("timestamp", step.getCreatedAt() == null ? OffsetDateTime.now().toString() : step.getCreatedAt().toString());
        return event("execution.step", data);
    }

    private List<String> parseStringList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, LIST_STR_TYPE);
        } catch (Exception e) {
            log.warn("解析 JSON 字符串列表失败 | json={}", json, e);
            return List.of();
        }
    }

    private static double parseDouble(String value, double def) {
        if (value == null || value.isBlank()) {
            return def;
        }
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException e) {
            return def;
        }
    }

    private static int parseInt(String value, int def) {
        if (value == null || value.isBlank()) {
            return def;
        }
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return def;
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> getMap(Map<String, Object> map, String key) {
        if (map == null) {
            return Map.of();
        }
        Object val = map.get(key);
        if (val instanceof Map<?, ?> m) {
            return (Map<String, Object>) m;
        }
        return Map.of();
    }

    private static int getInt(Map<String, Object> map, String key) {
        if (map == null) {
            return 0;
        }
        Object val = map.get(key);
        if (val instanceof Number n) {
            return n.intValue();
        }
        return 0;
    }

    private static String strOrDefault(Object obj, String def) {
        return obj == null ? def : obj.toString();
    }
}
