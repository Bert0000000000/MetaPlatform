package com.metaplatform.agent.middleware;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Ontology Permission Middleware（P3.1.4）。
 *
 * <p>在每次 Tool Call 前重新校验 Envelope 中 PermissionSnapshot 仍然有效。
 * 同时把 Tool 白名单与 allowedTools 取交集。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OntologyPermissionMiddleware implements AgentMiddleware {

    @Override
    public int order() { return 300; }

    @Override
    public void beforeToolCall(MiddlewareContext context, ToolCall toolCall) {
        if (context.isRejected()) return;
        List<String> allowed = context.getAllowedTools();
        if (allowed == null || allowed.isEmpty()) {
            log.warn("[OntologyPermissionMW] allowedTools 为空 runId={}", context.getRunId());
            return;
        }
        String tool = toolCall.getToolName();
        if (tool != null && !allowed.contains(tool)) {
            log.warn("[OntologyPermissionMW] DENY tool={} not in allowedTools", tool);
            context.setRejected(true);
            context.setRejectionReason("tool " + tool + " 未被授权");
        }
    }
}
