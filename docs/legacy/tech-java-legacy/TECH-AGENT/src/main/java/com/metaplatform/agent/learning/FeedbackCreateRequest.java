package com.metaplatform.agent.learning;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 记录任务执行反馈请求（V15-03）。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FeedbackCreateRequest {

    @NotBlank
    private String employeeId;

    @NotBlank
    private String taskId;

    private String taskTitle;

    /** success / failed / partial */
    private String executionResult;

    /** thumb_up / thumb_down / suggestion */
    private String feedbackType;

    private String suggestion;

    private List<String> tags;
}
