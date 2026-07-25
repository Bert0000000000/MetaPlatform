package com.metaplatform.agent.evaluation;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 生成优化建议请求。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GenerateSuggestionsRequest {

    @NotBlank
    private String employeeId;

    private String period;

    private String reportId;
}
