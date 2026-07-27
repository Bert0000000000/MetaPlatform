package com.metaplatform.agent.execution;

/**
 * 执行步骤类型。
 */
public enum ExecutionStepType {

    PLANNING,
    REASONING,
    TOOL_CALLING,
    TOOL_RESULT,
    EVALUATION,
    FINAL
}
