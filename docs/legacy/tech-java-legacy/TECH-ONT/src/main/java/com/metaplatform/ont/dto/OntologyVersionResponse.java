package com.metaplatform.ont.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OntologyVersionResponse {

    private String versionId;
    private Integer versionNumber;
    private String name;
    private String description;
    private String status;
    private Boolean current;
    private Instant publishedAt;
    private Instant createdAt;
    private String createdBy;
    private JsonNode snapshot;
}
