package com.metaplatform.ea.capabilitymap.dto;

public record UpdateCapabilityMapRequest(
        String name,
        String description,
        String businessDomain,
        String status
) {
}
