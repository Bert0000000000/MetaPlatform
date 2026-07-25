package com.metaplatform.agent.tasks;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 分配任务请求。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AssignTaskRequest {

    @NotBlank
    private String assignedTo;
}
