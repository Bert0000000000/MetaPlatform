package com.metaplatform.llmgw.routing.dto;

public record RoutingRecommendRequest(
    String taskType,
    String userId,
    String appId
) {}
