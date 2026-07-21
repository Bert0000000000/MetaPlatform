package com.metaplatform.ea.techcomponent.dto;

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
public class TechnologyComponentResponse {

    private UUID id;
    private String tenantId;
    private String name;
    private String type;
    private String version;
    private String description;
    private String owner;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;
}
