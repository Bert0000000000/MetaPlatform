package com.metaplatform.ea.ontmapping.dto;

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
public class OntologyChangeEventResponse {

    private UUID id;
    private String tenantId;
    private String conceptId;
    private String conceptCode;
    private String conceptName;
    private String changeType;
    private UUID ruleId;
    private String assetType;
    private UUID assetId;
    private String status;
    private UUID reviewTicketId;
    private String payload;
    private Instant createdAt;
    private Instant updatedAt;
}
