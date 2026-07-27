package com.metaplatform.ea.dataarchitecture.dto;

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
public class DataFlowResponse {
    private UUID id;
    private String tenantId;
    private String name;
    private UUID sourceEntityId;
    private UUID targetEntityId;
    private String flowType;
    private String description;
    private String schedule;
    private Instant createdAt;
    private Instant updatedAt;
}