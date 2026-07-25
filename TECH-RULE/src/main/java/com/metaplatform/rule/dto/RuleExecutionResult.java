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
    /** 求值过程中的错误信息（非空表示规则表达式异常，matched 视为 false）。 */
    private String errorMessage;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ActionInfo {
        private String type;
        private Map<String, Object> config;
    }
}
