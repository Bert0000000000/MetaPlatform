package com.metaplatform.agent.plans;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 自主任务计划（V15-02）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Plan {

    private String planId;
    private String tenantId;
    private String title;
    private String description;
    private String userInput;
    private String agentId;
    /** draft / ready / running / completed / failed / cancelled */
    private String status;
    private List<PlanStep> steps;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
