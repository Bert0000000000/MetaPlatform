package com.metaplatform.agent.plans;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * 自主任务计划中的单个步骤（V15-02）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PlanStep {

    private String stepId;
    private String title;
    private String description;
    private String action;
    /** pending / running / completed / failed / skipped / approved */
    private String status;
    private int order;
    private boolean requiresApproval;
    private Map<String, Object> input;
    private Map<String, Object> output;
    private String errorMessage;
    private OffsetDateTime startedAt;
    private OffsetDateTime completedAt;
}
