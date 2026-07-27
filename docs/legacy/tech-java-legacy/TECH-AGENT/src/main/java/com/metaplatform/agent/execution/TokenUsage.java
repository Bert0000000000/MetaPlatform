package com.metaplatform.agent.execution;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Token 用量统计。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TokenUsage {

    /** 输入 token 数。 */
    @Builder.Default
    private int promptTokens = 0;

    /** 输出 token 数。 */
    @Builder.Default
    private int completionTokens = 0;

    /** 总 token 数。 */
    @Builder.Default
    private int totalTokens = 0;
}
