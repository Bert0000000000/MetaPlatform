package com.metaplatform.wfe.engine.model;

/**
 * 节点执行结果，由 NodeExecutor 返回，驱动状态机推进。
 */
public record NodeExecutionResult(
        boolean shouldContinue,
        boolean processCompleted,
        String createdTaskId,
        String nextNodeId,
        String errorMessage
) {
    public static NodeExecutionResult continueTo(String nextNodeId) {
        return new NodeExecutionResult(true, false, null, nextNodeId, null);
    }

    public static NodeExecutionResult waitForApproval(String taskId) {
        return new NodeExecutionResult(false, false, taskId, null, null);
    }

    public static NodeExecutionResult completed() {
        return new NodeExecutionResult(false, true, null, null, null);
    }

    public static NodeExecutionResult error(String msg) {
        return new NodeExecutionResult(false, false, null, null, msg);
    }
}
