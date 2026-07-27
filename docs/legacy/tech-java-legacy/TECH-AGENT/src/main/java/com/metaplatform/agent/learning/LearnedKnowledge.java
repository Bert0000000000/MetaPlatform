package com.metaplatform.agent.learning;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 从反馈中提炼的知识片段（V15-03）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LearnedKnowledge {

    private String knowledgeId;
    private String employeeId;
    /** prompt_fragment / tool_rule / parameter_template / experience */
    private String knowledgeType;
    private String title;
    private String content;
    private List<String> sourceFeedbackIds;
    private String taskPattern;
    private List<String> tags;
    private double confidence;
    private boolean syncedToKb;
    private String kbDocumentId;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
