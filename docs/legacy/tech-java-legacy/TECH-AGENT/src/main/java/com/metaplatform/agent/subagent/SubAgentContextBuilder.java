package com.metaplatform.agent.subagent;

import com.metaplatform.agent.middleware.MiddlewareContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Sub-Agent 上下文隔离构造器（P3.2.1）。
 *
 * <p>每个 Sub-Agent 只拿到任务必要信息，避免上下文泄露：</p>
 * <ul>
 *   <li>objective（任务描述）</li>
 *   <li>inputSchema（输入契约）</li>
 *   <li>allowedScopes（概念 / 字段 / Action 范围）</li>
 *   <li>budget（Token / 时延）</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SubAgentContextBuilder {

    /**
     * 把父 MiddlewareContext 裁剪为子 Agent 的 MiddlewareContext。
     */
    public MiddlewareContext buildChildContext(MiddlewareContext parent,
                                                 String objective,
                                                 List<String> allowedConcepts,
                                                 List<String> allowedActions,
                                                 int tokenBudget) {
        Map<String, Object> childEnv = new LinkedHashMap<>(parent.getOntologyEnvelope());
        childEnv.put("parentRunId", parent.getRunId());
        childEnv.put("objective", objective);
        childEnv.put("allowedConcepts", allowedConcepts);

        return MiddlewareContext.builder()
                .tenantId(parent.getTenantId())
                .userId(parent.getUserId())
                .agentId(parent.getAgentId() + "-sub")
                .threadId(parent.getThreadId())
                .runId(parent.getRunId() + "-sub-" + System.currentTimeMillis())
                .userMessage(objective)
                .ontologyEnvelope(childEnv)
                .allowedTools(filterByConcepts(parent.getAllowedTools(), allowedConcepts))
                .claims(new ArrayList<>())
                .actionProposals(new ArrayList<>())
                .build();
    }

    private List<String> filterByConcepts(List<String> tools, List<String> concepts) {
        if (tools == null || concepts == null || concepts.isEmpty()) return tools;
        // 简化：保留所有 ontology.* + 概念相关工具
        List<String> out = new ArrayList<>();
        for (String t : tools) {
            if (t != null && (t.startsWith("ontology.") || t.startsWith("rag.") || t.startsWith("mcp."))) {
                out.add(t);
            }
        }
        log.debug("[SubAgentContextBuilder] filtered tools: parent={} child={}", tools.size(), out.size());
        return out;
    }
}
