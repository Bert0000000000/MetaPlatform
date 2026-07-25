package com.metaplatform.agent.plans;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 创建任务计划请求（V15-02）。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreatePlanRequest {

    @NotBlank
    @Size(max = 4096)
    private String userInput;

    private String agentId;

    private String title;
}
