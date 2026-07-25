package com.metaplatform.agent.execution;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 执行指标统计。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ExecutionMetrics {

    /** 执行时长（毫秒）。 */
    @Builder.Default
    private int duration = 0;

    /** 迭代步数。 */
    @Builder.Default
    private int iterations = 0;

    /** 工具调用次数。 */
    @Builder.Default
    private int toolCalls = 0;

    /** Token 用量。 */
    @Builder.Default
    private TokenUsage tokenUsage = TokenUsage.builder().build();

    /** 使用的模型 ID。 */
    @Builder.Default
    private String modelUsed = "";
}
