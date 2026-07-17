package com.metaplatform.ea.valuestream.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ValueStreamStageResponse {
    private UUID id;
    private UUID valueStreamId;
    private String tenantId;
    private String name;
    private String description;
    private Integer sortOrder;
    private Instant createdAt;
    private Instant updatedAt;
}