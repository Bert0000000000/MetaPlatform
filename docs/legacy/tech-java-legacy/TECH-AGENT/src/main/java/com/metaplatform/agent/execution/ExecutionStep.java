package com.metaplatform.agent.execution;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 引擎内部执行步骤。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExecutionStep {

    /** 步骤 ID。 */
    @Builder.Default
    private String stepId = "step-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);

    /** 步骤类型。 */
    private ExecutionStepType type;

    /** 步骤标题。 */
    private String title;

    /** 步骤内容。 */
    private String content;

    /** 创建时间。 */
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
