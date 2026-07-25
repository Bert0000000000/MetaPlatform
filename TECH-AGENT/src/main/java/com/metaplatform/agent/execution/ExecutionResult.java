package com.metaplatform.agent.execution;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 引擎执行结果（内部产物）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExecutionResult {

    /** 执行 ID。 */
    private String executionId;

    /** Agent ID。 */
    private String agentId;

    /** 租户 ID。 */
    private String tenantId;

    /** 执行状态。 */
    private ExecutionStatus status;

    /** 输出文本。 */
    private String output;

    /** 执行步骤列表。 */
    private List<ExecutionStep> steps;

    /** 模型 ID。 */
    private String modelId;

    /** 输入 token 数。 */
    @Builder.Default
    private int inputTokens = 0;

    /** 输出 token 数。 */
    @Builder.Default
    private int outputTokens = 0;

    /** 开始时间。 */
    private OffsetDateTime startedAt;

    /** 完成时间。 */
    private OffsetDateTime completedAt;
}
