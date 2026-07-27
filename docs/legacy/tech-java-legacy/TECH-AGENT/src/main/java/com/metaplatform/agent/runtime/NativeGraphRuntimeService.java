package com.metaplatform.agent.runtime;

import com.metaplatform.agent.middleware.MiddlewareChain;
import com.metaplatform.agent.middleware.MiddlewareContext;
import com.metaplatform.agent.middleware.ToolCall;
import com.metaplatform.agent.checkpoint.CheckpointService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/** Minimal deterministic Native graph runner: context -> guarded tools -> evidence-aware result. */
@Service
@RequiredArgsConstructor
public class NativeGraphRuntimeService {
    private final MiddlewareChain middlewareChain;
    private final NativeToolExecutionService toolExecutionService;
    private final CheckpointService checkpointService;

    @Value("${mate.runtime.max-tool-calls:16}")
    private int maxToolCalls;

    @Value("${mate.runtime.max-duration-ms:30000}")
    private long maxDurationMs;

    /** Resume a graph from the latest tenant-scoped checkpoint before continuing tool execution. */
    public NativeGraphResult resume(MiddlewareContext context, String executionId, List<ToolCall> toolCalls) {
        if (context == null || context.getTenantId() == null || executionId == null || executionId.isBlank()) {
            return NativeGraphResult.rejected("tenant and executionId are required for resume");
        }
        var state = checkpointService.resumeState(context.getTenantId(), executionId);
        if (state.isEmpty()) return NativeGraphResult.rejected("no checkpoint found");
        Map<String, Object> resumed = new LinkedHashMap<>(state.get());
        context.setGrounding(resumed);
        return execute(context, toolCalls);
    }

    public NativeGraphResult execute(MiddlewareContext context, List<ToolCall> toolCalls) {
        return execute(context, toolCalls, new AtomicBoolean(false));
    }

    public NativeGraphResult execute(MiddlewareContext context, List<ToolCall> toolCalls, AtomicBoolean cancelled) {
        if (context == null) throw new IllegalArgumentException("middleware context is required");
        middlewareChain.runBeforeExecution(context);
        if (context.isRejected()) return NativeGraphResult.rejected(context.getRejectionReason());
        List<ToolCall> calls = toolCalls == null ? List.of() : toolCalls;
        if (calls.size() > maxToolCalls) return NativeGraphResult.rejected("tool call budget exceeded");
        List<Map<String, Object>> outputs = new ArrayList<>();
        long deadline = System.nanoTime() + java.util.concurrent.TimeUnit.MILLISECONDS.toNanos(Math.max(1, maxDurationMs));
        for (ToolCall call : calls) {
            if (cancelled != null && cancelled.get()) return NativeGraphResult.rejected("native graph cancelled");
            if (System.nanoTime() >= deadline) return NativeGraphResult.rejected("native graph timeout exceeded");
            try {
                Map<String, Object> output = toolExecutionService.execute(context, call.getToolName(), call.getArguments());
                outputs.add(output);
            } catch (RuntimeException ex) {
                return NativeGraphResult.rejected("tool execution failed: " + (ex.getMessage() == null ? "unknown" : ex.getMessage()));
            }
        }
        middlewareChain.runAfterExecution(context);
        if (context.isRejected()) return NativeGraphResult.rejected(context.getRejectionReason());
        return NativeGraphResult.completed(outputs, context.getClaims());
    }

    public record NativeGraphResult(String status, String error, List<Map<String, Object>> toolOutputs,
                                    List<Map<String, Object>> claims) {
        static NativeGraphResult rejected(String error) {
            return new NativeGraphResult("FAILED", error, List.of(), List.of());
        }
        static NativeGraphResult completed(List<Map<String, Object>> outputs, List<Map<String, Object>> claims) {
            return new NativeGraphResult("COMPLETED", null, List.copyOf(outputs),
                    claims == null ? List.of() : List.copyOf(claims));
        }
    }
}
