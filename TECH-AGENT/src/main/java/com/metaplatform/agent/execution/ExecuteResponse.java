package com.metaplatform.agent.execution;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

/**
 * 同步执行端点返回的响应。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ExecuteResponse {

    /** 执行 ID。 */
    private String executionId;

    /** Agent ID。 */
    private String agentId;

    /** Agent 编码。 */
    private String agentKey;

    /** 执行状态。 */
    private String status;

    /** 输入文本。 */
    private String input;

    /** 输出内容。 */
    private OutputContent output;

    /** 执行指标。 */
    private ExecutionMetrics metrics;

    /** 会话 ID。 */
    private String conversationId;

    /** 任务 ID。 */
    private String taskId;

    /** 开始时间。 */
    private OffsetDateTime startedAt;

    /** 完成时间。 */
    private OffsetDateTime completedAt;
}
