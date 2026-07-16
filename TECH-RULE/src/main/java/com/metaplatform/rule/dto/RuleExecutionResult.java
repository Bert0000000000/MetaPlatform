package com.metaplatform.rule.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RuleExecutionResult {

    private String ruleId;
    private String ruleCode;
    private String ruleName;
    private boolean matched;
    private ActionInfo action;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ActionInfo {
        private String type;
        private Map<String, Object> config;
    }
}
