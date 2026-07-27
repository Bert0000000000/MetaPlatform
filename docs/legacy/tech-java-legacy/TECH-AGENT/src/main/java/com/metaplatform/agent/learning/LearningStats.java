package com.metaplatform.agent.learning;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 员工学习统计（V15-03）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LearningStats {

    private String employeeId;
    private int totalFeedback;
    private int thumbUp;
    private int thumbDown;
    private int suggestions;
    private int knowledgeFragments;
    private int syncedFragments;
    private double successRate;
    private List<String> topTags;
}
