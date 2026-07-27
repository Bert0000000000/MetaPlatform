package com.metaplatform.agent.evaluation;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 优化建议。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Suggestion {

    private String id;
    /** prompt / tool / knowledge / parameter / workflow */
    private String category;
    /** high / medium / low */
    private String priority;
    private String title;
    private String description;
    private String action;
    private String expectedImpact;
    private List<String> relatedEvidence;
}
