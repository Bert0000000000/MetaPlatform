package com.metaplatform.ea.capabilitymap.dto;

import lombok.Builder;

import java.time.Instant;
import java.util.UUID;

@Builder
public record CapabilityMapResponse(
        UUID id,
        String mapId,
        String name,
        String code,
        String description,
        String businessDomain,
        UUID rootCapabilityId,
        String currentVersion,
        String status,
        Instant createdAt,
        Instant updatedAt
) {
}
