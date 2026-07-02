package com.metaplatform.capability.interfaces.rest.dto;

import java.util.Map;

/**
 * 执行能力请求。
 */
public record ExecuteCapabilityRequest(
        String capabilityName,
        Map<String, Object> parameters
) {}
