package com.metaplatform.agent.tasks;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * 创建 Agent 任务请求。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateTaskRequest {

    @NotBlank
    private String agentId;

    @NotBlank
    @Size(max = 512)
    private String title;

    private String description = "";

    /** LOW / MEDIUM / HIGH / URGENT，默认 MEDIUM */
    private String priority = "MEDIUM";

    private String assignedTo;

    private Map<String, Object> input;
}
