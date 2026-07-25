package com.metaplatform.agent.steps;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 提交评估请求。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SubmitEvaluationRequest {

    /** 评分（0.0 ~ 1.0）。 */
    @NotNull(message = "score 不能为空")
    @Min(value = 0, message = "score 不能小于 0")
    @Max(value = 1, message = "score 不能大于 1")
    private Double score;

    /** 反馈。 */
    @Builder.Default
    private String feedback = "";

    /** 评估者。 */
    private String evaluator;
}
