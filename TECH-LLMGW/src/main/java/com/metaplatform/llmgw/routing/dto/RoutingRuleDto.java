package com.metaplatform.llmgw.routing.dto;

import java.util.Map;

public record RoutingRuleDto(
    Long id,
    String name,
    Integer priority,
    String conditionType,
    Map<String, Object> conditionValue,
    String targetModel,
    Boolean isActive
) {}
