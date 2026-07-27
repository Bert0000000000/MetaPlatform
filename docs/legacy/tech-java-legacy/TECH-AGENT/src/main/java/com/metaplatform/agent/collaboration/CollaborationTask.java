package com.metaplatform.agent.collaboration;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 多员工协作任务（V15-04）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CollaborationTask {

    private String collaborationId;
    private String tenantId;
    private String title;
    private String description;
    private String goal;
    /** sequential / parallel / hybrid */
    private String splitStrategy;
    private List<SubTask> subtasks;
    /** pending / running / completed / failed */
    private String status;
    private String createdBy;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private OffsetDateTime startedAt;
    private OffsetDateTime completedAt;
    private String finalReport;
}
