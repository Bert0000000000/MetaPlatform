package com.metaplatform.ea.application.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApplicationResponse {

    private UUID id;
    private String tenantId;
    private String name;
    private String code;
    private String description;
    private String appType;
    private String status;
    private Map<String, Object> techStack;
    private Map<String, Object> dependencies;
    private Map<String, Object> capabilityIds;
    private Instant createdAt;
    private Instant updatedAt;
}