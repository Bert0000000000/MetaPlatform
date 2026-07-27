package com.metaplatform.gw.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Lightweight projection reused for both list responses and detail summaries.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiListItem {
    private String id;
    private String tenantId;
    private String name;
    private String path;
    private String method;
    private String groupName;
    private String version;
    private String targetService;
    private String status;
    private String description;
    private String createdAt;
    private String updatedAt;
}
