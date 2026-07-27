package com.metaplatform.mcp.resource.dto;

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
public class ResourceListItem {

    private UUID id;
    private String name;
    private String uri;
    private String mimeType;
    private String relatedConceptId;
    private Instant createdAt;
    private Instant updatedAt;
}