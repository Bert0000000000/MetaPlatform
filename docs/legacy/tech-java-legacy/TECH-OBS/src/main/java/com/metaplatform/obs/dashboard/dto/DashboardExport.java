package com.metaplatform.obs.dashboard.dto;

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
public class DashboardExport {

    private UUID id;
    private String title;
    private String description;
    private JsonNode layout;
    private JsonNode panels;
    private Instant exportedAt;
}