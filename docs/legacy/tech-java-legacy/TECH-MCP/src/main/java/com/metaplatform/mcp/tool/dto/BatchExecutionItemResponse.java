package com.metaplatform.mcp.tool.dto;

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
public class BatchExecutionItemResponse {

    private UUID id;
    private String batchId;
    private UUID toolId;
    private String status;
    private String output;
    private String errorMessage;
    private Instant startedAt;
    private Instant completedAt;
}
