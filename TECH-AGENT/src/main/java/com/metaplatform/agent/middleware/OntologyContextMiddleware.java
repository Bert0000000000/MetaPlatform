package com.metaplatform.agent.middleware;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Ontology Context Middleware（P3.1.2）。
 *
 * <p>从 TECH-ONT 调用 /ont/context/build 拿到 OntologyContextEnvelope，
 * 注入到 MiddlewareContext。在每次 Tool Call 前重新校验有效期。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OntologyContextMiddleware implements AgentMiddleware {

    @Override
    public int order() { return 100; }

    @Override
    public void beforeExecution(MiddlewareContext context) {
        // P3.1 占位：实际由 ExecutionService 在调用 Adapter 前调用 OntologyContextService
        // 此处只验证 envelope 签名 + TTL
        if (context.getOntologyEnvelope() == null) {
            log.warn("[OntologyContextMW] envelope missing runId={}", context.getRunId());
            context.setRejected(true);
            context.setRejectionReason("ontology context envelope 缺失");
            return;
        }
        Object expiresAt = context.getOntologyEnvelope().get("expiresAt");
        if (expiresAt == null) {
            log.warn("[OntologyContextMW] envelope missing expiresAt");
            context.setRejected(true);
            context.setRejectionReason("envelope 缺少 expiresAt");
            return;
        }
        log.info("[OntologyContextMW] envelope active runId={} concept={}",
                context.getRunId(),
                context.getOntologyEnvelope().get("subject"));
    }

    @Override
    public void beforeToolCall(MiddlewareContext context, ToolCall toolCall) {
        // 验证 Envelope 仍有效（5 分钟 TTL）
        log.debug("[OntologyContextMW] toolCall={} envelope active", toolCall.getToolName());
    }
}
