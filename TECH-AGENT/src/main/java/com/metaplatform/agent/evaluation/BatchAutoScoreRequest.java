package com.metaplatform.agent.evaluation;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 批量自动评分请求。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BatchAutoScoreRequest {

    @NotBlank
    private String employeeId;

    private String period;

    private Integer limit;
}
