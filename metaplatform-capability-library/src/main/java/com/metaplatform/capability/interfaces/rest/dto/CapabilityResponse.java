package com.metaplatform.capability.interfaces.rest.dto;

import com.metaplatform.capability.domain.Capability;
import com.metaplatform.capability.domain.CapabilityType;

/**
 * 能力响应 DTO。
 */
public record CapabilityResponse(
        String name,
        String description,
        CapabilityType type,
        boolean async
) {
    public static CapabilityResponse from(Capability capability) {
        return new CapabilityResponse(
                capability.name(),
                capability.description(),
                capability.type(),
                capability.isAsync()
        );
    }
}
