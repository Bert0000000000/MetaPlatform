package com.metaplatform.agent.learning;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 任务执行反馈记录（V15-03）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class FeedbackRecord {

    private String feedbackId;
    private String employeeId;
    private String taskId;
    private String taskTitle;
    /** success / failed / partial */
    private String executionResult;
    /** thumb_up / thumb_down / suggestion */
    private String feedbackType;
    private String suggestion;
    private List<String> tags;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
