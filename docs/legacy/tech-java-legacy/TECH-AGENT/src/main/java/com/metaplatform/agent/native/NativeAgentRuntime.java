package com.metaplatform.agent.native_;

import com.metaplatform.agent.middleware.MiddlewareChain;
import com.metaplatform.agent.middleware.MiddlewareContext;
import com.metaplatform.agent.runtime.RuntimeRouter;
import com.metaplatform.agent.runtime.NativeGraphRuntimeService;
import com.metaplatform.agent.middleware.ToolCall;

import java.util.List;
import com.metaplatform.agent.runtime.RuntimeRouter.RouteDecision;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 原生 Agent Runtime（P8.1）。
 *
 * <p>不依赖 DeerFlow Adapter，直接用 Spring AI Alibaba Graph + Java Middleware
 * 跑完整 Ontology-Native 闭环。DeerFlow 降级为可选高级研究执行器。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NativeAgentRuntime {

    private final MiddlewareChain middlewareChain;
    private final RuntimeRouter router;
    private final NativeGraphRuntimeService graphRuntime;
    private final com.metaplatform.agent.runtime.NativeLlmToolLoopService llmToolLoop;
    private final com.metaplatform.agent.runtime.NativeRuntimeEventPublisher eventPublisher;

    @Value("${mate.runtime.mode:native}")
    private String mode;

    /** LLM-driven Native entry point; Spring AI tool calls are routed through ontology middleware. */
    public RunOutcome executeWithLlm(MiddlewareContext context) {
        try {
            middlewareChain.runBeforeExecution(context);
            if (context.isRejected()) return RunOutcome.rejected(context.getRejectionReason());
            String content = llmToolLoop.execute(context);
            middlewareChain.runAfterExecution(context);
            if (content == null || content.isBlank()) return RunOutcome.failed("LLM produced no output");
            return RunOutcome.success(content);
        } catch (RuntimeException ex) {
            return RunOutcome.failed("native LLM execution failed: " + ex.getMessage());
        }
    }

    public RunOutcome execute(MiddlewareContext context) {
        return execute(context, List.of());
    }

    /** Execute an explicit native graph; no implicit mock success is permitted. */
    public RunOutcome execute(MiddlewareContext context, List<ToolCall> toolCalls) {
        log.info("[NativeAgentRuntime] mode={} runId={} threadId={}", mode, context.getRunId(), context.getThreadId());
        RouteDecision decision = router.route(context);
        NativeGraphRuntimeService.NativeGraphResult result = graphRuntime.execute(context, toolCalls);
        if (!"COMPLETED".equals(result.status())) {
            eventPublisher.publish(context.getRunId(), "RUN_FAILED", java.util.Map.of("error", result.error() == null ? "native graph failed" : result.error()));
            return RunOutcome.failed(result.error() == null ? "native graph produced no successful result" : result.error());
        }
        if (result.toolOutputs().isEmpty()) {
            return RunOutcome.failed("native graph has no executed tool outputs");
        }
        eventPublisher.publish(context.getRunId(), "RUN_COMPLETED", java.util.Map.of("route", decision.name(), "outputs", result.toolOutputs().size(), "claims", result.claims().size()));
        return RunOutcome.success("Native runtime route=" + decision + ", outputs=" + result.toolOutputs().size()
                + ", claims=" + result.claims().size());
    }

    public com.metaplatform.agent.runtime.UnifiedRuntimeResponse executeUnified(MiddlewareContext context, List<ToolCall> toolCalls) {
        RunOutcome outcome = execute(context, toolCalls);
        return new com.metaplatform.agent.runtime.UnifiedRuntimeResponse(
                context.getRunId(), outcome.status(), outcome.content(), context.getClaims(), List.of(), List.of(),
                java.util.Map.of("runtime", "native", "route", router.route(context).name()));
    }

    public record RunOutcome(String status, String content) {
        public static RunOutcome success(String content) { return new RunOutcome("SUCCESS", content); }
        public static RunOutcome rejected(String reason) { return new RunOutcome("REJECTED", reason); }
        public static RunOutcome failed(String err) { return new RunOutcome("FAILED", err); }
    }
}
