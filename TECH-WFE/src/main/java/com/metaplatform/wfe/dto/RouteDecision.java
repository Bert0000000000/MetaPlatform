package com.metaplatform.wfe.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * 网关路由决策（来自 TECH-RULE 执行结果）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RouteDecision {

    private String ruleId;
    private String ruleCode;
    private String actionType;
    private Map<String, Object> actionConfig;
}
