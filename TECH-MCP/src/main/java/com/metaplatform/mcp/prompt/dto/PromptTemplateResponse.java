package com.metaplatform.mcp.prompt.dto;

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
public class PromptTemplateResponse {

    private UUID id;
    private String name;
    private String description;
    private String template;
    private String variables;
    private Integer version;
    private String status;
    private String category;
    private Instant createdAt;
    private Instant updatedAt;
}