package com.metaplatform.agent.native_;

import com.metaplatform.agent.middleware.MiddlewareChain;
import com.metaplatform.agent.middleware.MiddlewareContext;
import com.metaplatform.agent.runtime.RuntimeRouter;
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

    @Value("${mate.runtime.mode:native}")
    private String mode;

    public RunOutcome execute(MiddlewareContext context) {
        log.info("[NativeAgentRuntime] mode={} runId={} threadId={}",
                mode, context.getRunId(), context.getThreadId());

        // 1. 路由
        RouteDecision decision = router.route(context);
        log.info("[NativeAgentRuntime] decision={}", decision);

        // 2. Middleware Chain（Before）
        middlewareChain.runBeforeExecution(context);
        if (context.isRejected()) {
            return RunOutcome.rejected(context.getRejectionReason());
        }

        // 3. 模拟工具调用循环（真实场景由 SAA Graph 执行）
        // P8.1 占位：直接返回 mock 结果
        return RunOutcome.success(
                "Native runtime 处理完成。决策=" + decision
                        + "，claims=" + context.getClaims().size()
                        + "，proposals=" + context.getActionProposals().size()
        );
    }

    public record RunOutcome(String status, String content) {
        public static RunOutcome success(String content) { return new RunOutcome("SUCCESS", content); }
        public static RunOutcome rejected(String reason) { return new RunOutcome("REJECTED", reason); }
        public static RunOutcome failed(String err) { return new RunOutcome("FAILED", err); }
    }
}
