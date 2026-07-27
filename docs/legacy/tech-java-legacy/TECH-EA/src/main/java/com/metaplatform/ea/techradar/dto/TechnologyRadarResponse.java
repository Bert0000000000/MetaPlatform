package com.metaplatform.ea.techradar.dto;

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
public class TechnologyRadarResponse {

    private UUID id;
    private String tenantId;
    private String name;
    private List<String> quadrants;
    private List<String> rings;
    private List<TechnologyRadarItem> items;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;
}
