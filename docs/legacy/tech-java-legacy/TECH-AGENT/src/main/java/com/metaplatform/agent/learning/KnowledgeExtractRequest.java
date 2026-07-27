package com.metaplatform.agent.learning;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 知识提炼请求（V15-03）。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeExtractRequest {

    @NotBlank
    private String employeeId;

    private List<String> feedbackIds;
}
