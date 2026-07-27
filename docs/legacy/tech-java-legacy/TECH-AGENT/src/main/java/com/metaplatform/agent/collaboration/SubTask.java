package com.metaplatform.agent.collaboration;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 协作任务中的单个子任务（V15-04）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SubTask {

    private String id;
    private String employeeId;
    private String title;
    private String description;
    private List<String> skillTags;
    /** pending / running / completed / failed */
    private String status;
    private int progress;
    private List<String> dependsOn;
    private int estimatedSeconds;
    private int actualSeconds;
    private String result;
    private String errorMessage;
    private OffsetDateTime startedAt;
    private OffsetDateTime completedAt;
}
