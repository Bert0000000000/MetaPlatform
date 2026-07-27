package com.metaplatform.obs.dashboard.entity;

import com.fasterxml.jackson.databind.JsonNode;
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
public class DashboardEntity {

    private UUID id;
    private String tenantId;
    private String title;
    private String description;
    private JsonNode layout;
    private JsonNode panels;
    private boolean isPublic;
    private String shareToken;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;
}