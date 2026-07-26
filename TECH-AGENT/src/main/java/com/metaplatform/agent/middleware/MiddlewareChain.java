package com.metaplatform.agent.middleware;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Middleware Chain Orchestrator（P3.1.7）。
 *
 * <p>按 order() 升序执行所有 AgentMiddleware。每个 Middleware 抛异常或设置
 * {@code context.rejected = true} 时，Chain 终止后续执行。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MiddlewareChain {

    private final List<AgentMiddleware> middlewares;

    public void runBeforeExecution(MiddlewareContext context) {
        for (AgentMiddleware mw : sorted()) {
            if (context.isRejected()) return;
            try {
                mw.beforeExecution(context);
            } catch (Exception e) {
                log.error("[MiddlewareChain] beforeExecution failed mw={} runId={}",
                        mw.name(), context.getRunId(), e);
                context.setRejected(true);
                context.setRejectionReason("middleware " + mw.name() + " 异常: " + e.getMessage());
            }
        }
    }

    public void runBeforeToolCall(MiddlewareContext context, ToolCall call) {
        for (AgentMiddleware mw : sorted()) {
            if (context.isRejected()) return;
            try {
                mw.beforeToolCall(context, call);
            } catch (Exception e) {
                log.error("[MiddlewareChain] beforeToolCall failed mw={}", mw.name(), e);
                context.setRejected(true);
                context.setRejectionReason("middleware " + mw.name() + " 异常");
            }
        }
    }

    public void runAfterToolCall(MiddlewareContext context, ToolCall call, Object result) {
        for (AgentMiddleware mw : sorted()) {
            if (context.isRejected()) return;
            try {
                mw.afterToolCall(context, call, result);
            } catch (Exception e) {
                log.warn("[MiddlewareChain] afterToolCall failed mw={}", mw.name(), e);
            }
        }
    }

    public void runAfterExecution(MiddlewareContext context) {
        for (AgentMiddleware mw : sorted()) {
            if (context.isRejected()) return;
            try {
                mw.afterExecution(context);
            } catch (Exception e) {
                log.warn("[MiddlewareChain] afterExecution failed mw={}", mw.name(), e);
            }
        }
    }

    private List<AgentMiddleware> sorted() {
        return middlewares.stream()
                .sorted(Comparator.comparingInt(AgentMiddleware::order))
                .toList();
    }
}
