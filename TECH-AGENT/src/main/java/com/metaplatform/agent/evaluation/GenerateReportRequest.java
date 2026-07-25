package com.metaplatform.agent.evaluation;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 生成评估报告请求。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GenerateReportRequest {

    @NotBlank
    private String employeeId;

    @NotBlank
    private String period;
}
