package com.metaplatform.llmgw.routing.dto;

import java.util.Map;

public record CreateRoutingRuleRequest(
    String name,
    Integer priority,
    String conditionType,
    Map<String, Object> conditionValue,
    String targetModel
) {}
