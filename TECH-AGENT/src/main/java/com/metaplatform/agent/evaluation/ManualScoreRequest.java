package com.metaplatform.agent.evaluation;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 人工评分请求。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ManualScoreRequest {

    @DecimalMin("0.0")
    @DecimalMax("100.0")
    private Double score;

    @NotBlank
    private String evaluatedBy;
}
