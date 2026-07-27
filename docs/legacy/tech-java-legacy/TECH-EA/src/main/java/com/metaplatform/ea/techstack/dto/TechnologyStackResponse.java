package com.metaplatform.ea.techstack.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechnologyStackResponse {

    private UUID id;
    private String tenantId;
    private String applicationId;
    private String applicationName;
    private String name;
    private String description;
    private List<TechnologyStackComponentRef> components;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;
}
