package com.metaplatform.ea.application.dto;

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
public class ApplicationResponse {

    private UUID id;
    private String tenantId;
    private String name;
    private String code;
    private String description;
    private String appType;
    private String status;
    private List<String> techStack;
    private List<String> dependencies;
    private Instant createdAt;
    private Instant updatedAt;
}
