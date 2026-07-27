package com.metaplatform.ea.capabilitymap.dto;

import lombok.Builder;

import java.time.Instant;
import java.util.UUID;

@Builder
public record CapabilityMapVersionResponse(
        UUID id,
        String mapId,
        String version,
        String snapshot,
        String status,
        String createdBy,
        Instant createdAt
) {
}
