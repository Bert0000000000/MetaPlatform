package com.metaplatform.ea.valuestream.dto;

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
public class ValueStreamResponse {

    private UUID id;
    private String tenantId;
    private String name;
    private String code;
    private String description;
    private List<String> stages;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;
}
