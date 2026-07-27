package com.metaplatform.agent.execution;

import com.metaplatform.agent.common.ErrorCode;
import com.metaplatform.agent.entity.AgentDefinitionEntity;
import com.metaplatform.agent.exception.AgentException;
import com.metaplatform.agent.context.OntologyContextEnvelope;
import com.metaplatform.agent.context.OntologyExecutionContextFactory;
import com.metaplatform.agent.repository.AgentDefinitionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * 执行服务：校验 Agent 并委托给引擎。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExecutionService {

    private static final int DEFAULT_MAX_ITERATIONS = 10;

    private final AgentDefinitionRepository agentDefinitionRepository;
    private final SaAgentExecutionEngine saEngine;
    private final ExecutionEngine engine;
    private final OntologyExecutionContextFactory ontologyContextFactory;

    /**
     * 同步执行。
     */
    @Transactional
    public ExecuteResponse execute(String tenantId, String agentId, ExecuteRequest request, String traceId) {
        AgentDefinitionEntity agent = ensureActiveAgent(tenantId, agentId);
        java.time.OffsetDateTime startedAt = java.time.OffsetDateTime.now();
        OntologyContextEnvelope ontologyContext = ontologyContextFactory.build(tenantId,
                request.getContext() != null && request.getContext().getTaskId() != null
                        ? request.getContext().getTaskId() : java.util.UUID.randomUUID().toString(),
                request.getContext());
        String executionContext = buildContextString(request.getContext(), ontologyContext);

        ExecutionResult result;
        try {
            result = saEngine.run(
                    agent,
                    tenantId,
                    request.getInput(),
                    executionContext,
                    DEFAULT_MAX_ITERATIONS,
                    traceId);
        } catch (Exception exception) {
            log.warn("SAA 执行路径不可用，降级到自研 HTTP 引擎 | agentId={}", agentId, exception);
            result = engine.run(
                    agent,
                    tenantId,
                    request.getInput(),
                    executionContext,
                    DEFAULT_MAX_ITERATIONS,
                    traceId);
        }

        return toResponse(agent, request, result, startedAt);
    }

    /**
     * 流式执行，返回事件列表。
     */
    public List<Map<String, Object>> stream(String tenantId, String agentId, ExecuteRequest request, String traceId) {
        AgentDefinitionEntity agent = ensureActiveAgent(tenantId, agentId);
        OntologyContextEnvelope ontologyContext = ontologyContextFactory.build(tenantId,
                request.getContext() != null && request.getContext().getTaskId() != null
                        ? request.getContext().getTaskId() : java.util.UUID.randomUUID().toString(),
                request.getContext());
        return engine.stream(
                agent,
                tenantId,
                request.getInput(),
                buildContextString(request.getContext(), ontologyContext),
                DEFAULT_MAX_ITERATIONS,
                traceId);
    }

    /**
     * 校验 Agent 是否存在且激活（在构造 SSE 响应前调用，使异常走全局异常处理器）。
     */
    public void validateAgent(String tenantId, String agentId) {
        ensureActiveAgent(tenantId, agentId);
    }

    // ----------------------------------------------------------- helpers

    private AgentDefinitionEntity ensureActiveAgent(String tenantId, String agentId) {
        AgentDefinitionEntity agent = agentDefinitionRepository
                .findByIdAndTenantIdAndDeletedAtIsNull(agentId, tenantId)
                .orElseThrow(() -> AgentException.agentNotFound(agentId));
        if (!"ACTIVE".equals(agent.getStatus())) {
            throw AgentException.agentNotActive(agentId);
        }
        return agent;
    }

    private String buildContextString(ExecuteContext context) {
        return buildContextString(context, null);
    }

    private String buildContextString(ExecuteContext context, OntologyContextEnvelope ontologyContext) {
        if (context == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        if (context.getUserId() != null && !context.getUserId().isBlank()) {
            sb.append("用户ID: ").append(context.getUserId());
        }
        if (context.getConversationId() != null && !context.getConversationId().isBlank()) {
            if (!sb.isEmpty()) {
                sb.append("\n");
            }
            sb.append("会话ID: ").append(context.getConversationId());
        }
        if (context.getTaskId() != null && !context.getTaskId().isBlank()) {
            if (!sb.isEmpty()) {
                sb.append("\n");
            }
            sb.append("任务ID: ").append(context.getTaskId());
        }
        if (context.getVariables() != null && !context.getVariables().isEmpty()) {
            if (!sb.isEmpty()) {
                sb.append("\n");
            }
            sb.append("上下文变量: ").append(context.getVariables());
        }
        if (ontologyContext != null) {
            if (!sb.isEmpty()) sb.append("\n");
            sb.append("OntologyContextEnvelope: ").append(ontologyContext);
        }
        return sb.toString();
    }

    private ExecuteResponse toResponse(AgentDefinitionEntity agent,
                                       ExecuteRequest request,
                                       ExecutionResult result,
                                       java.time.OffsetDateTime startedAt) {
        int duration = 0;
        if (result.getCompletedAt() != null) {
            duration = (int) Duration.between(startedAt, result.getCompletedAt()).toMillis();
        }

        TokenUsage tokenUsage = TokenUsage.builder()
                .promptTokens(result.getInputTokens())
                .completionTokens(result.getOutputTokens())
                .totalTokens(result.getInputTokens() + result.getOutputTokens())
                .build();

        int toolCalls = (int) result.getSteps().stream()
                .filter(s -> s.getType() == ExecutionStepType.TOOL_CALLING)
                .count();

        ExecutionMetrics metrics = ExecutionMetrics.builder()
                .duration(duration)
                .iterations(result.getSteps().size())
                .toolCalls(toolCalls)
                .tokenUsage(tokenUsage)
                .modelUsed(result.getModelId() == null ? "" : result.getModelId())
                .build();

        String conversationId = request.getContext() != null ? request.getContext().getConversationId() : null;
        String taskId = request.getContext() != null ? request.getContext().getTaskId() : null;

        return ExecuteResponse.builder()
                .executionId(result.getExecutionId())
                .agentId(result.getAgentId())
                .agentKey(agent.getAgentCode())
                .status(result.getStatus().name())
                .input(request.getInput())
                .output(OutputContent.builder().content(result.getOutput()).build())
                .metrics(metrics)
                .conversationId(conversationId)
                .taskId(taskId)
                .startedAt(startedAt)
                .completedAt(result.getCompletedAt())
                .build();
    }
}
